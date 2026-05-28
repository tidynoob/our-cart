import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    worker: true, // heartbeat via Web Worker — survives browser timer throttling (D-07/SYNC-02)
  },
  auth: {
    flowType: 'pkce', // PKCE is Supabase default; explicit for clarity (D-12)
    detectSessionInUrl: true,
  },
})
