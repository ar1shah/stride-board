import { addDays } from 'date-fns'
import { toDateInput } from '../lib/dates'
import type { Priority, Status } from '../lib/types'

// A believable little board for first-time visitors who want to poke around
// without typing 10 tasks first. Dates are relative to today so the due date
// badges (overdue / today / soon) always have something to show.

const day = (offset: number) => toDateInput(addDays(new Date(), offset))

export function buildSampleBoard() {
  const id = () => crypto.randomUUID()

  const members = [
    { id: id(), name: 'Maya Chen', color: '#3B6FB6' },
    { id: id(), name: 'Jordan Ellis', color: '#C2477B' },
    { id: id(), name: 'Sam Okafor', color: '#D9930D' },
  ]
  const [maya, jordan, sam] = members

  const labels = [
    { id: id(), name: 'Bug', color: '#D4483B' },
    { id: id(), name: 'Feature', color: '#3E9B6E' },
    { id: id(), name: 'Design', color: '#7C5CD6' },
    { id: id(), name: 'Research', color: '#3B6FB6' },
  ]
  const [bug, feature, design, research] = labels

  type Seed = {
    title: string
    description?: string
    status: Status
    priority: Priority
    due?: number
    who: string[]
    tags: string[]
  }

  const seeds: Seed[] = [
    {
      title: 'Interview 5 users about the onboarding flow',
      description: 'Focus on where people drop off between sign up and creating their first project.',
      status: 'todo',
      priority: 'normal',
      due: 6,
      who: [maya.id],
      tags: [research.id],
    },
    {
      title: 'Empty state illustrations for the inbox',
      status: 'todo',
      priority: 'low',
      who: [jordan.id],
      tags: [design.id],
    },
    {
      title: 'Export board as CSV',
      description: 'Customers keep asking for this for their weekly reports.',
      status: 'todo',
      priority: 'normal',
      due: 12,
      who: [],
      tags: [feature.id],
    },
    {
      title: 'Date picker closes when you tab into it',
      status: 'in_progress',
      priority: 'high',
      due: -1,
      who: [sam.id],
      tags: [bug.id],
    },
    {
      title: 'Keyboard shortcuts for moving cards',
      description: 'Arrow keys + space to pick up, like Linear. Needs to work with screen readers.',
      status: 'in_progress',
      priority: 'normal',
      due: 2,
      who: [sam.id, maya.id],
      tags: [feature.id],
    },
    {
      title: 'New pricing page copy',
      status: 'in_review',
      priority: 'high',
      due: 0,
      who: [jordan.id],
      tags: [design.id],
    },
    {
      title: 'Fix avatar upload on Safari',
      status: 'in_review',
      priority: 'normal',
      due: 3,
      who: [sam.id],
      tags: [bug.id],
    },
    {
      title: 'Set up error tracking',
      status: 'done',
      priority: 'normal',
      due: -4,
      who: [maya.id],
      tags: [],
    },
    {
      title: 'Competitor teardown: Linear, Height, Asana',
      status: 'done',
      priority: 'low',
      who: [jordan.id, maya.id],
      tags: [research.id],
    },
  ]

  const counters: Record<Status, number> = { todo: 0, in_progress: 0, in_review: 0, done: 0 }

  const tasks = seeds.map((s) => ({
    id: id(),
    title: s.title,
    description: s.description ?? null,
    status: s.status,
    priority: s.priority,
    due_date: s.due === undefined ? null : day(s.due),
    position: ++counters[s.status] * 1024,
  }))

  const assignees = seeds.flatMap((s, i) => s.who.map((member_id) => ({ task_id: tasks[i].id, member_id })))
  const taskLabels = seeds.flatMap((s, i) => s.tags.map((label_id) => ({ task_id: tasks[i].id, label_id })))

  const comments = [
    { task_id: tasks[3].id, body: 'Repro: open the new task dialog, press Tab twice. Happens in Chrome and Arc.' },
    { task_id: tasks[3].id, body: 'Looks like the blur handler fires before focus lands inside. On it.' },
    { task_id: tasks[5].id, body: 'Draft is in the doc, mostly need eyes on the FAQ section.' },
  ]

  return { members, labels, tasks, assignees, taskLabels, comments }
}
