// Supabase-backed Store. Runs in the edge function with the service role (auto-injected, never in the repo).
// The product query lists its columns on purpose: the fine-print columns are not on the list, so the agent cannot see them.
import { appendChained, type ChainDb } from './chain.ts'
import { MERCHANT_NAME, type ProductRow, type Rules, type Step, type Store } from './agent.ts'
import { PAYMENT_LABEL } from './agent.ts'

export const PRODUCT_COLUMNS =
  'id,name,brand,category,size_cm,colour,price_cents,currency,marketing_blurb,standard_shipping_cents,standard_delivery_days,expedited_shipping_cents,expedited_delivery_days'

// deno-lint-ignore no-explicit-any
type Db = any

function must<T>(res: { data?: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

export function createStore(db: Db, newId: () => string = () => crypto.randomUUID()): Store {
  const chainDb: ChainDb = {
    async latestHash() {
      const r = await db.from('chain_entries').select('entry_hash').order('chain_seq', { ascending: false }).limit(1)
      const rows = must<{ entry_hash: string }[]>(r, 'read chain')
      return rows?.[0]?.entry_hash ?? null
    },
    async insert(table, row) {
      must(await db.from(table).insert(row), `insert ${table}`)
    },
  }
  return {
    async listProducts() {
      const r = await db.from('products').select(PRODUCT_COLUMNS).order('sort_order', { ascending: true })
      return must<ProductRow[]>(r, 'read products')
    },
    async merchantId() {
      const r = await db.from('merchants').select('id').eq('name', MERCHANT_NAME).limit(1)
      const rows = must<{ id: string }[]>(r, 'read merchant')
      if (!rows?.[0]) throw new Error('Merchant not found')
      return rows[0].id
    },
    async getGrant(sessionId) {
      const r = await db.from('grants')
        .select('id,product_scope,size_min_cm,size_max_cm,colour_preference,amount_max_cents,delivery_by,return_policy_required')
        .eq('session_id', sessionId).limit(1)
      const g = must<Record<string, unknown>[]>(r, 'read grant')?.[0]
      if (!g) return null
      const rules: Rules = {
        merchant: MERCHANT_NAME, budget_max_cents: (g.amount_max_cents as number | null) ?? null,
        size_min_cm: (g.size_min_cm as number | null) ?? null, size_max_cm: (g.size_max_cm as number | null) ?? null,
        colour_preference: (g.colour_preference as string | null) ?? null, delivery_by: (g.delivery_by as string | null) ?? null,
        return_policy_required: (g.return_policy_required as boolean | null) ?? null,
        product_scope: (g.product_scope as string | null) ?? null, payment_method_ref: PAYMENT_LABEL,
      }
      return { grantId: g.id as string, rules }
    },
    async hasStep(sessionId, step: Step) {
      const r = await db.from('session_events').select('id').eq('session_id', sessionId).eq('step', step).limit(1)
      return (must<unknown[]>(r, 'read session log') ?? []).length > 0
    },
    async createSession(row) {
      must(await db.from('sessions').insert(row), 'insert session')
    },
    async logStep(sessionId, step, detail, simulated) {
      must(await db.from('session_events').insert({ id: newId(), session_id: sessionId, step, detail, simulated }), `log ${step}`)
    },
    async addGrant(row) {
      await appendChained(chainDb, 'grants', row)
    },
    async addProposal(row) {
      await appendChained(chainDb, 'proposals', row)
    },
    async addAction(grantId, type, detail, believed) {
      const r = await db.from('actions').select('seq').eq('grant_id', grantId).order('seq', { ascending: false }).limit(1)
      const seq = ((must<{ seq: number }[]>(r, 'read action seq')?.[0]?.seq) ?? 0) + 1
      await appendChained(chainDb, 'actions', {
        id: newId(), grant_id: grantId, seq, type, detail, agent_believed_terms: believed, image_evidence_ref: null,
      })
      return seq
    },
  }
}
