import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Loader2, Tag, Users, X } from 'lucide-react'
import type { Label, Member, Status, TaskDraft } from '../lib/types'
import { useBoard } from '../state/BoardContext'
import { Avatar } from './Avatar'
import { LabelChip } from './LabelChip'
import { LabelPicker, MemberPicker } from './Pickers'
import { Popover } from './Popover'
import { PrioritySegment, StatusMenu } from './StatusMenu'

interface Props {
  initialStatus?: Status
  onClose: () => void
}

export function NewTaskDialog({ initialStatus = 'todo', onClose }: Props) {
  const { createTask, members, labels } = useBoard()
  const [draft, setDraft] = useState<TaskDraft>({
    title: '',
    description: '',
    status: initialStatus,
    priority: 'normal',
    due_date: null,
    memberIds: [],
    labelIds: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [menu, setMenu] = useState<'people' | 'labels' | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const toggleIn = (key: 'memberIds' | 'labelIds', id: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim()) {
      setError('Give the task a title.')
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    const created = await createTask(draft)
    setSaving(false)
    if (created) onClose()
    // on failure the toast explains it and the form stays filled in
  }

  const chosenMembers = draft.memberIds.map((id) => members.find((m) => m.id === id)).filter(Boolean) as Member[]
  const chosenLabels = draft.labelIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[]

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-task-heading" noValidate>
        <div className="modal__head">
          <h2 id="new-task-heading">New task</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <input
          ref={titleRef}
          className={`modal__title${error ? ' has-error' : ''}`}
          placeholder="What needs to happen?"
          value={draft.title}
          maxLength={200}
          onChange={(e) => {
            set('title', e.target.value)
            if (error) setError(null)
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'title-error' : undefined}
          aria-label="Title"
        />
        {error && (
          <p id="title-error" className="field-error">
            {error}
          </p>
        )}

        <textarea
          className="modal__desc"
          placeholder="Description (optional)"
          value={draft.description}
          maxLength={5000}
          rows={3}
          onChange={(e) => set('description', e.target.value)}
          aria-label="Description"
        />

        <div className="modal__props">
          <StatusMenu value={draft.status} onChange={(s) => set('status', s)} />
          <PrioritySegment value={draft.priority} onChange={(p) => set('priority', p)} />

          <label className="date-input">
            <CalendarDays size={14} aria-hidden />
            <input type="date" value={draft.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} aria-label="Due date" />
          </label>

          <Popover
            open={menu === 'people'}
            onClose={() => setMenu(null)}
            label="Assignees"
            anchor={
              <button type="button" className="prop-btn" onClick={() => setMenu(menu === 'people' ? null : 'people')}>
                {chosenMembers.length ? (
                  chosenMembers.map((m) => <Avatar key={m.id} member={m} size="xs" />)
                ) : (
                  <>
                    <Users size={14} /> Assign
                  </>
                )}
              </button>
            }
          >
            <MemberPicker selected={draft.memberIds} onToggle={(id) => toggleIn('memberIds', id)} />
          </Popover>

          <Popover
            open={menu === 'labels'}
            onClose={() => setMenu(null)}
            label="Labels"
            anchor={
              <button type="button" className="prop-btn" onClick={() => setMenu(menu === 'labels' ? null : 'labels')}>
                <Tag size={14} /> {chosenLabels.length ? `${chosenLabels.length} label${chosenLabels.length > 1 ? 's' : ''}` : 'Labels'}
              </button>
            }
          >
            <LabelPicker selected={draft.labelIds} onToggle={(id) => toggleIn('labelIds', id)} />
          </Popover>
        </div>

        {chosenLabels.length > 0 && (
          <div className="modal__chips">
            {chosenLabels.map((l) => (
              <LabelChip key={l.id} label={l} onRemove={() => toggleIn('labelIds', l.id)} />
            ))}
          </div>
        )}

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving && <Loader2 size={14} className="spin" />}
            Create task
          </button>
        </div>
      </form>
    </div>
  )
}
