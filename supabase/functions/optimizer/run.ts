// Listing Optimizer: scan, re-scan and merchant decisions. Runs in the `optimizer` edge function.
// It reads one merchant's listings, page markup and aggregate Order check mismatch counts, and writes only its own two
// tables (optimizer_scans, optimizer_suggestions). It has no way to write a product, price, term or page: the OptimizerDb
// interface below has no such method. Approval records a decision; the merchant applies the fix in their own store.
import {
  aggregateCounts, causedCount, checkListing, historyByListing, severityOf,
  type Flag, type ListingResult, type MarkupScan, type ReceiptFacts, type Row, type Semantic,
} from './checks.ts'
import { fallback, type ListingReader } from './spark.ts'

export type Status = 'pending' | 'approved' | 'rejected' | 'resolved' | 'still_flagged'

export interface SuggestionRow {
  id: string
  merchant_id: string
  product_id: string
  flag_key: string
  pillar: number
  flag_type: string
  subtype: string
  category: number
  severity: string
  title: string
  evidence: string[]
  impact: string
  suggested_fix: string
  merchant_fix_text: string | null
  value_fields: string[]
  merchant_values: Record<string, string>
  mismatch_fields: string[]
  caused_mismatch_count: number
  source: string
  status: Status
  decided_by: string | null
  decided_at: string | null
  first_scan_id: string
  last_scan_id: string
  rescan_result: string | null
  rescan_at: string | null
  resolved_at: string | null
}

export interface OptimizerDb {
  merchant(id: string): Promise<{ id: string; name: string } | null>
  products(merchantId: string): Promise<Row[]>
  receiptFacts(merchantId: string): Promise<ReceiptFacts[]>
  suggestions(merchantId: string): Promise<SuggestionRow[]>
  insertSuggestions(rows: SuggestionRow[]): Promise<void>
  updateSuggestion(merchantId: string, id: string, patch: Partial<SuggestionRow>): Promise<void>
  insertScan(row: Record<string, unknown>): Promise<void>
}

export interface Deps {
  db: OptimizerDb
  reader: ListingReader
  fetchMarkup: () => Promise<MarkupScan>
  now: () => Date
  newId: () => string
}

