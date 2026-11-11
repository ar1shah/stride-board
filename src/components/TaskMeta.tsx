import { ArrowDown, CalendarDays, Flag, Minus } from 'lucide-react'
import { dueLabel, dueUrgency, shortDate } from '../lib/dates'
import type { Priority } from '../lib/types'

// small bits shared by the card and the side panel

export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  if (priority === 'high') return <Flag size={size} className="prio prio--high" aria-label="High priority" />
  if (priority === 'low') return <ArrowDown size={size} className="prio prio--low" aria-label="Low priority" />
  return <Minus size={size} className="prio prio--normal" aria-label="Normal priority" />
}

export function DueBadge({ due, done }: { due: string; done?: boolean }) {
  const urgency = dueUrgency(due, done)
  // once a task is done the urgency doesn't matter, just show the date
  const text = done ? shortDate(due) : dueLabel(due)
  const title =
    urgency === 'overdue' ? 'Overdue' : urgency === 'today' ? 'Due today' : urgency === 'soon' ? 'Due soon' : 'Due date'

  return (
    <span className={`due due--${done ? 'done' : urgency}`} title={title}>
      <CalendarDays size={12} />
      {text}
    </span>
  )
}
