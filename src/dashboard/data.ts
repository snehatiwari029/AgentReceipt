import { useEffect, useState } from 'react'
import { supabase } from '../shared/supabase'

export type Rows<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: T[] }

// Reads a whole table or view from Supabase, live. No fallback data: an empty table is shown as empty.
export function useRows<T>(table: string, orderBy: string, ascending: boolean): Rows<T> {
  const [state, setState] = useState<Rows<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!supabase) {
      setState({
        status: 'error',
        message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      })
      return
    }
    supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
      .then(
        ({ data, error }) => {
          if (cancelled) return
          if (error) setState({ status: 'error', message: error.message })
          else setState({ status: 'ready', rows: (data ?? []) as T[] })
        },
        (err: unknown) => {
          if (cancelled) return
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Network error' })
        },
      )
    return () => {
      cancelled = true
    }
  }, [table, orderBy, ascending])

  return state
}

// Safe readers for the free-form JSON columns (action_summary, terms_snapshot).
export function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}
export function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
