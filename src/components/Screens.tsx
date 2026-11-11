import { AlertTriangle, LayoutGrid, Plus, RefreshCw } from 'lucide-react'
import { COLUMNS } from '../lib/types'

// Full-page states: first load, fatal errors, and the "brand new board" welcome.

export function SplashScreen({ message = 'Setting up your board' }: { message?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash__mark" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p>{message}</p>
    </div>
  )
}

export function ErrorScreen({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="splash splash--error" role="alert">
      <AlertTriangle size={28} />
      <h1>{title}</h1>
      <p>{message}</p>
      <button className="btn btn--primary" onClick={onRetry}>
        <RefreshCw size={15} /> Try again
      </button>
    </div>
  )
}

export function BoardSkeleton() {
  // roughly matches a real board so nothing jumps when data lands
  const shape = [3, 2, 1, 2]
  return (
    <div className="board board--skeleton" aria-hidden>
      {COLUMNS.map((c, i) => (
        <section key={c.id} className={`lane lane--${c.id}`}>
          <header className="lane__head">
            <span className="lane__dot" />
            <span className="sk sk--text" style={{ width: 80 }} />
          </header>
          <div className="lane__list">
            {Array.from({ length: shape[i] }).map((_, j) => (
              <div key={j} className="card card--skeleton">
                <span className="sk sk--text" style={{ width: `${70 - j * 12}%` }} />
                <span className="sk sk--text sk--short" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function WelcomeCard({ onNewTask, onLoadSample }: { onNewTask: () => void; onLoadSample: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome__art" aria-hidden>
        {COLUMNS.map((c, i) => (
          <span key={c.id} className={`welcome__col welcome__col--${c.id}`} style={{ height: 28 + (3 - i) * 14 }} />
        ))}
      </div>
      <div className="welcome__copy">
        <h2>This board is all yours</h2>
        <p>
          Add a task to get going, or load a sample board to see how cards, teammates and labels fit together. Want a
          clean slate later? Start a new guest session from the sidebar.
        </p>
      </div>
      <div className="welcome__actions">
        <button className="btn btn--primary" onClick={onNewTask}>
          <Plus size={16} /> Add your first task
        </button>
        <button className="btn btn--ghost" onClick={onLoadSample}>
          <LayoutGrid size={15} /> Load sample board
        </button>
      </div>
    </div>
  )
}
