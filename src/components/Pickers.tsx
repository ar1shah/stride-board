import { useState, type FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { randomSwatch } from '../lib/colors'
import { useBoard } from '../state/BoardContext'
import { Avatar } from './Avatar'

interface PickerProps {
  selected: string[]
  onToggle: (id: string) => void
}

/**
 * Checklist of team members. You can also add someone new right from here,
 * which saves a trip to the sidebar when you're mid-way through a task.
 */
export function MemberPicker({ selected, onToggle }: PickerProps) {
  const { members, addMember } = useBoard()
  const [name, setName] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const created = await addMember(name, randomSwatch())
    if (created) {
      onToggle(created.id)
      setName('')
    }
  }

  return (
    <div className="picker">
      {members.length === 0 && <p className="picker__empty">No teammates yet. Add one below.</p>}
      <ul className="picker__list" role="listbox" aria-multiselectable="true" aria-label="Assignees">
        {members.map((m) => {
          const on = selected.includes(m.id)
          return (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                className={`picker__row${on ? ' is-on' : ''}`}
                onClick={() => onToggle(m.id)}
              >
                <Avatar member={m} size="xs" />
                <span className="picker__name">{m.name}</span>
                {on && <Check size={14} className="picker__check" />}
              </button>
            </li>
          )
        })}
      </ul>
      <form className="picker__add" onSubmit={submit}>
        <Plus size={14} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add teammate" maxLength={60} />
      </form>
    </div>
  )
}

export function LabelPicker({ selected, onToggle }: PickerProps) {
  const { labels, addLabel } = useBoard()
  const [name, setName] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const created = await addLabel(name, randomSwatch())
    if (created) {
      onToggle(created.id)
      setName('')
    }
  }

  return (
    <div className="picker">
      {labels.length === 0 && <p className="picker__empty">No labels yet. Try "Bug" or "Design".</p>}
      <ul className="picker__list" role="listbox" aria-multiselectable="true" aria-label="Labels">
        {labels.map((l) => {
          const on = selected.includes(l.id)
          return (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                className={`picker__row${on ? ' is-on' : ''}`}
                onClick={() => onToggle(l.id)}
              >
                <span className="picker__swatch" style={{ background: l.color }} />
                <span className="picker__name">{l.name}</span>
                {on && <Check size={14} className="picker__check" />}
              </button>
            </li>
          )
        })}
      </ul>
      <form className="picker__add" onSubmit={submit}>
        <Plus size={14} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New label" maxLength={32} />
      </form>
    </div>
  )
}
