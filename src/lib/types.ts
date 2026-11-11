export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
export type Priority = 'low' | 'normal' | 'high'

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  status: Status
  priority: Priority
  due_date: string | null // yyyy-mm-dd
  position: number
  created_at: string
  updated_at: string
  comment_count: number
}

export interface Member {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Label {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  body: string
  created_at: string
}

export type ActivityKind =
  | 'created'
  | 'status'
  | 'title'
  | 'description'
  | 'priority'
  | 'due_date'
  | 'assigned'
  | 'unassigned'
  | 'labeled'
  | 'unlabeled'

export interface Activity {
  id: number
  task_id: string
  kind: ActivityKind
  meta: Record<string, string | null>
  created_at: string
}

// what the create-task form hands back
export interface TaskDraft {
  title: string
  description: string
  status: Status
  priority: Priority
  due_date: string | null
  memberIds: string[]
  labelIds: string[]
}

export const COLUMNS: { id: Status; title: string; hint: string }[] = [
  { id: 'todo', title: 'To Do', hint: 'Anything you plan to pick up. Drop new ideas here.' },
  { id: 'in_progress', title: 'In Progress', hint: 'Drag a card here once someone starts on it.' },
  { id: 'in_review', title: 'In Review', hint: 'Work waiting on a second pair of eyes.' },
  { id: 'done', title: 'Done', hint: 'Finished cards land here. Nice.' },
]

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
}
