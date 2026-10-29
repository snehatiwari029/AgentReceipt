// Supabase-backed DisputesDb. Runs in the edge function with the service role (auto-injected, never in the repo).
// Reads are per order and per merchant. The only cross-order read is the chain view, and it returns hashes only.
import type { DisputesDb } from './run.ts'

// deno-lint-ignore no-explicit-any
type Db = any
type Row = Record<string, unknown>

function must<T>(res: { data?: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}
const one = async (q: Promise<{ data?: Row[]; error: { message: string } | null }>, what: string): Promise<Row | null> =>
  must<Row[]>(await q, what)?.[0] ?? null

export function createDisputesDb(db: Db): DisputesDb {
  return {
    async latestHash() {
      const r = await db.from('chain_entries').select('entry_hash').order('chain_seq', { ascending: false }).limit(1)
      return must<{ entry_hash: string }[]>(r, 'read chain')?.[0]?.entry_hash ?? null
    },
    async insert(table, row) {
      must(await db.from(table).insert(row), `insert ${table}`)
    },
    async insertPlain(table, row) {
      must(await db.from(table).insert(row), `insert ${table}`)
    },
    async merchant(id) {
      const r = await one(db.from('merchants').select('id,name').eq('id', id).limit(1), 'read merchant')
      return r ? { id: r.id as string, name: r.name as string } : null
    },
    receiptByOrderRef: (merchantId, orderRef) => one(db.from('receipts').select('*').eq('merchant_id', merchantId).eq('order_ref', orderRef).limit(1), 'read receipt'),
    async gapSessionForOrder(merchantId, orderRef) {
      const r = await db.from('sessions').select('id').eq('merchant_id', merchantId).eq('detection_source', 'none').like('gap_note', `Order ${orderRef}:%`).limit(1)
      return (must<unknown[]>(r, 'read gap session') ?? []).length > 0
    },
    receiptById: (merchantId, id) => one(db.from('receipts').select('*').eq('merchant_id', merchantId).eq('id', id).limit(1), 'read receipt'),
    disputeForReceipt: (receiptId) => one(db.from('disputes').select('*').eq('receipt_id', receiptId).limit(1), 'read dispute'),
    disputeById: (id) => one(db.from('disputes').select('*').eq('id', id).limit(1), 'read dispute'),
    async events(disputeId) {
      return must<Row[]>(await db.from('dispute_events').select('*').eq('dispute_id', disputeId).order('chain_seq', { ascending: true }), 'read dispute events') ?? []
    },
    grant: (id) => one(db.from('grants').select('*').eq('id', id).limit(1), 'read grant'),
    proposal: (id) => one(db.from('proposals').select('*').eq('id', id).limit(1), 'read proposal'),
    checkout: (grantId) => one(db.from('actions').select('*').eq('grant_id', grantId).eq('type', 'checkout').order('seq', { ascending: false }).limit(1), 'read action'),
    shipment: (receiptId) => one(db.from('shipments').select('*').eq('receipt_id', receiptId).limit(1), 'read shipment'),
    async reviews(receiptId) {
      return must<Row[]>(await db.from('merchant_reviews').select('*').eq('receipt_id', receiptId).order('chain_seq', { ascending: true }), 'read merchant reviews') ?? []
    },
  }
}
