import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Keys come from environment variables only (see .env.example). Nothing is hard-coded.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
