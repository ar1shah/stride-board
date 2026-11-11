import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare } from 'lucide-react'
import type { Label, Member, Task } from '../lib/types'
import { AvatarStack } from './Avatar'
import { LabelChip } from './LabelChip'
import { DueBadge, PriorityIcon } from './TaskMeta'

interface CardBodyProps {
  task: Task
  members: Member[]
  labels: Label[]
}

// Pure presentational part. Used by the sortable card AND the drag overlay so
// the thing under your cursor looks exactly like the card you picked up.
export const CardBody = memo(function CardBody({ task, members, labels }: CardBodyProps) {
  const done = task.status === 'done'
  const hasFooter = task.priority !== 'normal' || task.due_date || task.comment_count > 0 || members.length > 0

  return (
    <>
      {labels.length > 0 && (
        <div className="card__labels">
          {labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <p className={`card__title${done ? ' is-done' : ''}`}>{task.title}</p>
      {hasFooter && (
        <div className="card__footer">
          <div className="card__meta">
            {task.priority !== 'normal' && <PriorityIcon priority={task.priority} />}
            {task.due_date && <DueBadge due={task.due_date} done={done} />}
            {task.comment_count > 0 && (
              <span
                className="card__comments"
                title={`${task.comment_count} comment${task.comment_count === 1 ? '' : 's'}`}
              >
                <MessageSquare size={12} />
                {task.comment_count}
              </span>
            )}
          </div>
          <AvatarStack members={members} />
        </div>
      )}
    </>
  )
})

interface TaskCardProps extends CardBodyProps {
  onOpen: (id: string) => void
}

export function TaskCard({ task, members, labels, onOpen }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', status: task.status },
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`card${isDragging ? ' is-placeholder' : ''}${task.priority === 'high' ? ' card--high' : ''}`}
      {...attributes}
      {...listeners}
      // dnd-kit's keyboard sensor uses space/enter to pick up, so opening
      // the card from the keyboard is on "o" instead (plus regular click)
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === 'o' || e.key === 'O') onOpen(task.id)
      }}
      aria-label={`${task.title}. Press space to move, O to open.`}
    >
      <CardBody task={task} members={members} labels={labels} />
    </li>
  )
}
