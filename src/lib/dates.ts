import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns'

export type Urgency = 'overdue' | 'today' | 'soon' | 'later' | 'none'

// due_date comes back as a plain yyyy-mm-dd string. parseISO treats that as
// local midnight which is what we want (new Date('2026-01-01') would be UTC
// and show up as the day before for anyone west of London).
export function dueUrgency(due: string | null, done = false): Urgency {
  if (!due || done) return 'none'
  const days = differenceInCalendarDays(parseISO(due), new Date())
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 2) return 'soon'
  return 'later'
}

export function dueLabel(due: string): string {
  const days = differenceInCalendarDays(parseISO(due), new Date())
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < -1) return `${Math.abs(days)}d overdue`
  if (days < 7) return format(parseISO(due), 'EEE')
  return format(parseISO(due), 'MMM d')
}

export function shortDate(due: string): string {
  return format(parseISO(due), 'MMM d')
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 45_000) return 'just now'
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
}

export function fullDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
}

export function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
