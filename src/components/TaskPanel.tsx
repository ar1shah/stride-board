import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Loader2, MessageSquare, Pencil, Trash2, X } from 'lucide-react'
import { fullDate, timeAgo } from '../lib/dates'
import type { Label, Member } from '../lib/types'
import { useTaskThread } from '../hooks/useTaskThread'
import { useBoard } from '../state/BoardContext'
import { ActivityItem } from './ActivityItem'
import { Avatar } from './Avatar'
import { LabelChip } from './LabelChip'
import { LabelPicker, MemberPicker } from './Pickers'
import { Popover } from './Popover'
import { PrioritySegment, StatusMenu } from './StatusMenu'
import { DueBadge } from './TaskMeta'

export function TaskPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const board = useBoard()
  const task = board.tasks.find((t) => t.id === taskId)
  const closeRef = useRef<HTMLButtonElement>(null)

  // task got deleted (here or in another tab), nothing to show
  useEffect(() => {
    if (!task && !board.loading) onClose()
  }, [task, board.loading, onClose])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!task) return null

  const members = (board.assignees[task.id] ?? [])
    .map((id) => board.members.find((m) => m.id === id))
    .filter(Boolean) as Member[]
  const labels = (board.taskLabels[task.id] ?? [])
    .map((id) => board.labels.find((l) => l.id === id))
    .filter(Boolean) as Label[]

  return (
    <>
      <div className="scrim scrim--panel is-open" onClick={onClose} aria-hidden />
      <aside className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <div className="panel__bar">
          <StatusMenu value={task.status} onChange={(status) => board.updateTask(task.id, { status })} />
          <span className="panel__created" title={fullDate(task.created_at)}>
            Created {timeAgo(task.created_at)}
          </span>
          <DeleteButton onDelete={() => board.deleteTask(task.id)} />
          <button ref={closeRef} className="icon-btn" aria-label="Close task" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="panel__scroll">
          {/* key on id so switching tasks resets the local edit state */}
          <EditableTitle key={`t-${task.id}`} value={task.title} onSave={(title) => board.updateTask(task.id, { title })} />

          <dl className="props">
            <dt>Priority</dt>
            <dd>
              <PrioritySegment value={task.priority} onChange={(priority) => board.updateTask(task.id, { priority })} />
            </dd>

            <dt>Due date</dt>
            <dd className="props__due">
              <label className="date-input">
                <CalendarDays size={14} aria-hidden />
                <input
                  type="date"
                  value={task.due_date ?? ''}
                  onChange={(e) => board.updateTask(task.id, { due_date: e.target.value || null })}
                  aria-label="Due date"
                />
              </label>
              {task.due_date && (
                <>
                  <DueBadge due={task.due_date} done={task.status === 'done'} />
                  <button className="link-btn" onClick={() => board.updateTask(task.id, { due_date: null })}>
                    Clear
                  </button>
                </>
              )}
            </dd>

            <dt>Assignees</dt>
            <dd>
              <LinkEditor
                label="Edit assignees"
                empty="Nobody yet"
                items={members.map((m) => (
                  <span key={m.id} className="person">
                    <Avatar member={m} size="xs" />
                    {m.name}
                  </span>
                ))}
              >
                <MemberPicker selected={board.assignees[task.id] ?? []} onToggle={(id) => board.toggleAssignee(task.id, id)} />
              </LinkEditor>
            </dd>

            <dt>Labels</dt>
            <dd>
              <LinkEditor
                label="Edit labels"
                empty="No labels"
                items={labels.map((l) => (
                  <LabelChip key={l.id} label={l} onRemove={() => board.toggleLabel(task.id, l.id)} />
                ))}
              >
                <LabelPicker selected={board.taskLabels[task.id] ?? []} onToggle={(id) => board.toggleLabel(task.id, id)} />
              </LinkEditor>
            </dd>
          </dl>

          <EditableDescription
            key={`d-${task.id}`}
            value={task.description ?? ''}
            onSave={(description) => board.updateTask(task.id, { description: description || null })}
          />

          <Thread taskId={task.id} commentCount={task.comment_count} />
        </div>
      </aside>
    </>
  )
}

// ------------------------------------------------------------------ pieces

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setDraft(value), [value])
  useAutosize(ref, draft)

  const commit = () => {
    const next = draft.trim()
    if (!next) setDraft(value) // empty title isn't allowed, put it back
    else if (next !== value) onSave(next)
  }

  return (
    <textarea
      id="panel-title"
      ref={ref}
      className="panel__title"
      rows={1}
      value={draft}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      aria-label="Task title"
    />
  )
}