export type Reply =
  | { type: 'error'; message: string }
  | { type: 'scan'; scan_id: string; listings_scanned: number; flags: number; resolved: number; still_flagged: number; markup_status: string; spark: Record<string, number> }
  | { type: 'decision'; suggestion_id: string; status: Status }
  | { type: 'approve_all'; approved: number; skipped_unfilled: number; skipped_not_pending: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const err = (message: string): Reply => ({ type: 'error', message })
const decidedBy = (name: string) => `${name} (demo merchant sign-in)`

// Flags whose check depends on something this scan could not run are left as they were, never marked resolved.
function notRechecked(s: SuggestionRow, markup: MarkupScan, semantic: Semantic | undefined): string | null {
  if ((s.flag_key.startsWith('p3.') || s.flag_key === 'p1.stale_price') && markup.status !== 'fetched') {
    return `Not re-checked: the store page markup could not be read on this scan (${markup.error ?? markup.status}).`
  }
  if (s.source === 'muse-spark' && semantic?.source !== 'muse-spark') {
    return 'Not re-checked: this flag came from Muse Spark and Spark was unavailable on this scan.'
  }
  return null
}

export const filled = (s: Pick<SuggestionRow, 'value_fields' | 'merchant_values'>) =>
  s.value_fields.every((f) => typeof s.merchant_values?.[f] === 'string' && s.merchant_values[f].trim() !== '')

export async function runScan(body: Record<string, unknown>, deps: Deps): Promise<Reply> {
  const merchantId = body.merchant_id
  if (typeof merchantId !== 'string' || !UUID.test(merchantId)) return err('merchant_id is required.')
  const merchant = await deps.db.merchant(merchantId)
  if (!merchant) return err('Unknown merchant.')

  // This merchant's listings only (filtered in the query and again here).
  const rows = (await deps.db.products(merchantId)).filter((r) => r.merchant_id === merchantId)
  const receipts = await deps.db.receiptFacts(merchantId)
  const history = historyByListing(receipts)
  const markup = await deps.fetchMarkup()
  const semantics = await Promise.all(rows.map((r) => deps.reader.deconstruct(r).catch(() => fallback(r, 'Spark deconstruction unavailable (call failed).'))))
  const semanticBy = new Map(rows.map((r, i) => [r.id, semantics[i]]))

  const results: ListingResult[] = rows.map((r, i) =>
    checkListing(r, { merchantName: merchant.name, catalogue: rows, markup, semantic: semantics[i], history: history.get(r.id) ?? { orders: [], fields: {} } }))

  const scanId = deps.newId()
  const at = deps.now().toISOString()
  // The scan row goes in first: every suggestion written below points at it.
  const spark: Record<string, number> = {}
  for (const s of semantics) spark[s.source] = (spark[s.source] ?? 0) + 1
  await deps.db.insertScan({
    id: scanId,
    merchant_id: merchantId,
    scanned_at: at,
    listings_scanned: rows.length,
    catalogue_source: 'Supabase catalogue snapshot (demo; not live Shopify sync)',
    markup: { status: markup.status, url: markup.url, http_status: markup.http_status, bytes: markup.bytes, products_found: markup.products.length, has_microdata_product: markup.has_microdata_product, has_breadcrumbs: markup.has_breadcrumbs, has_faq: markup.has_faq, error: markup.error },
    spark,
    aggregate_mismatch_counts: aggregateCounts(receipts),
    results: results.map(({ flags, ...rest }) => ({ ...rest, flag_keys: flags.map((f) => f.key) })),
  })

  const existing = await deps.db.suggestions(merchantId)
  const byKey = new Map(existing.map((s) => [`${s.product_id}|${s.flag_key}`, s]))
  const fresh: SuggestionRow[] = []
  let resolved = 0
  let stillFlagged = 0
  const seen = new Set<string>()

  for (const res of results) {
    for (const f of res.flags) {
      const k = `${res.product_id}|${f.key}`
      seen.add(k)
      const content = flagContent(f, res)
      const prev = byKey.get(k)
      if (!prev) {
        fresh.push({
          id: deps.newId(), merchant_id: merchantId, product_id: res.product_id, flag_key: f.key, ...content,
          merchant_fix_text: null, merchant_values: {}, status: 'pending', decided_by: null, decided_at: null,
          first_scan_id: scanId, last_scan_id: scanId, rescan_result: null, rescan_at: null, resolved_at: null,
        })
        continue
      }
      const patch: Partial<SuggestionRow> = { ...content, last_scan_id: scanId, rescan_at: at }
      if (prev.status === 'approved' || prev.status === 'still_flagged') {
        patch.status = 'still_flagged'
        patch.rescan_result = `Still flagged on re-scan: the deterministic check still fails. ${f.evidence[0] ?? ''}`.trim()
        stillFlagged += 1
      } else if (prev.status === 'resolved') {
        patch.status = 'pending' // it came back
        patch.resolved_at = null
        patch.rescan_result = 'Flagged again on re-scan after it had been resolved.'
      } else {
        patch.rescan_result = 'Still present on re-scan.'
      }
      await deps.db.updateSuggestion(merchantId, prev.id, patch)
    }
  }

  const scanned = new Set(rows.map((r) => r.id))
  for (const s of existing) {
    if (seen.has(`${s.product_id}|${s.flag_key}`) || s.status === 'resolved' || !scanned.has(s.product_id)) continue
    const why = notRechecked(s, markup, semanticBy.get(s.product_id))
    if (why) {
      await deps.db.updateSuggestion(merchantId, s.id, { last_scan_id: scanId, rescan_at: at, rescan_result: why })
      continue
    }
    resolved += 1
    await deps.db.updateSuggestion(merchantId, s.id, {
      status: 'resolved', last_scan_id: scanId, rescan_at: at, resolved_at: at,
      rescan_result: `Resolved on re-scan: the deterministic check now passes (${s.title} is no longer found).`,
    })
  }
  if (fresh.length) await deps.db.insertSuggestions(fresh)

  return {
    type: 'scan', scan_id: scanId, listings_scanned: rows.length, flags: results.reduce((n, r) => n + r.flags.length, 0),
    resolved, still_flagged: stillFlagged, markup_status: markup.status, spark,
  }
}

function flagContent(f: Flag, res: ListingResult) {
  return {
    pillar: f.pillar, flag_type: f.flag_type, subtype: f.subtype, category: f.category, severity: severityOf(f.category),
    title: f.title, evidence: f.evidence, impact: f.impact, suggested_fix: f.suggested_fix, value_fields: f.value_fields,
    mismatch_fields: f.mismatch_fields, caused_mismatch_count: causedCount(f, res.order_history), source: f.source,
  }
}

function cleanValues(raw: unknown, fields: string[]): Record<string, string> | null {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!fields.includes(k)) continue // only the fields this flag asks for
    if (typeof v !== 'string' || v.length > 200) return null
    if (v.trim() !== '') out[k] = v.trim()
  }
  return out
}

