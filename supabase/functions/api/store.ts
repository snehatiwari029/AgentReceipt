// Supabase-backed ApiDb. Runs in the edge function with the service role (auto-injected, never in the repo).
import type { ApiDb } from './handler.ts'

// deno-lint-ignore no-explicit-any
type Db = any
type Row = Record<string, unknown>

function must<T>(res: { data?: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}
const first = <T>(rows: T[] | null | undefined): T | null => rows?.[0] ?? null

export function createApiDb(db: Db): ApiDb {
  return {
    async latestHash() {
      const r = await db.from('chain_entries').select('entry_hash').order('chain_seq', { ascending: false }).limit(1)
      return first(must<{ entry_hash: string }[]>(r, 'read chain'))?.entry_hash ?? null
    },
    async insert(table, row) {
      must(await db.from(table).insert(row), `insert ${table}`)
    },
    async insertAgent(row) {
      must(await db.from('api_agents').insert(row), 'insert agent')
    },
    async agentByKeyHash(hash) {
      const r = await db.from('api_agents').select('id,agent_name').eq('key_hash', hash).limit(1)
      return first(must<{ id: string; agent_name: string }[]>(r, 'read agent'))
    },
    async merchantId(name) {
      const r = await db.from('merchants').select('id').eq('name', name).limit(1)
      return first(must<{ id: string }[]>(r, 'read merchant'))?.id ?? null
    },
    async createSession(row) {
      must(await db.from('sessions').insert(row), 'insert session')
    },
    async session(id) {
      const r = await db.from('sessions').select('id,agent_id,merchant_id').eq('id', id).limit(1)
      return first(must<{ id: string; agent_id: string | null; merchant_id: string }[]>(r, 'read session'))
    },
    async logStep(sessionId, step, detail, simulated) {
      must(await db.from('session_events').insert({ id: crypto.randomUUID(), session_id: sessionId, step, detail, simulated }), `log ${step}`)
    },
    async grantForSession(id) {
      const r = await db.from('grants').select('*').eq('session_id', id).order('version', { ascending: false }).limit(1)
      return first(must<Row[]>(r, 'read grant'))
    },
    async checkoutForGrant(id) {
      const r = await db.from('actions').select('*').eq('grant_id', id).eq('type', 'checkout').order('seq', { ascending: false }).limit(1)
      return first(must<Row[]>(r, 'read action'))
    },
    async catalog(merchantId) {
      const r = await db.from('products').select('id,name,brand,size_cm,standard_shipping_cents,expedited_shipping_cents').eq('merchant_id', merchantId)
      return must(r, 'read catalog') ?? []
    },
    async receiptBy(field, value) {
      const r = await db.from('receipts').select('*').eq(field, value).limit(1)
      return first(must<Row[]>(r, 'read receipt'))
    },
    async record(table, id) {
      const r = await db.from(table).select('*').eq('id', id).limit(1)
      return first(must<Row[]>(r, `read ${table}`))
    },
    async prevEntryHash(seq) {
      const r = await db.from('chain_entries').select('entry_hash').lt('chain_seq', seq).order('chain_seq', { ascending: false }).limit(1)
      return first(must<{ entry_hash: string }[]>(r, 'read chain link'))?.entry_hash ?? null
    },
  }
}
