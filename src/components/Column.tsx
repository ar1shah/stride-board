import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { Label, Member, Status, Task } from '../lib/types'
import { TaskCard } from './TaskCard'

interface ColumnProps {
  id: Status
  title: string
  hint: string
  tasks: Task[]
  totalInColumn: number // before filters, so we can tell "empty" from "filtered out"
  membersFor: (taskId: string) => Member[]
  labelsFor: (taskId: string) => Label[]
  onOpen: (id: string) => void
  onQuickAdd: (status: Status, title: string) => Promise<unknown>
}

export function Column({ id, title, hint, tasks, totalInColumn, membersFor, labelsFor, onOpen, onQuickAdd }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column' } })
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = draft.trim()
    if (!value) return
    setDraft('')
    // keep the input open so you can rattle off a few tasks in a row
    await onQuickAdd(id, value)
  }

  const filteredOut = tasks.length === 0 && totalInColumn > 0

  return (
    <section className={`lane lane--${id}${isOver ? ' is-over' : ''}`} aria-labelledby={`lane-${id}`}>
      <header className="lane__head">
        <span className="lane__dot" aria-hidden />
        <h2 id={`lane-${id}`} className="lane__title">
          {title}
        </h2>
        <span className="lane__count" aria-label={`${tasks.length} tasks`}>
          {tasks.length}
        </span>
        <button className="icon-btn lane__add" aria-label={`Add task to ${title}`} onClick={() => setAdding(true)}>
          <Plus size={16} />
        </button>
      </header>

      <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="lane__list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={membersFor(task.id)}
              labels={labelsFor(task.id)}
              onOpen={onOpen}
            />
          ))}

          {tasks.length === 0 && !adding && (
            <li className="lane__empty">{filteredOut ? 'No cards match your filters.' : hint}</li>
          )}
        </ol>
      </SortableContext>

      {adding ? (
        <form className="quick-add" onSubmit={submit}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setAdding(false)
                setDraft('')
              }
            }}
            onBlur={() => {
              if (!draft.trim()) setAdding(false)
            }}
            placeholder="Task title, then Enter"
            maxLength={200}
            aria-label={`New task in ${title}`}
          />
        </form>
      ) : (
        <button className="lane__ghost-add" onClick={() => setAdding(true)}>
          <Plus size={14} /> Add task
        </button>
      )}
    </section>
  )
}
