import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { COLUMNS, STATUS_LABEL, type Status } from '../lib/types'
import { Popover } from './Popover'

export function StatusMenu({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={190}
      label="Change status"
      anchor={
        <button
          type="button"
          className={`status-btn status-btn--${value}`}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-label={`Status: ${STATUS_LABEL[value]}`}
        >
          <span className="status-btn__dot" aria-hidden />
          {STATUS_LABEL[value]}
          <ChevronDown size={14} aria-hidden />
        </button>
      }
    >
      <ul className="picker__list">
        {COLUMNS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`picker__row status-row status-row--${c.id}${c.id === value ? ' is-on' : ''}`}
              onClick={() => {
                onChange(c.id)
                setOpen(false)
              }}
            >
              <span className="status-row__dot" aria-hidden />
              <span className="picker__name">{c.title}</span>
              {c.id === value && <Check size={14} className="picker__check" />}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  )
}

export function PrioritySegment({
  value,
  onChange,
}: {
  value: 'low' | 'normal' | 'high'
  onChange: (p: 'low' | 'normal' | 'high') => void
}) {
  return (
    <div className="segment" role="radiogroup" aria-label="Priority">
      {(['low', 'normal', 'high'] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          className={`segment__opt segment__opt--${p}${value === p ? ' is-on' : ''}`}
          onClick={() => onChange(p)}
        >
          {p[0].toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  )
}
