// TEST fixtures only, for the Listing Optimizer tests. The app contains no product data: it reads the products table.
import { parseMarkup, type MarkupScan, type ReceiptFacts, type Row } from '../../supabase/functions/optimizer/checks'
import { createSparkListingReader, type ListingReader } from '../../supabase/functions/optimizer/spark'
import type { Deps, OptimizerDb, SuggestionRow } from '../../supabase/functions/optimizer/run'

// TEST data only: a copy of the 9 Northwind rows as read from the live products table on 2026-10-29.
export const NW = '32b14be6-26e6-49df-a7af-79532f910510'
export const OTHER = '99999999-9999-4999-8999-999999999999'
export const BURTON = '40c70768-77ac-4953-8bae-c75c8319fcf4'
export const ORCA = 'd53088eb-40e0-4fa5-b2f8-1b81e9c7c37e'
export const CAPITA = 'da3874f9-849b-47c5-8c66-3ea86a394da0'
export const QST = '062bb4d7-1956-471a-b0e7-0eb55a048b52'
const free = { formal_returns: 'free', formal_terms_text: 'Free returns within 30 days', expedited_shipping_cents: null, expedited_delivery_days: null }
export const final = { formal_returns: 'final_sale', formal_terms_text: 'Final Sale', expedited_shipping_cents: 6000, expedited_delivery_days: 2 }
export const p = (id: string, over: Record<string, unknown>): Row => ({
  id, merchant_id: NW, name: 'X', brand: 'B', category: 'snowboard', size_cm: 156, colour: null, gender: 'Unisex', style: 'All-mountain',
  price_cents: 10000, currency: 'USD', image_url: 'https://example.test/i.png', marketing_blurb: null, details: null,
  standard_shipping_cents: 0, standard_delivery_days: 5, ...free, ...over,
})
export const northwind = (): Row[] => [
  p(BURTON, { name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', colour: 'Serpent', style: 'All-mountain / Freestyle', price_cents: 44995, marketing_blurb: 'Easy returns. Directional twin all-mountain and freestyle board with a soft flex.', details: 'Directional Twin, PurePop Camber, Soft flex, Super Fly 800G Core, The Channel', ...final }),
  p(ORCA, { name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech', price_cents: 48983, marketing_blurb: 'Free returns. Directional all-mountain board with a stiff flex.', standard_delivery_days: 3 }),
  p(CAPITA, { name: 'Outerspace Living Snowboard 2025/2026', brand: 'Capita', style: 'Freestyle / All-mountain', price_cents: 37083, standard_delivery_days: 6 }),
  p('2fd85919-a7f9-41b1-8508-d5b9bf7846bc', { name: 'Assassin Snowboard 2025/2026', brand: 'Salomon', style: 'All-mountain / Freestyle', price_cents: 45483, standard_delivery_days: 7 }),
  p('a593b90b-d02a-40ed-b26e-a6b7089ea064', { name: "Airheart 2.0 Snowboard Women's 2025/2026", brand: 'Jones', size_cm: 152, gender: "Women's", price_cents: 44083, standard_delivery_days: 6 }),
  p('9a3f8acb-8e2f-4ffe-b83c-085d54b96765', { name: 'Alternator Snowboard 2026/2027', brand: 'Nitro', size_cm: 159, style: 'All-mountain / Freestyle', price_cents: 59995, ...final }),
  p('e1561fc8-135a-43ed-9cf1-1a45c878b37e', { name: 'Bent 85 Skis with Bindings 2026/2027', brand: 'Atomic', category: 'ski', size_cm: 170, price_cents: 59995, standard_delivery_days: 6 }),
  p(QST, { name: 'QST 92 Skis with Bindings 2025/2026', brand: 'Salomon', category: 'ski', size_cm: 152, price_cents: 71995, standard_delivery_days: 7, details: '92mm waist, Tip and Tail Rocker, Includes M11 GW bindings, Iceberg Green/Dark Grey' }),
  p('e84fbe01-1033-4244-8110-35aad3fe23c2', { name: 'Sender Soul 92 Skis with Bindings 2025/2026', brand: 'Rossignol', category: 'ski', size_cm: 166, price_cents: 74995 }),
]
// The shop is a single-page app: this is what its HTML looks like as served (no product data until JavaScript runs).
export const SPA_HTML = '<!doctype html><html><head><title>AgentReceipt</title></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>'
export const SPA = parseMarkup(SPA_HTML, 'https://store.test/shop', 200)
export const receipts: ReceiptFacts[] = [
  { receipt_ref: 'AR-2026-0042', order_ref: '12322', product_id: BURTON, mismatch_fields: ['Budget', 'Returns'] },
  { receipt_ref: 'AR-2026-0043', order_ref: '13422', product_id: ORCA, mismatch_fields: [] },
  { receipt_ref: 'AR-2026-0044', order_ref: '15001', product_id: BURTON, mismatch_fields: ['Budget', 'Returns'] },
  { receipt_ref: 'AR-2026-0045', order_ref: '15002', product_id: BURTON, mismatch_fields: ['Budget', 'Returns'] },
]
export const HISTORY = { orders: ['12322', '15001', '15002'], fields: { Budget: 3, Returns: 3 } }
export const NONE = { orders: [], fields: {} }

// An in-memory database that plays the optimizer's tables, plus another merchant that must never show up.
export function world(opts: { rows?: Row[]; reader?: ListingReader; markup?: () => MarkupScan } = {}) {
  const products: Row[] = [...(opts.rows ?? northwind()), p('11111111-1111-4111-8111-111111111111', { merchant_id: OTHER, name: 'Other Board', brand: 'Other' })]
  const facts: (ReceiptFacts & { merchant_id: string })[] = [
    ...receipts.map((r) => ({ ...r, merchant_id: NW })),
    { receipt_ref: 'AR-X', order_ref: '99999', product_id: '11111111-1111-4111-8111-111111111111', mismatch_fields: ['Colour'], merchant_id: OTHER },
  ]
  const tables = { optimizer_suggestions: [] as SuggestionRow[], optimizer_scans: [] as Record<string, unknown>[] }
  const writes: string[] = []
  let n = 0
  const db: OptimizerDb = {
    async merchant(id) { return id === NW ? { id, name: 'Northwind Outfitters' } : id === OTHER ? { id, name: 'Other Merchant' } : null },
    async products(m) { return products.filter((x) => x.merchant_id === m).map((x) => ({ ...x })) },
    async receiptFacts(m) { return facts.filter((f) => f.merchant_id === m) },
    async suggestions(m) { return tables.optimizer_suggestions.filter((s) => s.merchant_id === m).map((s) => ({ ...s })) },
    async insertSuggestions(rows) { writes.push('optimizer_suggestions'); tables.optimizer_suggestions.push(...rows) },
    async updateSuggestion(m, id, patch) {
      writes.push('optimizer_suggestions')
      const s = tables.optimizer_suggestions.find((x) => x.id === id && x.merchant_id === m)!
      Object.assign(s, patch)
    },
    async insertScan(row) { writes.push('optimizer_scans'); tables.optimizer_scans.push(row) },
  }
  const deps: Deps = {
    db, reader: opts.reader ?? createSparkListingReader(null), fetchMarkup: async () => (opts.markup ? opts.markup() : SPA),
    now: () => new Date('2026-10-29T10:00:00Z'), newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  }
  const find = (product: string, key: string) => tables.optimizer_suggestions.find((s) => s.product_id === product && s.flag_key === key)!
  return { products, tables, writes, deps, find }
}

