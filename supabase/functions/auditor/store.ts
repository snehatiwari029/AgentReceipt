// Supabase-backed AuditorDb. Runs in the edge function with the service role (auto-injected, never in the repo).
// Reads are per order. The only cross-order read is the chain view, and it returns hashes only.
import type { AuditorDb } from './run.ts'

// deno-lint-ignore no-explicit-any
type Db = any

function must<T>(res: { data?: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

export function createAuditorDb(db: Db): AuditorDb {
  return {
    async latestHash() {
      const r = await db.from('chain_entries').select('entry_hash').order('chain_seq', { ascending: false }).limit(1)
      return must<{ entry_hash: string }[]>(r, 'read chain')?.[0]?.entry_hash ?? null
    },
    async insert(table, row) {
      must(await db.from(table).insert(row), `insert ${table}`)
    },
    async sessionExists(id) {
      const r = await db.from('sessions').select('id').eq('id', id).limit(1)
      return (must<unknown[]>(r, 'read session') ?? []).length > 0
    },
    async grantForSession(id) {
      const r = await db.from('grants').select('*').eq('session_id', id).order('version', { ascending: false }).limit(1)
      return must<Record<string, unknown>[]>(r, 'read grant')?.[0] ?? null
    },
    async proposalForGrant(id) {
      const r = await db.from('proposals').select('*').eq('grant_id', id).order('chain_seq', { ascending: false }).limit(1)
      return must<Record<string, unknown>[]>(r, 'read proposal')?.[0] ?? null
    },
    async checkoutForGrant(id) {
      const r = await db.from('actions').select('*').eq('grant_id', id).eq('type', 'checkout').order('seq', { ascending: false }).limit(1)
      return must<Record<string, unknown>[]>(r, 'read action')?.[0] ?? null
    },
    async product(id) {
      const r = await db.from('products').select('*, merchants(name)').eq('id', id).limit(1)
      const row = must<(Record<string, unknown> & { merchants?: { name?: string } | null })[]>(r, 'read product')?.[0]
      if (!row) return null
      const { merchants, ...rest } = row
      return {
        category: rest.category as string, formal_returns: rest.formal_returns as string, formal_terms_text: rest.formal_terms_text as string,
        merchant_name: merchants?.name ?? '', row: rest,
      }
    },
    async merchantName(id) {
      const r = await db.from('merchants').select('name').eq('id', id).limit(1)
      return must<{ name: string }[]>(r, 'read merchant')?.[0]?.name ?? null
    },
    async entryHashAt(seq) {
      const r = await db.from('chain_entries').select('entry_hash').eq('chain_seq', seq).limit(1)
      return must<{ entry_hash: string }[]>(r, 'read chain link')?.[0]?.entry_hash ?? null
    },
    async receiptForGrant(id) {
      const r = await db.from('receipts').select('receipt_ref,order_ref,audit').eq('grant_id', id).limit(1)
      return must<Record<string, unknown>[]>(r, 'read receipt')?.[0] ?? null
    },
    async refs() {
      const r = await db.from('receipts').select('receipt_ref,order_ref')
      return must<{ receipt_ref: string; order_ref: string | null }[]>(r, 'read receipt refs') ?? []
    },
    async logStep(sessionId, step, detail) {
      must(await db.from('session_events').insert({ id: crypto.randomUUID(), session_id: sessionId, step, detail, simulated: false }), `log ${step}`)
    },
  }
}
