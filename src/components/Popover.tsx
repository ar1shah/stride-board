import { useRef, type ReactNode } from 'react'
import { useDismiss } from '../hooks/useDismiss'

interface PopoverProps {
  open: boolean
  onClose: () => void
  anchor: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
  width?: number
  label?: string
}

// Tiny popover. Positions itself under the anchor with plain CSS, which is
// good enough for everything in this app (no floating-ui needed).
export function Popover({ open, onClose, anchor, children, align = 'start', width = 240, label }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, onClose)

  return (
    <div className="popover-wrap" ref={ref}>
      {anchor}
      {open && (
        <div
          className={`popover popover--${align}`}
          style={{ width }}
          role="dialog"
          aria-label={label}
        >
          {children}
        </div>
      )}
    </div>
  )
}
