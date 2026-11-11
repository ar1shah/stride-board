import { X } from 'lucide-react'
import { tint } from '../lib/colors'
import type { Label } from '../lib/types'

export function LabelChip({ label, onRemove }: { label: Label; onRemove?: () => void }) {
  return (
    <span className="chip" style={{ background: tint(label.color, 0.12), color: label.color }}>
      <span className="chip__dot" style={{ background: label.color }} />
      <span className="chip__text">{label.name}</span>
      {onRemove && (
        <button className="chip__remove" aria-label={`Remove ${label.name}`} onClick={onRemove}>
          <X size={11} />
        </button>
      )}
    </span>
  )
}
