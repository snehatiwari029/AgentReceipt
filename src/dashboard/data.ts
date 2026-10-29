import { useEffect, useState } from 'react'
import type { ChainRecord } from '../shared/chain'
import { supabase } from '../shared/supabase'

export type Rows<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: T[] }

// Reads a whole table or view from Supabase, live. No fallback data: an empty table is shown as empty.
// Changing `reload` reads the table again (used after the Optimization page writes through its edge function).
export function useRows<T>(table: string, orderBy: string, ascending: boolean, reload = 0): Rows<T> {
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
  }, [table, orderBy, ascending, reload])

  return state
}

// Safe readers for the free-form JSON columns (action_summary, terms_snapshot).
export function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}
export function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// One disputed order's chain records only, read by id: its grant, proposal, actions and receipt (the receipt row is
// passed in, as already read), plus its shipment, merchant review records and the dispute's own events. For a chain
// entry just before one of them that belongs to another order, only that entry's hash is read, from the chain_entries
// view; never its contents.
export async function loadOrderChain(
  receipt: Record<string, unknown> & { chain_seq: number; prev_hash: string; entry_hash: string },
  disputeId?: string,
): Promise<{
  records: ChainRecord[]
  hashAt: (chainSeq: number) => string | null
}> {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  const db = supabase
  type Raw = Record<string, unknown> & { chain_seq: number; prev_hash: string; entry_hash: string }
  const rows = async (table: string, column: string, value: unknown): Promise<Raw[]> => {
    if (typeof value !== 'string') return []
    const { data, error } = await db.from(table).select('*').eq(column, value)
    if (error) throw new Error(error.message)
    return (data ?? []) as Raw[]
  }
  const [grants, proposals, actions, shipments, reviews, events] = await Promise.all([
    rows('grants', 'id', receipt.grant_id), rows('proposals', 'id', receipt.proposal_id), rows('actions', 'grant_id', receipt.grant_id),
    disputeId ? rows('shipments', 'receipt_id', receipt.id) : [], disputeId ? rows('merchant_reviews', 'receipt_id', receipt.id) : [],
    disputeId ? rows('dispute_events', 'dispute_id', disputeId) : [],
  ])
  const records: ChainRecord[] = [
    ...grants.map((row) => ({ chain_seq: row.chain_seq, entry_type: 'grant' as const, row })),
    ...proposals.map((row) => ({ chain_seq: row.chain_seq, entry_type: 'proposal' as const, row })),
    ...actions.map((row) => ({ chain_seq: row.chain_seq, entry_type: 'action' as const, row })),
    { chain_seq: receipt.chain_seq, entry_type: 'receipt', row: receipt },
    ...shipments.map((row) => ({ chain_seq: row.chain_seq, entry_type: 'shipment' as const, row })),
    ...reviews.map((row) => ({ chain_seq: row.chain_seq, entry_type: 'merchant_review' as const, row })),
    ...events.map((row) => ({ chain_seq: row.chain_seq, entry_type: 'dispute_event' as const, row })),
  ]
  const own = new Set(records.map((r) => r.chain_seq))
  const before = [...own].map((s) => s - 1).filter((s) => s >= 1 && !own.has(s))
  const hashes = new Map<number, string>()
  if (before.length) {
    const { data, error } = await db.from('chain_entries').select('chain_seq,entry_hash').in('chain_seq', before)
    if (error) throw new Error(error.message)
    for (const h of (data ?? []) as { chain_seq: number; entry_hash: string }[]) hashes.set(h.chain_seq, h.entry_hash)
  }
  return { records, hashAt: (s) => hashes.get(s) ?? null }
}
