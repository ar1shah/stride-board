import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// React StrictMode runs effects twice in dev, which was creating two anonymous
// users on first load. Share one in-flight request so that can't happen.
let pendingSignIn: Promise<{ id: string }> | null = null

function signInGuestOnce() {
  if (!pendingSignIn) {
    pendingSignIn = supabase.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error) throw error
        if (!data.user) throw new Error('Supabase did not return a user.')
        return data.user
      })
      .finally(() => {
        pendingSignIn = null
      })
  }
  return pendingSignIn
}

type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string }
  | { status: 'error'; message: string }

/**
 * Makes sure there's always a signed-in user. On first visit we create an
 * anonymous Supabase user, after that supabase-js keeps the session in
 * localStorage so the same guest comes back to the same board.
 */
export function useGuestSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  const ensureSession = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error

      if (data.session) {
        setState({ status: 'ready', userId: data.session.user.id })
        return
      }

      const user = await signInGuestOnce()
      setState({ status: 'ready', userId: user.id })
    } catch (err) {
      console.error('[auth] guest sign-in failed', err)
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not start a guest session.',
      })
    }
  }, [])

  useEffect(() => {
    ensureSession()

    // if the refresh token dies (cleared storage in another tab etc) just
    // spin up a new guest instead of leaving the app in a broken state
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') ensureSession()
      else if (session) setState({ status: 'ready', userId: session.user.id })
    })
    return () => sub.subscription.unsubscribe()
  }, [ensureSession])

  // Throw away this guest and start a brand new (empty) one. Handy for
  // showing that two guests can't see each other's boards.
  const startOver = useCallback(async () => {
    setState({ status: 'loading' })
    await supabase.auth.signOut()
    // onAuthStateChange picks it up from here
  }, [])

  return { ...state, retry: ensureSession, startOver }
}
