import { createClient } from '@supabase/supabase-js'

// Create a single Supabase client for interacting with your database
export const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
)