export async function decide(body: Record<string, unknown>, deps: Deps): Promise<Reply> {
  const { merchant_id: merchantId, suggestion_id: id, decision } = body
  if (typeof merchantId !== 'string' || !UUID.test(merchantId)) return err('merchant_id is required.')
  if (typeof id !== 'string' || !UUID.test(id)) return err('suggestion_id is required.')
  if (decision !== 'approve' && decision !== 'reject') return err('decision must be approve or reject.')
  const merchant = await deps.db.merchant(merchantId)
  if (!merchant) return err('Unknown merchant.')
  const s = (await deps.db.suggestions(merchantId)).find((x) => x.id === id)
  if (!s) return err('Suggestion not found for this merchant.')
  const at = deps.now().toISOString()

  if (decision === 'reject') {
    if (!['pending', 'approved', 'still_flagged'].includes(s.status)) return err(`A ${s.status} suggestion cannot be rejected.`)
    await deps.db.updateSuggestion(merchantId, id, { status: 'rejected', decided_by: decidedBy(merchant.name), decided_at: at })
    return { type: 'decision', suggestion_id: id, status: 'rejected' }
  }

  if (!['pending', 'rejected'].includes(s.status)) return err(`A ${s.status} suggestion cannot be approved again.`)
  const values = cleanValues(body.values, s.value_fields)
  if (values === null) return err('values must be short text, one per field to be filled.')
  const merged = { ...s.merchant_values, ...values }
  if (!filled({ value_fields: s.value_fields, merchant_values: merged })) {
    return err(`Fill ${s.value_fields.filter((f) => !merged[f]).join(', ')} before approving. The optimizer never fills a missing value.`)
  }
  const fix = body.fix_text
  if (fix !== undefined && fix !== null && (typeof fix !== 'string' || fix.length > 4000)) return err('fix_text must be text up to 4000 characters.')
  const patch: Partial<SuggestionRow> = { status: 'approved', merchant_values: merged, decided_by: decidedBy(merchant.name), decided_at: at }
  if (typeof fix === 'string' && fix.trim() !== '' && fix.trim() !== s.suggested_fix.trim()) patch.merchant_fix_text = fix.trim()
  await deps.db.updateSuggestion(merchantId, id, patch)
  return { type: 'decision', suggestion_id: id, status: 'approved' }
}

// Approves the pending suggestions the merchant has on screen. Never applies anything; never approves an empty
// to-be-filled field (that would be inventing data by omission).
export async function approveAll(body: Record<string, unknown>, deps: Deps): Promise<Reply> {
  const { merchant_id: merchantId, suggestion_ids: ids } = body
  if (typeof merchantId !== 'string' || !UUID.test(merchantId)) return err('merchant_id is required.')
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((x) => typeof x === 'string' && UUID.test(x))) return err('suggestion_ids must be a list of ids.')
  const merchant = await deps.db.merchant(merchantId)
  if (!merchant) return err('Unknown merchant.')
  const wanted = new Set(ids as string[])
  const mine = (await deps.db.suggestions(merchantId)).filter((s) => wanted.has(s.id))
  const at = deps.now().toISOString()
  let approved = 0
  let unfilled = 0
  for (const s of mine) {
    if (s.status !== 'pending') continue
    if (!filled(s)) { unfilled += 1; continue }
    await deps.db.updateSuggestion(merchantId, s.id, { status: 'approved', decided_by: decidedBy(merchant.name), decided_at: at })
    approved += 1
  }
  return { type: 'approve_all', approved, skipped_unfilled: unfilled, skipped_not_pending: wanted.size - approved - unfilled }
}
