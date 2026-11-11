import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { positionBetween } from '../lib/position'
import type { Label, Member, Status, Task, TaskDraft } from '../lib/types'
import { useToast } from './Toasts'
import { buildSampleBoard } from './sampleBoard'

type TaskRow = Omit<Task, 'comment_count'> & { comments?: { count: number }[] }
type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'position'>>

interface BoardState {
  loading: boolean
  loadError: string | null
  tasks: Task[]
  members: Member[]
  labels: Label[]
  // task id -> ids. kept as maps so a card can look itself up in O(1)
  assignees: Record<string, string[]>
  taskLabels: Record<string, string[]>
  // bumps whenever something that shows up in the activity log changes, so
  // an open task panel knows to refetch
  activityTick: number
}

interface BoardApi extends BoardState {
  reload: () => Promise<void>
  createTask: (draft: TaskDraft) => Promise<Task | null>
  updateTask: (id: string, patch: TaskPatch) => Promise<boolean>
  moveTask: (id: string, status: Status, position: number) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  toggleAssignee: (taskId: string, memberId: string) => Promise<void>
  toggleLabel: (taskId: string, labelId: string) => Promise<void>
  addMember: (name: string, color: string) => Promise<Member | null>
  removeMember: (id: string) => Promise<void>
  addLabel: (name: string, color: string) => Promise<Label | null>
  removeLabel: (id: string) => Promise<void>
  adjustCommentCount: (taskId: string, delta: number) => void
  loadSampleBoard: () => Promise<void>
}

const BoardContext = createContext<BoardApi | null>(null)

const toTask = (row: TaskRow, fallbackCount = 0): Task => {
  const { comments, ...rest } = row
  return { ...rest, comment_count: comments?.[0]?.count ?? fallbackCount }
}

function groupBy(rows: { task_id: string }[], key: 'member_id' | 'label_id') {
  const out: Record<string, string[]> = {}
  for (const row of rows as Record<string, string>[]) {
    ;(out[row.task_id] ??= []).push(row[key])
  }
  return out
}

