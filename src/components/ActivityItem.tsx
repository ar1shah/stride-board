import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { fullDate, shortDate, timeAgo } from '../lib/dates'
import { PRIORITY_LABEL, STATUS_LABEL, type Activity, type Priority, type Status } from '../lib/types'

const status = (s: string | null) => (
  <span className={`status-pill status-pill--${s}`}>{STATUS_LABEL[s as Status] ?? s}</span>
)

// turns a raw activity row into a sentence
function describe(a: Activity): ReactNode {
  const m = a.meta
  switch (a.kind) {
    case 'created':
      return <>Created in {status(m.status)}</>
    case 'status':
      return (
        <>
          Moved from {status(m.from)} <ArrowRight size={12} className="activity__arrow" aria-label="to" /> {status(m.to)}
        </>
      )
    case 'title':
      return (
        <>
          Renamed to <strong>“{m.to}”</strong>
        </>
      )
    case 'description':
      return <>Edited the description</>
    case 'priority':
      return (
        <>
          Changed priority from {PRIORITY_LABEL[m.from as Priority]} to <strong>{PRIORITY_LABEL[m.to as Priority]}</strong>
        </>
      )
    case 'due_date':
      if (!m.to) return <>Removed the due date</>
      if (!m.from) return <>Set the due date to <strong>{shortDate(m.to)}</strong></>
      return (
        <>
          Changed the due date from {shortDate(m.from)} to <strong>{shortDate(m.to)}</strong>
        </>
      )
    case 'assigned':
      return (
        <>
          Assigned <strong>{m.member}</strong>
        </>
      )
    case 'unassigned':
      return (
        <>
          Unassigned <strong>{m.member}</strong>
        </>
      )
    case 'labeled':
      return (
        <>
          Added the <strong style={{ color: m.color ?? undefined }}>{m.label}</strong> label
        </>
      )
    case 'unlabeled':
      return (
        <>
          Removed the <strong>{m.label}</strong> label
        </>
      )
    default:
      return <>Updated the task</>
  }
}

export function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <li className={`activity activity--${activity.kind}`}>
      <span className="activity__node" aria-hidden />
      <p className="activity__text">
        {describe(activity)}
        <time className="activity__time" dateTime={activity.created_at} title={fullDate(activity.created_at)}>
          {timeAgo(activity.created_at)}
        </time>
      </p>
    </li>
  )
}
