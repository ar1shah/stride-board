import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

type ToastKind = 'error' | 'success'

interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; run: () => void }
}

interface ToastApi {
  error: (message: string, action?: Toast['action']) => void
  success: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string, action?: Toast['action']) => {
      const id = nextId.current++
      // cap at 3 so a flaky connection doesn't bury the screen
      setToasts((list) => [...list.slice(-2), { id, kind, message, action }])
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3000)
    },
    [dismiss],
  )

  const api = useRef<ToastApi>({
    error: (m, a) => push('error', m, a),
    success: (m) => push('success', m),
  })

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="toasts" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span className="toast__msg">{t.message}</span>
            {t.action && (
              <button
                className="toast__action"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="icon-btn icon-btn--sm" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
