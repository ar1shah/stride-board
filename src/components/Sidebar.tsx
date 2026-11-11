import { useState, type FormEvent } from 'react'
import { Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { SWATCHES } from '../lib/colors'
import type { FilterApi } from '../hooks/useFilters'
import { useBoard } from '../state/BoardContext'
import { Avatar } from './Avatar'

interface SidebarProps {
  open: boolean
  onClose: () => void
  userId: string
  filters: FilterApi
  onStartOver: () => void
}

export function Sidebar({ open, onClose, userId, filters, onStartOver }: SidebarProps) {
  const { members, labels, taskLabels, assignees, addMember, removeMember, addLabel, removeLabel } = useBoard()
  const [confirmReset, setConfirmReset] = useState(false)

  // how many cards use each label / member, shown next to the name
  const countFor = (map: Record<string, string[]>, id: string) =>
    Object.values(map).reduce((n, ids) => n + (ids.includes(id) ? 1 : 0), 0)

  return (
    <>
      <div className={`scrim${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="Team and labels">
        <div className="sidebar__brand">
          <img src="/favicon.svg" alt="" width={26} height={26} />
          <span>Stride</span>
          <button className="icon-btn sidebar__close" aria-label="Close sidebar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <section className="side-section">
          <h3 className="side-section__title">Team</h3>
          <ul className="side-list">
            {members.map((m) => (
              <li key={m.id} className="side-item">
                <button
                  className={`side-item__main${filters.filters.memberIds.includes(m.id) ? ' is-on' : ''}`}
                  onClick={() => filters.toggleMember(m.id)}
                  title={`Show tasks assigned to ${m.name}`}
                >
                  <Avatar member={m} size="xs" />
                  <span className="side-item__name">{m.name}</span>
                  <span className="side-item__count">{countFor(assignees, m.id) || ''}</span>
                </button>
                <button className="icon-btn icon-btn--sm side-item__del" aria-label={`Remove ${m.name}`} onClick={() => removeMember(m.id)}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
          <AddRow placeholder="Add teammate" maxLength={60} onAdd={addMember} />
        </section>

        <section className="side-section">
          <h3 className="side-section__title">Labels</h3>
          <ul className="side-list">
            {labels.map((l) => (
              <li key={l.id} className="side-item">
                <button
                  className={`side-item__main${filters.filters.labelIds.includes(l.id) ? ' is-on' : ''}`}
                  onClick={() => filters.toggleLabel(l.id)}
                  title={`Filter by ${l.name}`}
                >
                  <span className="side-item__swatch" style={{ background: l.color }} />
                  <span className="side-item__name">{l.name}</span>
                  <span className="side-item__count">{countFor(taskLabels, l.id) || ''}</span>
                </button>
                <button className="icon-btn icon-btn--sm side-item__del" aria-label={`Delete label ${l.name}`} onClick={() => removeLabel(l.id)}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
          <AddRow placeholder="New label" maxLength={32} onAdd={addLabel} />
        </section>

        <footer className="sidebar__foot">
          <p className="guest">
            <span className="guest__dot" aria-hidden />
            Guest session <code title={userId}>{userId.slice(0, 8)}</code>
          </p>
          <p className="guest__note">Your board is private to this browser. Nobody else can see it.</p>
          {confirmReset ? (
            <div className="confirm">
              <span>Start a new empty board? This one stays tied to the old guest.</span>
              <div className="confirm__actions">
                <button className="btn btn--sm btn--danger" onClick={onStartOver}>
                  Start over
                </button>
                <button className="btn btn--sm btn--ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn--ghost btn--sm guest__reset" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={13} /> New guest session
            </button>
          )}
        </footer>
      </aside>
    </>
  )
}

// inline "+ add" row with a color picker. shared by team + labels.
function AddRow({
  placeholder,
  maxLength,
  onAdd,
}: {
  placeholder: string
  maxLength: number
  onAdd: (name: string, color: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[1])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd(name, color)
    setName('')
    // rotate the color so the next one isn't the same by accident
    setColor(SWATCHES[(SWATCHES.indexOf(color) + 1) % SWATCHES.length])
  }

  if (!open) {
    return (
      <button className="side-add" onClick={() => setOpen(true)}>
        <Plus size={14} /> {placeholder}
      </button>
    )
  }

  return (
    <form className="side-form" onSubmit={submit}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        aria-label={placeholder}
      />
      <div className="swatches" role="radiogroup" aria-label="Color">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={c}
            className={`swatch${c === color ? ' is-on' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="side-form__actions">
        <button className="btn btn--sm btn--primary" type="submit" disabled={!name.trim()}>
          Add
        </button>
        <button className="btn btn--sm btn--ghost" type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </form>
  )
}
