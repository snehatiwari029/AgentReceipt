// Supabase-backed OptimizerDb. Runs in the edge function with the service role (auto-injected, never in the repo).
// Every read and write is filtered by merchant_id. Writes touch optimizer_scans and optimizer_suggestions only.
import type { OptimizerDb, SuggestionRow } from './run.ts'
import { parseMarkup, unscannedMarkup, type MarkupScan, type ReceiptFacts, type Row } from './checks.ts'

// deno-lint-ignore no-explicit-any
type Db = any

function must<T>(res: { data?: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data as T
}

const productIdOf = (r: Record<string, unknown>) => {
  for (const k of ['terms_snapshot', 'action_summary']) {
    const v = r[k] as Record<string, unknown> | null
    if (v && typeof v.product_id === 'string') return v.product_id
  }
  return null
}

export function createOptimizerDb(db: Db): OptimizerDb {
  return {
    async merchant(id) {
      const r = await db.from('merchants').select('id,name').eq('id', id).limit(1)
      return must<{ id: string; name: string }[]>(r, 'read merchant')?.[0] ?? null
    },
    async products(merchantId) {
      const r = await db.from('products').select('*').eq('merchant_id', merchantId).order('sort_order', { ascending: true })
      return must<Row[]>(r, 'read products') ?? []
    },
    // Aggregate facts only: which listing, which order ref, which fields mismatched. No grant, chat or customer field.
    async receiptFacts(merchantId) {
      const r = await db.from('receipts').select('receipt_ref,order_ref,terms_snapshot,action_summary,mismatch_results').eq('merchant_id', merchantId)
      const rows = must<Record<string, unknown>[]>(r, 'read receipts') ?? []
      return rows.map((x): ReceiptFacts => ({
        receipt_ref: String(x.receipt_ref),
        order_ref: typeof x.order_ref === 'string' ? x.order_ref : null,
        product_id: productIdOf(x),
        mismatch_fields: (Array.isArray(x.mismatch_results) ? x.mismatch_results : [])
          .filter((m: Record<string, unknown>) => m?.result === 'mismatch' && typeof m.field === 'string')
          .map((m: Record<string, unknown>) => m.field as string),
      }))
    },
    async suggestions(merchantId) {
      const r = await db.from('optimizer_suggestions').select('*').eq('merchant_id', merchantId)
      return must<SuggestionRow[]>(r, 'read suggestions') ?? []
    },
    async insertSuggestions(rows) {
      must(await db.from('optimizer_suggestions').insert(rows), 'insert suggestions')
    },
    async updateSuggestion(merchantId, id, patch) {
      must(await db.from('optimizer_suggestions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('merchant_id', merchantId), 'update suggestion')
    },
    async insertScan(row) {
      must(await db.from('optimizer_scans').insert(row), 'insert scan')
    },
  }
}

// Fetches the store page exactly as served (no JavaScript run) for the Schema.org check.
export async function fetchStoreMarkup(url: string | undefined, fetchFn: typeof fetch = fetch): Promise<MarkupScan> {
  const target = url?.trim()
  if (!target) return unscannedMarkup('not_configured', null, 'STORE_PAGE_URL is not set in the edge function secrets.')
  if (!/^https?:\/\//i.test(target)) return unscannedMarkup('not_configured', target, 'STORE_PAGE_URL must be an http(s) URL.')
  try {
    const res = await fetchFn(target, { headers: { Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(10_000) })
    const html = (await res.text()).slice(0, 2_000_000)
    if (!res.ok) return unscannedMarkup('failed', target, `HTTP ${res.status}`, res.status)
    return parseMarkup(html, target, res.status)
  } catch (e) {
    return unscannedMarkup('failed', target, e instanceof Error ? e.message : 'fetch failed')
  }
}