export function BoardProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const toast = useToast()
  const [state, setState] = useState<BoardState>({
    loading: true,
    loadError: null,
    tasks: [],
    members: [],
    labels: [],
    assignees: {},
    taskLabels: {},
    activityTick: 0,
  })

  // keep a ref in sync so async callbacks always read the latest state
  // without having to be recreated on every render
  const stateRef = useRef(state)
  stateRef.current = state

  // tasks we've got an unfinished write for. realtime echoes for these get
  // ignored, otherwise a quick double move makes the card jump back and forth
  const pendingWrites = useRef(new Map<string, number>())
  const markPending = (id: string, delta: 1 | -1) => {
    const n = (pendingWrites.current.get(id) ?? 0) + delta
    if (n <= 0) pendingWrites.current.delete(id)
    else pendingWrites.current.set(id, n)
  }

  const tick = () => setState((s) => ({ ...s, activityTick: s.activityTick + 1 }))

  // ---------------------------------------------------------------- loading

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, loadError: null }))

    const [tasks, members, labels, assignees, taskLabels] = await Promise.all([
      supabase.from('tasks').select('*, comments(count)').order('position'),
      supabase.from('team_members').select('id, name, color, created_at').order('created_at'),
      supabase.from('labels').select('id, name, color, created_at').order('created_at'),
      supabase.from('task_assignees').select('task_id, member_id'),
      supabase.from('task_labels').select('task_id, label_id'),
    ])

    const failed = [tasks, members, labels, assignees, taskLabels].find((r) => r.error)
    if (failed?.error) {
      console.error('[board] load failed', failed.error)
      setState((s) => ({
        ...s,
        loading: false,
        loadError: failed.error.message || 'Could not reach the database.',
      }))
      return
    }

    setState((s) => ({
      ...s,
      loading: false,
      tasks: (tasks.data as TaskRow[]).map((r) => toTask(r)),
      members: members.data as Member[],
      labels: labels.data as Label[],
      assignees: groupBy(assignees.data!, 'member_id'),
      taskLabels: groupBy(taskLabels.data!, 'label_id'),
    }))
  }, [])

  useEffect(() => {
    reload()
  }, [reload, userId])

  // ---------------------------------------------------------------- realtime
  // Mostly so you can have the board open in two tabs (or phone + laptop)
  // and see moves show up without refreshing.

  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id
            setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
            return
          }
          const row = payload.new as TaskRow
          if (pendingWrites.current.has(row.id)) return

          setState((s) => {
            const existing = s.tasks.find((t) => t.id === row.id)
            if (!existing) return { ...s, tasks: [...s.tasks, toTask(row)] }
            // stale echo. compare as dates, postgres and JS format the
            // fractional seconds differently so string compare lies
            if (Date.parse(existing.updated_at) >= Date.parse(row.updated_at)) return s
            return {
              ...s,
              tasks: s.tasks.map((t) => (t.id === row.id ? toTask(row, t.comment_count) : t)),
              activityTick: s.activityTick + 1,
            }
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // ---------------------------------------------------------------- tasks

  const createTask = useCallback(
    async (draft: TaskDraft) => {
      // new cards go on top of their column
      const column = stateRef.current.tasks.filter((t) => t.status === draft.status)
      const top = column.length ? Math.min(...column.map((t) => t.position)) : undefined
      const now = new Date().toISOString()

      // generate the id client side so the optimistic card and the real row
      // are the same object, no temp-id swapping later
      const optimistic: Task = {
        id: crypto.randomUUID(),
        user_id: userId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        status: draft.status,
        priority: draft.priority,
        due_date: draft.due_date,
        position: positionBetween(undefined, top),
        created_at: now,
        updated_at: now,
        comment_count: 0,
      }

      setState((s) => ({
        ...s,
        tasks: [...s.tasks, optimistic],
        assignees: draft.memberIds.length ? { ...s.assignees, [optimistic.id]: draft.memberIds } : s.assignees,
        taskLabels: draft.labelIds.length ? { ...s.taskLabels, [optimistic.id]: draft.labelIds } : s.taskLabels,
      }))

      markPending(optimistic.id, 1)
      const { comment_count: _ignored, created_at: _c, updated_at: _u, ...insertRow } = optimistic
      const { data, error } = await supabase.from('tasks').insert(insertRow).select().single()

      if (error) {
        markPending(optimistic.id, -1)
        console.error('[board] create failed', error)
        setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== optimistic.id) }))
        toast.error(`Couldn't create "${optimistic.title}". ${error.message}`)
        return null
      }

      // links can only be written once the task row exists (RLS checks it)
      const links = await Promise.all([
        draft.memberIds.length
          ? supabase
              .from('task_assignees')
              .insert(draft.memberIds.map((member_id) => ({ task_id: optimistic.id, member_id })))
          : null,
        draft.labelIds.length
          ? supabase
              .from('task_labels')
              .insert(draft.labelIds.map((label_id) => ({ task_id: optimistic.id, label_id })))
          : null,
      ])
      markPending(optimistic.id, -1)

      if (links.some((r) => r?.error)) {
        toast.error('Task created, but some assignees or labels did not save.')
      }

      const saved = toTask(data as TaskRow)
      setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === saved.id ? saved : t)) }))
      return saved
    },
    [toast, userId],
  )

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const before = stateRef.current.tasks.find((t) => t.id === id)
      if (!before) return false

      setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
      markPending(id, 1)

      const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single()
      markPending(id, -1)

      if (error) {
        console.error('[board] update failed', error)
        // only roll back the fields we touched, something else may have
        // changed in the meantime
        const rollback = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof Task]]))
        setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...rollback } : t)) }))
        toast.error(`Couldn't save changes to "${before.title}".`, {
          label: 'Retry',
          run: () => updateTask(id, patch),
        })
        return false
      }

      // don't clobber a newer optimistic edit that went out after this one
      if (!pendingWrites.current.has(id)) {
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? toTask(data as TaskRow, t.comment_count) : t)),
        }))
      }
      tick()
      return true
    },
    [toast],
  )

  const moveTask = useCallback(
    (id: string, status: Status, position: number) => updateTask(id, { status, position }),
    [updateTask],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const snapshot = stateRef.current
      const task = snapshot.tasks.find((t) => t.id === id)
      if (!task) return false

      setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) {
        setState((s) => ({ ...s, tasks: [...s.tasks, task] }))
        toast.error(`Couldn't delete "${task.title}".`)
        return false
      }
      toast.success('Task deleted')
      return true
    },
    [toast],
  )

  // ---------------------------------------------------------------- links
  // assignees and labels work the same way, so one helper handles both

  const toggleLink = useCallback(
    async (kind: 'assignees' | 'taskLabels', taskId: string, otherId: string) => {
      const table = kind === 'assignees' ? 'task_assignees' : 'task_labels'
      const column = kind === 'assignees' ? 'member_id' : 'label_id'
      const current = stateRef.current[kind][taskId] ?? []
      const has = current.includes(otherId)
      const next = has ? current.filter((x) => x !== otherId) : [...current, otherId]

      setState((s) => ({ ...s, [kind]: { ...s[kind], [taskId]: next } }))

      const { error } = has
        ? await supabase.from(table).delete().eq('task_id', taskId).eq(column, otherId)
        : await supabase.from(table).insert({ task_id: taskId, [column]: otherId })

      if (error) {
        console.error(`[board] ${table} toggle failed`, error)
        setState((s) => ({ ...s, [kind]: { ...s[kind], [taskId]: current } }))
        toast.error(kind === 'assignees' ? 'Could not update assignees.' : 'Could not update labels.')
        return
      }
      tick()
    },
    [toast],
  )

  const toggleAssignee = useCallback(
    (taskId: string, memberId: string) => toggleLink('assignees', taskId, memberId),
    [toggleLink],
  )
  const toggleLabel = useCallback(
    (taskId: string, labelId: string) => toggleLink('taskLabels', taskId, labelId),
    [toggleLink],
  )

  // ---------------------------------------------------------------- team + labels

  const addMember = useCallback(
    async (name: string, color: string) => {
      const { data, error } = await supabase
        .from('team_members')
        .insert({ name: name.trim(), color })
        .select('id, name, color, created_at')
        .single()
      if (error) {
        toast.error(`Couldn't add ${name}. ${error.message}`)
        return null
      }
      setState((s) => ({ ...s, members: [...s.members, data as Member] }))
      return data as Member
    },
    [toast],
  )

  const removeMember = useCallback(
    async (id: string) => {
      const before = stateRef.current
      // cascades on the db side, mirror that locally
      setState((s) => ({
        ...s,
        members: s.members.filter((m) => m.id !== id),
        assignees: Object.fromEntries(Object.entries(s.assignees).map(([k, v]) => [k, v.filter((x) => x !== id)])),
      }))
      const { error } = await supabase.from('team_members').delete().eq('id', id)
      if (error) {
        setState((s) => ({ ...s, members: before.members, assignees: before.assignees }))
        toast.error('Could not remove that team member.')
      }
    },
    [toast],
  )

  const addLabel = useCallback(
    async (name: string, color: string) => {
      const { data, error } = await supabase
        .from('labels')
        .insert({ name: name.trim(), color })
        .select('id, name, color, created_at')
        .single()
      if (error) {
        // 23505 = unique violation on (user_id, name)
        toast.error(error.code === '23505' ? `You already have a "${name}" label.` : `Couldn't add label. ${error.message}`)
        return null
      }
      setState((s) => ({ ...s, labels: [...s.labels, data as Label] }))
      return data as Label
    },
    [toast],
  )

  const removeLabel = useCallback(
    async (id: string) => {
      const before = stateRef.current
      setState((s) => ({
        ...s,
        labels: s.labels.filter((l) => l.id !== id),
        taskLabels: Object.fromEntries(Object.entries(s.taskLabels).map(([k, v]) => [k, v.filter((x) => x !== id)])),
      }))
      const { error } = await supabase.from('labels').delete().eq('id', id)
      if (error) {
        setState((s) => ({ ...s, labels: before.labels, taskLabels: before.taskLabels }))
        toast.error('Could not delete that label.')
      }
    },
    [toast],
  )

  const adjustCommentCount = useCallback((taskId: string, delta: number) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, comment_count: Math.max(0, t.comment_count + delta) } : t)),
    }))
  }, [])

  // ---------------------------------------------------------------- sample data

  const loadSampleBoard = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const sample = buildSampleBoard()
      // order matters here because of the foreign keys
      const steps = [
        () => supabase.from('team_members').insert(sample.members),
        () => supabase.from('labels').insert(sample.labels),
        () => supabase.from('tasks').insert(sample.tasks),
        () => supabase.from('task_assignees').insert(sample.assignees),
        () => supabase.from('task_labels').insert(sample.taskLabels),
        () => supabase.from('comments').insert(sample.comments),
      ]
      for (const step of steps) {
        const { error } = await step()
        if (error) throw error
      }
      toast.success('Sample board loaded')
    } catch (err) {
      console.error('[board] sample seed failed', err)
      toast.error('Could not load the sample board. Try again in a moment.')
    }
    await reload()
  }, [reload, toast])

  const api = useMemo<BoardApi>(
    () => ({
      ...state,
      reload,
      createTask,
      updateTask,
      moveTask,
      deleteTask,
      toggleAssignee,
      toggleLabel,
      addMember,
      removeMember,
      addLabel,
      removeLabel,
      adjustCommentCount,
      loadSampleBoard,
    }),
    [
      state,
      reload,
      createTask,
      updateTask,
      moveTask,
      deleteTask,
      toggleAssignee,
      toggleLabel,
      addMember,
      removeMember,
      addLabel,
      removeLabel,
      adjustCommentCount,
      loadSampleBoard,
    ],
  )

  return <BoardContext.Provider value={api}>{children}</BoardContext.Provider>
}

export function useBoard() {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoard must be used inside <BoardProvider>')
  return ctx
}
