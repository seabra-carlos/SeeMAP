import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim()
// Only public client keys are supported. Never put a service_role or secret key here.
export const isSupabaseConfigured = Boolean(url && key && /^https:\/\//.test(url) && key.startsWith('sb_publishable_'))
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
