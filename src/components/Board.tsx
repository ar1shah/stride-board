import { useCallback, useMemo, useRef, useState } from 'react'
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { needsRebalance, positionBetween, rebalance } from '../lib/position'
import { COLUMNS, type Label, type Member, type Status, type Task } from '../lib/types'
import type { FilterApi } from '../hooks/useFilters'
import { useBoard } from '../state/BoardContext'
import { Column } from './Column'
import { CardBody } from './TaskCard'

type Lanes = Record<Status, string[]>

const STATUS_IDS = COLUMNS.map((c) => c.id) as UniqueIdentifier[]
const isColumn = (id: UniqueIdentifier) => STATUS_IDS.includes(id)

interface BoardProps {
  filters: FilterApi
  onOpenTask: (id: string) => void
}

export function Board({ filters, onOpenTask }: BoardProps) {
  const { tasks, members, labels, assignees, taskLabels, moveTask, createTask } = useBoard()

  // ---------------------------------------------------------------- lookups

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])

  const membersFor = useCallback(
    (taskId: string) => (assignees[taskId] ?? []).map((id) => membersById.get(id)).filter(Boolean) as Member[],
    [assignees, membersById],
  )
  const labelsFor = useCallback(
    (taskId: string) => (taskLabels[taskId] ?? []).map((id) => labelsById.get(id)).filter(Boolean) as Label[],
    [taskLabels, labelsById],
  )

  // the "real" lanes, straight from state, filtered + sorted by position
  const lanes = useMemo<Lanes>(() => {
    const out: Lanes = { todo: [], in_progress: [], in_review: [], done: [] }
    const sorted = [...tasks].sort((a, b) => a.position - b.position)
    for (const t of sorted) {
      if (filters.matches(t, assignees[t.id], taskLabels[t.id])) out[t.status].push(t.id)
    }
    return out
  }, [tasks, assignees, taskLabels, filters])

  const totals = useMemo(() => {
    const out: Record<Status, number> = { todo: 0, in_progress: 0, in_review: 0, done: 0 }
    for (const t of tasks) out[t.status]++
    return out
  }, [tasks])

  // ---------------------------------------------------------------- dnd state
  // While dragging we work off a local copy of the lanes so cards can hop
  // between columns as you hover. Nothing hits the database until drop.

  const [dragLanes, setDragLanes] = useState<Lanes | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const shown = dragLanes ?? lanes
  const shownRef = useRef(shown)
  shownRef.current = shown

  // browsers fire a click on pointerup, which would open the panel right
  // after you drop a card. ignore clicks that land right after a drag.
  const lastDragEnd = useRef(0)
  const openTask = useCallback(
    (id: string) => {
      if (Date.now() - lastDragEnd.current < 200) return
      onOpenTask(id)
    },
    [onOpenTask],
  )

  const sensors = useSensors(
    // 6px of movement before it counts as a drag, so plain clicks still work
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // long-press on touch, otherwise you can't scroll the board on a phone
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findLane = (id: UniqueIdentifier): Status | undefined => {
    if (isColumn(id)) return id as Status
    const current = shownRef.current
    return (Object.keys(current) as Status[]).find((s) => current[s].includes(id as string))
  }

  // Kanban-flavoured collision detection: whatever card is under the pointer
  // wins; if the pointer is over a column's empty space, snap to the nearest
  // card in that column (or the column itself if it's empty).
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const underPointer = pointerWithin(args)
    const hits = underPointer.length > 0 ? underPointer : rectIntersection(args)

    const card = hits.find((h) => !isColumn(h.id))
    if (card) return [card]

    const lane = hits.find((h) => isColumn(h.id))
    if (lane) {
      const ids = shownRef.current[lane.id as Status]
      if (ids.length > 0) {
        const nearest = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) => ids.includes(c.id as string)),
        })
        if (nearest.length > 0) return nearest
      }
      return [lane]
    }

    return closestCorners(args)
  }, [])

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string)
    setDragLanes(lanes)
  }

  // moving across columns happens here (live, while hovering)
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = findLane(active.id)
    const to = findLane(over.id)
    if (!from || !to || from === to) return

    setDragLanes((prev) => {
      const base = prev ?? lanes
      const source = base[from].filter((id) => id !== active.id)
      const target = [...base[to]]

      let index = target.length
      if (!isColumn(over.id)) {
        const overIndex = target.indexOf(over.id as string)
        // drop below the hovered card if we're past its middle
        const activeTop = active.rect.current.translated?.top ?? 0
        const below = activeTop > over.rect.top + over.rect.height / 2
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length
      }
      target.splice(index, 0, active.id as string)
      return { ...base, [from]: source, [to]: target }
    })
  }

  // reordering inside a column + persisting happens here
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    lastDragEnd.current = Date.now()
    const id = active.id as string
    const finalLanes = shownRef.current
    setActiveId(null)

    const lane = findLane(id)
    if (!over || !lane) {
      setDragLanes(null)
      return
    }

    let order = finalLanes[lane]
    if (!isColumn(over.id) && findLane(over.id) === lane) {
      const oldIndex = order.indexOf(id)
      const newIndex = order.indexOf(over.id as string)
      if (oldIndex !== newIndex) order = arrayMove(order, oldIndex, newIndex)
    }

    // keep showing the dropped order until state catches up (it's optimistic
    // so that's basically the same frame)
    setDragLanes(null)

    const task = tasksById.get(id)
    if (!task) return

    const index = order.indexOf(id)
    const before = tasksById.get(order[index - 1])?.position
    const after = tasksById.get(order[index + 1])?.position

    // same column, same neighbours -> nothing to do
    const original = lanes[task.status]
    const origIndex = original.indexOf(id)
    if (lane === task.status && original[origIndex - 1] === order[index - 1] && original[origIndex + 1] === order[index + 1]) {
      return
    }

    if (needsRebalance(before, after)) {
      // ran out of float precision between these two. renumber the column.
      const fixed = rebalance(order.map((tid) => ({ id: tid })))
      fixed.forEach(({ id: tid, position }) => {
        if (tid === id) moveTask(tid, lane, position)
        else moveTask(tid, tasksById.get(tid)!.status, position)
      })
      return
    }

    moveTask(id, lane, positionBetween(before, after))
  }

  const handleDragCancel = () => {
    lastDragEnd.current = Date.now()
    setActiveId(null)
    setDragLanes(null)
  }

  const quickAdd = useCallback(
    (status: Status, title: string) =>
      createTask({ title, description: '', status, priority: 'normal', due_date: null, memberIds: [], labelIds: [] }),
    [createTask],
  )

  const activeTask = activeId ? tasksById.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${tasksById.get(active.id as string)?.title ?? 'task'}.`,
          onDragOver: ({ over }) => (over ? `Over ${columnName(findLane(over.id))}.` : 'Not over a column.'),
          onDragEnd: ({ over }) => (over ? `Dropped in ${columnName(findLane(over.id))}.` : 'Dropped.'),
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="board" role="region" aria-label="Task board">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            hint={col.hint}
            tasks={shown[col.id].map((id) => tasksById.get(id)).filter(Boolean) as Task[]}
            totalInColumn={totals[col.id]}
            membersFor={membersFor}
            labelsFor={labelsFor}
            onOpen={openTask}
            onQuickAdd={quickAdd}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {activeTask ? (
          <div className="card card--overlay">
            <CardBody task={activeTask} members={membersFor(activeTask.id)} labels={labelsFor(activeTask.id)} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function columnName(status?: Status) {
  return COLUMNS.find((c) => c.id === status)?.title ?? 'the board'
}
