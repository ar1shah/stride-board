import { useMemo } from 'react'
import { dueUrgency } from '../lib/dates'
import { COLUMNS, type Status } from '../lib/types'
import { useBoard } from '../state/BoardContext'

interface StrideBarProps {
  overdueOnly: boolean
  onToggleOverdue: () => void
}

/**
 * The bar under the header. One segment per column, sized by how many cards
 * are in it, so you can see at a glance how the board is spread out. Doubles
 * as the stats summary.
 */
export function StrideBar({ overdueOnly, onToggleOverdue }: StrideBarProps) {
  const { tasks } = useBoard()

  const stats = useMemo(() => {
    const counts: Record<Status, number> = { todo: 0, in_progress: 0, in_review: 0, done: 0 }
    let overdue = 0
    let dueSoon = 0
    for (const t of tasks) {
      counts[t.status]++
      const u = dueUrgency(t.due_date, t.status === 'done')
      if (u === 'overdue') overdue++
      else if (u === 'today' || u === 'soon') dueSoon++
    }
    const total = tasks.length
    const pct = total ? Math.round((counts.done / total) * 100) : 0
    return { counts, total, overdue, dueSoon, pct }
  }, [tasks])

  return (
    <div className="stride">
      <div
        className="stride__bar"
        role="img"
        aria-label={COLUMNS.map((c) => `${stats.counts[c.id]} ${c.title}`).join(', ')}
      >
        {stats.total === 0 ? (
          <span className="stride__seg stride__seg--empty" />
        ) : (
          COLUMNS.map((c) =>
            stats.counts[c.id] > 0 ? (
              <span
                key={c.id}
                className={`stride__seg stride__seg--${c.id}`}
                style={{ flexGrow: stats.counts[c.id] }}
                title={`${c.title}: ${stats.counts[c.id]}`}
              />
            ) : null,
          )
        )}
      </div>

      <div className="stride__stats">
        <div className="stat">
          <span className="stat__label">Total</span>
          <span className="stat__value">{stats.total}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Completed</span>
          <span className="stat__value">
            {stats.counts.done}
            <span className="stat__sub">{stats.pct}%</span>
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Due soon</span>
          <span className="stat__value">{stats.dueSoon}</span>
        </div>
        <button
          type="button"
          className={`stat stat--btn${stats.overdue ? ' stat--alert' : ''}${overdueOnly ? ' is-on' : ''}`}
          onClick={onToggleOverdue}
          aria-pressed={overdueOnly}
          title={overdueOnly ? 'Show all tasks' : 'Show only overdue tasks'}
        >
          <span className="stat__label">Overdue</span>
          <span className="stat__value">{stats.overdue}</span>
        </button>
      </div>
    </div>
  )
}