function EditableDescription({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutosize(ref, draft)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft.trim() !== value.trim()) onSave(draft.trim())
  }

  return (
    <section className="desc">
      <h3 className="section-title">Description</h3>
      {editing ? (
        <textarea
          ref={ref}
          className="desc__input"
          value={draft}
          maxLength={5000}
          placeholder="Add more detail, links, acceptance criteria…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setDraft(value)
              setEditing(false)
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
          }}
        />
      ) : (
        <button className={`desc__view${value ? '' : ' is-empty'}`} onClick={() => setEditing(true)}>
          {value || 'Add a description'}
          <Pencil size={13} className="desc__pencil" aria-hidden />
        </button>
      )}
    </section>
  )
}

function LinkEditor({
  label,
  empty,
  items,
  children,
}: {
  label: string
  empty: string
  items: React.ReactNode[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="link-editor">
      {items.length ? items : <span className="muted">{empty}</span>}
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        anchor={
          <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog">
            {items.length ? 'Edit' : 'Add'}
          </button>
        }
      >
        {children}
      </Popover>
    </div>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  // inline confirm instead of window.confirm, it's less jarring
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return armed ? (
    <button className="btn btn--sm btn--danger" onClick={onDelete}>
      Delete task
    </button>
  ) : (
    <button className="icon-btn" aria-label="Delete task" title="Delete task" onClick={() => setArmed(true)}>
      <Trash2 size={16} />
    </button>
  )
}

function Thread({ taskId, commentCount }: { taskId: string; commentCount: number }) {
  const thread = useTaskThread(taskId)
  const [tab, setTab] = useState<'comments' | 'activity'>('comments')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const listEnd = useRef<HTMLLIElement>(null)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = body.trim()
    if (!text || posting) return
    setPosting(true)
    setBody('')
    const ok = await thread.addComment(text)
    if (!ok) setBody(text) // give it back so they don't lose it
    setPosting(false)
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  return (
    <section className="thread">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'comments'} className={`tab${tab === 'comments' ? ' is-on' : ''}`} onClick={() => setTab('comments')}>
          Comments <span className="tab__count">{commentCount}</span>
        </button>
        <button role="tab" aria-selected={tab === 'activity'} className={`tab${tab === 'activity' ? ' is-on' : ''}`} onClick={() => setTab('activity')}>
          Activity
        </button>
      </div>

      {thread.loading ? (
        <div className="thread__state">
          <Loader2 size={16} className="spin" /> Loading
        </div>
      ) : thread.error ? (
        <div className="thread__state thread__state--error">
          {thread.error}
          <button className="link-btn" onClick={thread.reload}>
            Try again
          </button>
        </div>
      ) : tab === 'comments' ? (
        <>
          {thread.comments.length === 0 ? (
            <p className="thread__empty">
              <MessageSquare size={16} aria-hidden />
              No comments yet. Leave a note for your future self or the team.
            </p>
          ) : (
            <ol className="comments">
              {thread.comments.map((c) => (
                <li key={c.id} className={`comment${c.id.startsWith('temp-') ? ' is-pending' : ''}`}>
                  <div className="comment__head">
                    <span className="comment__author">You</span>
                    <time dateTime={c.created_at} title={fullDate(c.created_at)}>
                      {timeAgo(c.created_at)}
                    </time>
                    {!c.id.startsWith('temp-') && (
                      <button className="icon-btn icon-btn--sm comment__del" aria-label="Delete comment" onClick={() => thread.deleteComment(c.id)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="comment__body">{c.body}</p>
                </li>
              ))}
              <li ref={listEnd} aria-hidden className="comments__end" />
            </ol>
          )}

          <form className="composer" onSubmit={submit}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a comment"
              maxLength={2000}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
              }}
              aria-label="Write a comment"
            />
            <div className="composer__foot">
              <span className="muted">⌘/Ctrl + Enter to send</span>
              <button className="btn btn--primary btn--sm" disabled={!body.trim() || posting}>
                Comment
              </button>
            </div>
          </form>
        </>
      ) : thread.activity.length === 0 ? (
        <p className="thread__empty">Nothing has happened to this task yet.</p>
      ) : (
        <ol className="timeline">
          {thread.activity.map((a) => (
            <ActivityItem key={a.id} activity={a} />
          ))}
        </ol>
      )}
    </section>
  )
}

function useAutosize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}
