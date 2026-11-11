import { useCallback, useMemo, useState } from 'react'
import { dueUrgency } from '../lib/dates'
import type { Priority, Task } from '../lib/types'

export interface Filters {
  query: string
  priorities: Priority[]
  memberIds: string[]
  labelIds: string[]
  overdueOnly: boolean
}

const EMPTY: Filters = { query: '', priorities: [], memberIds: [], labelIds: [], overdueOnly: false }

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(EMPTY)

  const active =
    filters.query.trim() !== '' ||
    filters.priorities.length > 0 ||
    filters.memberIds.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.overdueOnly

  const actions = useMemo(
    () => ({
      setQuery: (query: string) => setFilters((f) => ({ ...f, query })),
      togglePriority: (p: Priority) => setFilters((f) => ({ ...f, priorities: toggle(f.priorities, p) })),
      toggleMember: (id: string) => setFilters((f) => ({ ...f, memberIds: toggle(f.memberIds, id) })),
      toggleLabel: (id: string) => setFilters((f) => ({ ...f, labelIds: toggle(f.labelIds, id) })),
      toggleOverdue: () => setFilters((f) => ({ ...f, overdueOnly: !f.overdueOnly })),
      clear: () => setFilters(EMPTY),
    }),
    [],
  )

  // Within one filter type it's OR (High or Normal), across types it's AND
  // (High AND assigned to Maya). Same as Linear, felt the most natural.
  const matches = useCallback(
    (task: Task, assignees: string[] = [], labels: string[] = []) => {
      const q = filters.query.trim().toLowerCase()
      if (q && !task.title.toLowerCase().includes(q)) return false
      if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false
      if (filters.memberIds.length && !assignees.some((id) => filters.memberIds.includes(id))) return false
      if (filters.labelIds.length && !labels.some((id) => filters.labelIds.includes(id))) return false
      if (filters.overdueOnly && dueUrgency(task.due_date, task.status === 'done') !== 'overdue') return false
      return true
    },
    [filters],
  )

  return { filters, active, matches, ...actions }
}

export type FilterApi = ReturnType<typeof useFilters>
