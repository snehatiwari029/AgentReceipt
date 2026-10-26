import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

export type ProductsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; products: Product[] }

// Reads the live products table. There is deliberately no fallback data:
// an empty table is shown as empty, a failed read is shown as an error.
export function useProducts(): ProductsState {
  const [state, setState] = useState<ProductsState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    if (!supabase) {
      setState({
        status: 'error',
        message:
          'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.',
      })
      return
    }

    supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(
        ({ data, error }) => {
          if (cancelled) return
          if (error) setState({ status: 'error', message: error.message })
          else setState({ status: 'ready', products: (data ?? []) as Product[] })
        },
        (err: unknown) => {
          if (cancelled) return
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Network error' })
        },
      )

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
