import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Fail loudly in dev if someone forgot the .env file, otherwise you just get
// a confusing "Invalid URL" deep inside supabase-js.
export const missingEnv = !url || !anonKey

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // keep the key name stable so the guest session survives deploys
    storageKey: 'stride.auth',
  },
})
