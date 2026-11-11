import { forwardRef, useState } from 'react'
import { ChevronDown, Menu, Plus, Search, X } from 'lucide-react'
import type { FilterApi } from '../hooks/useFilters'
import { PRIORITY_LABEL, type Priority } from '../lib/types'
import { useBoard } from '../state/BoardContext'
import { Avatar, AvatarStack } from './Avatar'
import { Popover } from './Popover'
import { PriorityIcon } from './TaskMeta'

interface ToolbarProps {
  filters: FilterApi
  onNewTask: () => void
  onOpenSidebar: () => void
}

const PRIORITIES: Priority[] = ['high', 'normal', 'low']

export const Toolbar = forwardRef<HTMLInputElement, ToolbarProps>(function Toolbar(
  { filters, onNewTask, onOpenSidebar },
  searchRef,
) {
  const { members, labels } = useBoard()
  const [menu, setMenu] = useState<'priority' | 'assignee' | 'label' | null>(null)
  const close = () => setMenu(null)
  const f = filters.filters

  return (
    <header className="topbar">
      <div className="topbar__row">
        <button className="icon-btn topbar__menu" aria-label="Open sidebar" onClick={onOpenSidebar}>
          <Menu size={18} />
        </button>
        <h1 className="topbar__title">Team board</h1>
        <AvatarStack members={members} max={4} size="sm" />
        <div className="topbar__spacer" />
        <button className="btn btn--primary" onClick={onNewTask} title="New task (N)">
          <Plus size={16} />
          <span>New task</span>
        </button>
      </div>

      <div className="filters" role="search">
        <label className="search">
          <Search size={15} aria-hidden />
          <input
            ref={searchRef}
            value={f.query}
            onChange={(e) => filters.setQuery(e.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks by title"
          />
          {f.query ? (
            <button className="icon-btn icon-btn--sm" aria-label="Clear search" onClick={() => filters.setQuery('')}>
              <X size={13} />
            </button>
          ) : (
            <kbd className="search__kbd">/</kbd>
          )}
        </label>

        <Popover
          open={menu === 'priority'}
          onClose={close}
          label="Filter by priority"
          width={200}
          anchor={
            <FilterButton active={f.priorities.length} onClick={() => setMenu(menu === 'priority' ? null : 'priority')}>
              Priority
            </FilterButton>
          }
        >
          <ul className="picker__list">
            {PRIORITIES.map((p) => (
              <li key={p}>
                <button
                  className={`picker__row${f.priorities.includes(p) ? ' is-on' : ''}`}
                  aria-pressed={f.priorities.includes(p)}
                  onClick={() => filters.togglePriority(p)}
                >
                  <PriorityIcon priority={p} />
                  <span className="picker__name">{PRIORITY_LABEL[p]}</span>
                  <Tick on={f.priorities.includes(p)} />
                </button>
              </li>
            ))}
          </ul>
        </Popover>

        <Popover
          open={menu === 'assignee'}
          onClose={close}
          label="Filter by assignee"
          anchor={
            <FilterButton active={f.memberIds.length} onClick={() => setMenu(menu === 'assignee' ? null : 'assignee')}>
              Assignee
            </FilterButton>
          }
        >
          {members.length === 0 ? (
            <p className="picker__empty">Add teammates from the sidebar to filter by them.</p>
          ) : (
            <ul className="picker__list">
              {members.map((m) => (
                <li key={m.id}>
                  <button
                    className={`picker__row${f.memberIds.includes(m.id) ? ' is-on' : ''}`}
                    aria-pressed={f.memberIds.includes(m.id)}
                    onClick={() => filters.toggleMember(m.id)}
                  >
                    <Avatar member={m} size="xs" />
                    <span className="picker__name">{m.name}</span>
                    <Tick on={f.memberIds.includes(m.id)} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>

        <Popover
          open={menu === 'label'}
          onClose={close}
          label="Filter by label"
          anchor={
            <FilterButton active={f.labelIds.length} onClick={() => setMenu(menu === 'label' ? null : 'label')}>
              Label
            </FilterButton>
          }
        >
          {labels.length === 0 ? (
            <p className="picker__empty">No labels yet. Create them from a task or the sidebar.</p>
          ) : (
            <ul className="picker__list">
              {labels.map((l) => (
                <li key={l.id}>
                  <button
                    className={`picker__row${f.labelIds.includes(l.id) ? ' is-on' : ''}`}
                    aria-pressed={f.labelIds.includes(l.id)}
                    onClick={() => filters.toggleLabel(l.id)}
                  >
                    <span className="picker__swatch" style={{ background: l.color }} />
                    <span className="picker__name">{l.name}</span>
                    <Tick on={f.labelIds.includes(l.id)} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>

        {filters.active && (
          <button className="btn btn--ghost btn--sm" onClick={filters.clear}>
            Clear filters
          </button>
        )}
      </div>
    </header>
  )
})

function FilterButton({ active, onClick, children }: { active: number; onClick: () => void; children: string }) {
  return (
    <button className={`filter-btn${active ? ' is-active' : ''}`} onClick={onClick} aria-haspopup="dialog">
      {children}
      {active > 0 && <span className="filter-btn__count">{active}</span>}
      <ChevronDown size={14} aria-hidden />
    </button>
  )
}

function Tick({ on }: { on: boolean }) {
  return <span className={`tick${on ? ' is-on' : ''}`} aria-hidden />
}
