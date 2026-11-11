import { useCallback, useEffect, useRef, useState } from 'react'
import { missingEnv } from './lib/supabase'
import { useFilters } from './hooks/useFilters'
import { useGuestSession } from './hooks/useGuestSession'
import { BoardProvider, useBoard } from './state/BoardContext'
import { Board } from './components/Board'
import { NewTaskDialog } from './components/NewTaskDialog'
import { BoardSkeleton, ErrorScreen, SplashScreen, WelcomeCard } from './components/Screens'
import { Sidebar } from './components/Sidebar'
import { StrideBar } from './components/StrideBar'
import { TaskPanel } from './components/TaskPanel'
import { Toolbar } from './components/Toolbar'

export default function App() {
  const session = useGuestSession()

  if (missingEnv) {
    return (
      <ErrorScreen
        title="Missing Supabase config"
        message="Copy .env.example to .env.local and add your project URL and anon key, then restart the dev server."
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (session.status === 'loading') return <SplashScreen />

  if (session.status === 'error') {
    return (
      <ErrorScreen
        title="Couldn't start your session"
        message={`${session.message} Check your connection and try again.`}
        onRetry={session.retry}
      />
    )
  }

  // keyed by user so "new guest session" wipes all board state cleanly
  return (
    <BoardProvider key={session.userId} userId={session.userId}>
      <Workspace userId={session.userId} onStartOver={session.startOver} />
    </BoardProvider>
  )
}

function Workspace({ userId, onStartOver }: { userId: string; onStartOver: () => void }) {
  const board = useBoard()
  const filters = useFilters()
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const closePanel = useCallback(() => setOpenTaskId(null), [])
  const closeDialog = useCallback(() => setCreating(false), [])

  // N = new task, / = search. skipped while typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setCreating(true)
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const firstLoad = board.loading && board.tasks.length === 0
  const isEmpty = !board.loading && !board.loadError && board.tasks.length === 0

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userId={userId}
        filters={filters}
        onStartOver={onStartOver}
      />

      <main className="main">
        <Toolbar
          ref={searchRef}
          filters={filters}
          onNewTask={() => setCreating(true)}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <StrideBar overdueOnly={filters.filters.overdueOnly} onToggleOverdue={filters.toggleOverdue} />

        {board.loadError ? (
          <div className="inline-error" role="alert">
            <strong>Your board didn't load.</strong> {board.loadError}
            <button className="btn btn--sm btn--primary" onClick={board.reload}>
              Try again
            </button>
          </div>
        ) : firstLoad ? (
          <BoardSkeleton />
        ) : (
          <>
            {isEmpty && <WelcomeCard onNewTask={() => setCreating(true)} onLoadSample={board.loadSampleBoard} />}
            <Board filters={filters} onOpenTask={setOpenTaskId} />
          </>
        )}
      </main>

      {openTaskId && <TaskPanel taskId={openTaskId} onClose={closePanel} />}
      {creating && <NewTaskDialog onClose={closeDialog} />}
    </div>
  )
}
