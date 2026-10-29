// Listing Optimizer: the deterministic checks. No model, no network, no writes.
// Presence / absence of a field, an identifier or Schema.org markup, and every total, are decided here by code.
// Spark's semantic reading (spark.ts) arrives as an input; this file only maps it to a flag and labels its source.
// The optimizer never fills a missing value: a missing field becomes a flag with an empty "to be filled" field.
// It is a five-pillar guideline only. It does not read orders or receipts and does not link a flag to an order or a
// dispute (that linkage was removed on 2026-10-29: a weak listing may simply be skipped, not cause a dispute).

export type Pillar = 1 | 2 | 3 | 4 | 5
export type PillarResult = 'pass' | 'missing' | 'contradiction' | 'not_checked'
export type FlagType = 'missing' | 'contradiction'
// Section 8 order: 1 contradictions, 2 missing fields that block parsing, 3 identifiers, 4 AEO answers, 5 trust metadata.
export type Category = 1 | 2 | 3 | 4 | 5
export type Severity = 'violation' | 'attention' | 'lower'
export type SemanticSource = 'muse-spark' | 'rules-fallback'

export const PILLAR_NAMES: Record<Pillar, string> = {
  1: 'Feed Hygiene & Real-Time Accuracy',
  2: 'Precision & Explicit Attributes',
  3: 'Machine-Readable Schema (Schema.org)',
  4: 'Answer Engine Optimization (AEO)',
  5: 'Multi-Point Trust & Verification',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  1: 'Contradiction',
  2: 'Missing field that blocks agent parsing',
  3: 'Missing identifier',
  4: 'Missing AEO answer',
  5: 'Missing trust metadata',
}

// Colour follows the category; it never replaces it and is never a score.
export const severityOf = (c: Category): Severity => (c === 1 ? 'violation' : c === 2 ? 'attention' : 'lower')

export interface Flag {
  key: string // stable per listing, e.g. 'p1.identifiers'; re-scans match on it
  pillar: Pillar
  flag_type: FlagType
  subtype: string // the feature document's flag type, e.g. 'Missing', 'Buried', 'Incomplete', 'Ambiguous answer'
  category: Category
  title: string
  evidence: string[]
  impact: string
  suggested_fix: string
  value_fields: string[] // empty, editable "To be filled by merchant" fields; never pre-filled
  source: 'deterministic' | SemanticSource
}

export interface PillarCheck {
  pillar: Pillar
  name: string
  result: PillarResult
  summary: string
  notes: string[] // evidence for passes and for what could not be checked
}

// One product row as stored. Read generically so a column the merchant adds later (gtin, availability, ...) is seen.
export type Row = Record<string, unknown> & {
  id: string
  merchant_id: string
  name: string
  price_cents: number
}

export interface JsonLdProduct {
  name: string | null
  productID: string | null
  sku: string | null
  gtin: string | null
  mpn: string | null
  price: string | null
  priceCurrency: string | null
  availability: string | null
  returnPolicyCategory: string | null
  hasReturnPolicy: boolean
  hasReviews: boolean
}

export interface MarkupScan {
  status: 'fetched' | 'not_configured' | 'failed'
  url: string | null
  http_status: number | null
  bytes: number
  products: JsonLdProduct[]
  has_microdata_product: boolean
  has_breadcrumbs: boolean
  has_faq: boolean
  error: string | null
}

export interface Deconstructed {
  brand: string | null
  product_type: string | null
  size_cm: number | null
  colour: string | null
  price: string | null
  shipping: string | null
  returns_claim: string | null
  terms: string | null
}

export interface Semantic {
  source: SemanticSource
  deconstructed: Deconstructed | null
  returns_matches_terms: boolean | null // null = the copy says nothing about returns, or it could not be read
  reason: string
}

export interface ListingResult {
  product_id: string
  product_name: string
  brand: string | null
  product_scope: string | null
  size_cm: number | null
  colour: string | null
  price_cents: number
  currency: string
  pillars: PillarCheck[]
  flags: Flag[]
  semantic: { source: SemanticSource; label: string; reason: string; deconstructed: Deconstructed | null }
}

// ---------- small helpers ----------
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const present = (v: unknown): boolean => {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const quote = (s: string, max = 140) => `"${s.length > max ? `${s.slice(0, max - 1)}…` : s}"`
const fieldOf = (row: Row, ...keys: string[]) => {
  for (const k of keys) if (present(row[k])) return row[k]
  return null
}
// A field the merchant may add to the catalogue later, also accepted inside an `identifiers` JSON column.
const identifier = (row: Row, key: 'gtin' | 'mpn' | 'sku') => {
  const ids = row.identifiers
  const nested = ids && typeof ids === 'object' ? (ids as Record<string, unknown>)[key] : null
  return text(row[key]) ?? text(nested)
}

// Same keyword reading as the auditor's labelled fallback (auditor/audit.ts kindOfText); copied, not imported.
export function kindOfText(s: string | null): 'final_sale' | 'returnable' | null {
  if (!s) return null
  if (/final\s*sale|no\s+returns?|non-?returnable|not\s+returnable/i.test(s)) return 'final_sale'
  if (/return/i.test(s)) return 'returnable'
  return null
}

const kindOfFormal = (f: unknown): 'final_sale' | 'returnable' | null =>
  f === 'final_sale' ? 'final_sale' : f === 'free' || f === 'fee' ? 'returnable' : null

// Deterministic contradiction check: marketing copy claims returns while the formal terms disagree.
// true = they disagree, false = they agree, null = the copy says nothing about returns.
export function returnsConflict(marketing: string | null, formalReturns: unknown): boolean | null {
  const claim = kindOfText(marketing)
  const formal = kindOfFormal(formalReturns)
  if (claim === null || formal === null) return null
  return claim !== formal
}

// The sentence of the marketing copy that talks about returns, quoted as evidence.
export function returnsLine(marketing: string | null): string | null {
  if (!marketing) return null
  const parts = marketing.split(/(?<=[.!?])\s+/)
  return parts.find((p) => /return|final\s*sale/i.test(p))?.trim() ?? null
}

const COLOUR_WORDS =
  /\b(black|white|grey|gray|silver|red|blue|navy|green|yellow|orange|pink|purple|violet|brown|tan|beige|gold|teal|cyan|olive|maroon|serpent|iceberg)\b/i

// A colour named only in the details prose (for evidence). It is quoted, never copied into a field.
export function colourInProse(details: string | null): string | null {
  if (!details) return null
  return details.split(',').map((s) => s.trim()).find((s) => COLOUR_WORDS.test(s)) ?? null
}

// The title as the store displays it: the brand line above the product name (src/shop/components/ProductCard.tsx and
// ProductDetails.tsx; the image alt text is the same "Brand Name"). A name that already starts with the brand is not doubled.
export function displayedTitle(row: Pick<Row, 'name'> & { brand?: unknown }): string {
  const brand = text(row.brand)
  if (!brand || norm(row.name).startsWith(norm(brand))) return row.name
  return `${brand} ${row.name}`
}

// ---------- Pillar 3 input: the HTML exactly as served ----------
type Json = Record<string, unknown>
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])
const typesOf = (o: Json) => asArray(o['@type']).map(String)

function flattenJsonLd(v: unknown, out: Json[] = []): Json[] {
  for (const item of asArray(v)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Json
    out.push(o)
    if (o['@graph']) flattenJsonLd(o['@graph'], out)
  }
  return out
}

function readProduct(o: Json): JsonLdProduct {
  const offer = asArray(o.offers).find((x) => x && typeof x === 'object') as Json | undefined
  const policy = (asArray(offer?.hasMerchantReturnPolicy ?? o.hasMerchantReturnPolicy).find((x) => x && typeof x === 'object') ?? null) as Json | null
  const plain = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : null)
  const brandName = (v: unknown) => (v && typeof v === 'object' ? plain((v as Json).name) : plain(v))
  const name = plain(o.name)
  const brand = brandName(o.brand)
  return {
    name: name && brand && !norm(name).startsWith(norm(brand)) ? `${brand} ${name}` : name,
    productID: plain(o.productID),
    sku: plain(o.sku),
    gtin: plain(o.gtin ?? o.gtin13 ?? o.gtin12 ?? o.gtin14 ?? o.gtin8),
    mpn: plain(o.mpn),
    price: plain(offer?.price),
    priceCurrency: plain(offer?.priceCurrency),
    availability: plain(offer?.availability),
    returnPolicyCategory: plain(policy?.returnPolicyCategory),
    hasReturnPolicy: policy !== null || present(offer?.returnPolicy) || present(o.returnPolicy),
    hasReviews: present(o.aggregateRating) || present(o.review),
  }
}

// Parses the HTML as served (no JavaScript is run). Finds JSON-LD blocks and microdata markers.
export function parseMarkup(html: string, url: string, httpStatus: number): MarkupScan {
  const blocks = [...html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  const nodes: Json[] = []
  for (const b of blocks) {
    try { flattenJsonLd(JSON.parse(b), nodes) } catch { /* an unreadable block is not markup an agent can use */ }
  }
  const has = (t: string) => nodes.some((n) => typesOf(n).includes(t))
  return {
    status: 'fetched',
    url,
    http_status: httpStatus,
    bytes: html.length,
    products: nodes.filter((n) => typesOf(n).includes('Product')).map(readProduct),
    has_microdata_product: /itemtype\s*=\s*["']https?:\/\/schema\.org\/Product["']/i.test(html),
    has_breadcrumbs: has('BreadcrumbList') || /itemtype\s*=\s*["']https?:\/\/schema\.org\/BreadcrumbList["']/i.test(html),
    has_faq: has('FAQPage') || has('Question'),
    error: null,
  }
}

export const unscannedMarkup = (status: 'not_configured' | 'failed', url: string | null, error: string, httpStatus: number | null = null): MarkupScan => ({
  status, url, http_status: httpStatus, bytes: 0, products: [], has_microdata_product: false, has_breadcrumbs: false, has_faq: false, error,
})

// Which JSON-LD Product is this listing: by its id (productID / sku), else by its title.
function markupFor(row: Row, markup: MarkupScan): JsonLdProduct | null {
  const sku = identifier(row, 'sku')
  const title = norm(`${text(row.brand) ?? ''} ${row.name}`)
  return (
    markup.products.find((p) => p.productID === row.id || (sku !== null && p.sku === sku)) ??
    markup.products.find((p) => p.name !== null && (norm(p.name) === title || norm(p.name) === norm(row.name))) ??
    null
  )
}

const RETURN_NOT_PERMITTED = 'MerchantReturnNotPermitted'
function returnDays(terms: string): number | null {
  const m = terms.match(/(\d{1,3})\s*days?/i)
  return m ? Number(m[1]) : null
}

// The JSON-LD the merchant could add, built only from values already in the catalogue. Unknowns say so.
export function suggestedJsonLd(row: Row, merchantName: string): string {
  const brand = text(row.brand)
  const terms = String(row.formal_terms_text ?? '')
  const days = returnDays(terms)
  const policy: Json =
    row.formal_returns === 'final_sale'
      ? { '@type': 'MerchantReturnPolicy', returnPolicyCategory: `https://schema.org/${RETURN_NOT_PERMITTED}` }
      : {
          '@type': 'MerchantReturnPolicy',
          returnPolicyCategory: days ? 'https://schema.org/MerchantReturnFiniteReturnWindow' : 'TO BE FILLED BY MERCHANT',
          ...(days ? { merchantReturnDays: days } : {}),
          ...(row.formal_returns === 'free' ? { returnFees: 'https://schema.org/FreeReturn' } : {}),
        }
  const availability = text(row.availability)
  const ld: Json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    productID: row.id,
    name: `${brand ? `${brand} ` : ''}${row.name}`,
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(present(row.size_cm) ? { size: `${row.size_cm} cm` } : {}),
    ...(text(row.colour) ? { color: text(row.colour) } : {}),
    offers: {
      '@type': 'Offer',
      price: (row.price_cents / 100).toFixed(2),
      priceCurrency: text(row.currency) ?? 'USD',
      availability: availability ?? 'TO BE FILLED BY MERCHANT',
      seller: { '@type': 'Organization', name: merchantName },
      hasMerchantReturnPolicy: policy,
    },
  }
  return JSON.stringify(ld, null, 2)
}

// ---------- catalogue-wide vocabulary (this merchant's own listings only) ----------
interface Vocabulary { colour: Map<string, string[]>; style: Map<string, string[]>; brand: Map<string, string[]> }

// For each attribute, group spellings that mean the same thing; a group with more than one spelling is inconsistent.
function groupSpellings(rows: Row[], read: (r: Row) => string | null, keyOf: (v: string) => string): Map<string, string[]> {
  const groups = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const v = read(r)
    if (!v) continue
    const k = keyOf(v)
    const g = groups.get(k) ?? new Map<string, number>()
    g.set(v, (g.get(v) ?? 0) + 1)
    groups.set(k, g)
  }
  const out = new Map<string, string[]>()
  for (const [k, g] of groups) {
    if (g.size > 1) out.set(k, [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v, n]) => `${v}|${n}`))
  }
  return out
}

export function vocabularyOf(rows: Row[]): Vocabulary {
  return {
    // "Serpent" vs "Serpent / Dark": same first colour word.
    colour: groupSpellings(rows, (r) => text(r.colour), (v) => norm(v.split(/[\s/]+/)[0] ?? v)),
    // "All-mountain / Freestyle" vs "Freestyle / All-mountain": same words, different order.
    style: groupSpellings(rows, (r) => text(r.style), (v) => v.split('/').map(norm).sort().join('|')),
    brand: groupSpellings(rows, (r) => text(r.brand), norm),
  }
}

function inconsistency(groups: Map<string, string[]>, value: string | null, keyOf: (v: string) => string) {
  if (!value) return null
  const g = groups.get(keyOf(value))
  if (!g) return null
  const spellings = g.map((s) => { const [v, n] = s.split('|'); return { v, n: Number(n) } })
  if (spellings[0].v === value) return null // this listing already uses the most common spelling
  return spellings
}

// ---------- the five pillars for one listing ----------
export interface ListingContext {
  merchantName: string
  catalogue: Row[] // this merchant's listings only
  markup: MarkupScan
  semantic: Semantic
}

export function checkListing(row: Row, ctx: ListingContext): ListingResult {
  const flags: Flag[] = []
  const notes: Record<Pillar, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  const brand = text(row.brand)
  const marketing = text(row.marketing_blurb)
  const details = text(row.details)
  const terms = String(row.formal_terms_text ?? '')
  const colour = text(row.colour)
  const title = row.name
  const vocab = vocabularyOf(ctx.catalogue)
  const ld = ctx.markup.status === 'fetched' ? markupFor(row, ctx.markup) : null

  // ---- Pillar 1: Feed Hygiene & Real-Time Accuracy ----
  const required: [string, unknown][] = [
    ['item_id', row.id], ['title', title], ['description', marketing ?? details], ['url', fieldOf(row, 'url', 'product_url')],
    ['brand', brand], ['seller_name', ctx.merchantName], ['image_url', fieldOf(row, 'image_url')],
    ['availability', fieldOf(row, 'availability', 'stock_status')], ['price', row.price_cents],
  ]
  const missingRequired = required.filter(([, v]) => !present(v)).map(([k]) => k)
  notes[1].push(`Present: ${required.filter(([, v]) => present(v)).map(([k]) => k).join(', ')}.`)
  if (missingRequired.length) {
    flags.push({
      key: 'p1.required', pillar: 1, flag_type: 'missing', subtype: 'Missing', category: 2,
      title: `Missing required feed field${missingRequired.length > 1 ? 's' : ''}: ${missingRequired.join(', ')}`,
      evidence: missingRequired.map((k) =>
        k === 'url' ? 'url: this listing has no page URL of its own in the catalogue (the store opens it in a dialog on /shop).'
          : k === 'availability' ? 'availability: no availability / stock status field exists for this listing in the catalogue.'
            : `${k}: empty in the catalogue.`),
      impact: 'An agent reading the feed cannot tell if it can buy this item or where its page is, and may skip the listing.',
      suggested_fix: `Add ${missingRequired.join(' and ')} to the feed for this listing. Values come from you; the optimizer does not fill them.`,
      value_fields: missingRequired, source: 'deterministic',
    })
  }
  const ids = (['gtin', 'mpn', 'sku'] as const).filter((k) => identifier(row, k) === null)
  if (ids.length) {
    flags.push({
      key: 'p1.identifiers', pillar: 1, flag_type: 'missing', subtype: 'Missing', category: 3,
      title: `Missing identifier${ids.length > 1 ? 's' : ''}: ${ids.map((k) => k.toUpperCase()).join(' / ')}`,
      evidence: [`No ${ids.map((k) => k.toUpperCase()).join(', ')} field for this listing in the catalogue.`],
      impact: 'An agent cannot cross-reference this product against marketplace catalogues and reviews, so it may skip it when comparing or match it to the wrong product.',
      suggested_fix: `Add ${ids.map((k) => k.toUpperCase()).join(' / ')} to the feed for this listing. Use the codes from your supplier; do not make them up.`,
      value_fields: ids.map((k) => k.toUpperCase()), source: 'deterministic',
    })
  }
  if (ld && ld.price !== null) {
    const feed = (row.price_cents / 100).toFixed(2)
    if (Number(ld.price).toFixed(2) !== feed) {
      flags.push({
        key: 'p1.stale_price', pillar: 1, flag_type: 'contradiction', subtype: 'Stale / Mismatched', category: 1,
        title: `Page markup price ${ld.price} does not match the catalogue price ${feed}`,
        evidence: [`Schema.org Offer price: ${ld.price}`, `Catalogue price_cents: ${row.price_cents} (${money(row.price_cents)})`],
        impact: 'An agent cannot tell which price is current, so it may treat the listing as stale and skip it, or state either price.',
        suggested_fix: 'Make the page markup price and the catalogue price the same. You decide which one is current.',
        value_fields: [], source: 'deterministic',
      })
    }
  } else {
    notes[1].push('Freshness: the store and this scan read the same Supabase catalogue snapshot (demo; not live Shopify sync), and the page markup declares no price to compare.')
  }

  // ---- Pillar 2: Precision & Explicit Attributes ----
  const structured: [string, unknown][] = [['product scope', row.category], ['size', row.size_cm], ['gender', row.gender], ['style', row.style]]
  const missingAttrs = structured.filter(([, v]) => !present(v)).map(([k]) => k)
  if (missingAttrs.length) {
    flags.push({
      key: 'p2.attributes', pillar: 2, flag_type: 'missing', subtype: 'Missing', category: 2,
      title: `Missing structured attribute${missingAttrs.length > 1 ? 's' : ''}: ${missingAttrs.join(', ')}`,
      evidence: missingAttrs.map((k) => `${k}: no value in its structured field.`),
      impact: 'An agent filtering by these attributes cannot match this listing, so it may skip it.',
      suggested_fix: `Fill ${missingAttrs.join(', ')} in their own fields.`,
      value_fields: missingAttrs, source: 'deterministic',
    })
  }
  const passedAttrs = structured.filter(([, v]) => present(v)).map(([k, v]) => `${k} ${k === 'size' ? `${v} cm` : v}`)
  if (colour) passedAttrs.push(`colour ${colour}`)
  notes[2].push(`In structured fields (Pass): ${passedAttrs.join(', ')}.`)
  if (!colour) {
    const prose = colourInProse(details) ?? ctx.semantic.deconstructed?.colour ?? null
    flags.push({
      key: 'p2.colour', pillar: 2, flag_type: 'missing', subtype: prose ? 'Buried' : 'Missing', category: 2,
      title: 'Missing structured colour',
      evidence: [
        'colour field is empty for this listing.',
        ...(prose ? [`A colour appears only in prose: ${quote(prose)} (details). Prose does not count as a structured colour.`] : []),
      ],
      impact: 'An agent filtering by colour cannot match this listing or confirm its colour, so it may skip it or guess from prose.',
      suggested_fix: 'Add the colour to the colour field, using the same name you use across the catalogue.',
      value_fields: ['colour'], source: 'deterministic',
    })
  }
  // Front-loaded title: checked on the title as the store displays it, not on the name column alone.
  const shown = displayedTitle(row)
  if (brand !== null && norm(shown).startsWith(norm(brand))) {
    notes[2].push(`Title front-loaded (Pass): the store displays ${quote(shown)}, brand first.`)
  } else {
    flags.push({
      key: 'p2.title', pillar: 2, flag_type: 'missing', subtype: 'Buried', category: 2,
      title: 'Displayed title does not start with the brand',
      evidence: [
        `Displayed title: ${quote(shown)} (the store shows the brand line, then the name).`,
        brand ? `It does not start with brand ${quote(brand)}.` : 'The brand field is empty, so the displayed title has no brand at the start.',
      ],
      impact: 'An agent matching on the title cannot see the brand first, so it may match the listing late, to the wrong brand, or skip it.',
      suggested_fix: brand
        ? `Start the displayed title with the brand ${quote(brand)}, followed by the product type and model.`
        : 'Add the brand to the brand field so the displayed title starts with it. The value comes from you; the optimizer does not fill it.',
      value_fields: brand ? [] : ['brand'], source: 'deterministic',
    })
  }
  const colourVar = inconsistency(vocab.colour, colour, (v) => norm(v.split(/[\s/]+/)[0] ?? v))
  const styleVar = inconsistency(vocab.style, text(row.style), (v) => v.split('/').map(norm).sort().join('|'))
  for (const [attr, value, spellings] of [['colour', colour, colourVar], ['style', text(row.style), styleVar]] as const) {
    if (!spellings) continue
    flags.push({
      key: `p2.vocabulary.${attr}`, pillar: 2, flag_type: 'missing', subtype: 'Inconsistent', category: 2,
      title: `Inconsistent ${attr} vocabulary across the catalogue`,
      evidence: [`This listing: ${quote(value ?? '')}.`, `Same ${attr} spelled ${spellings.map((s) => `${quote(s.v)} (${s.n} listing${s.n > 1 ? 's' : ''})`).join(', ')}.`],
      impact: 'An agent comparing listings cannot tell these spellings mean the same thing, so it may filter this listing out or compare it inconsistently.',
      suggested_fix: `Use one spelling for this ${attr} across the catalogue, e.g. the most common ${quote(spellings[0].v)}. You choose the spelling.`,
      value_fields: [], source: 'deterministic',
    })
  }
  // Marketing copy vs formal terms. Deterministic keyword reading always runs; Spark's reading is added when available.
  const keywordConflict = returnsConflict(marketing, row.formal_returns)
  const sparkConflict = ctx.semantic.source === 'muse-spark' && ctx.semantic.returns_matches_terms !== null ? !ctx.semantic.returns_matches_terms : null
  if (keywordConflict === true || sparkConflict === true) {
    const line = ctx.semantic.deconstructed?.returns_claim ?? returnsLine(marketing) ?? marketing ?? ''
    flags.push({
      key: 'p2.returns', pillar: 2, flag_type: 'contradiction', subtype: 'Contradiction', category: 1,
      title: `Marketing ${quote(line, 60)} vs formal terms ${quote(terms, 60)}`,
      evidence: [
        `marketing_blurb: ${quote(marketing ?? '')}`,
        `formal_terms_text: ${quote(terms)} (formal_returns = ${String(row.formal_returns)})`,
        sparkConflict === true ? `Muse Spark: ${ctx.semantic.reason}` : ctx.semantic.source === 'rules-fallback'
          ? 'rules-fallback: keyword reading only (Spark deconstruction unavailable).' : `Keyword reading: the copy claims ${kindOfText(marketing)}, the terms say ${kindOfFormal(row.formal_returns)}.`,
      ],
      impact: 'An agent cannot tell which returns statement is true, so it may repeat the marketing line, skip the listing as ambiguous, or present it inconsistently.',
      suggested_fix: `Make the two agree. Either remove or correct ${quote(line, 60)} in the marketing copy, or change the formal terms if ${quote(terms, 60)} is wrong. You decide which is correct; the optimizer does not.`,
      value_fields: [], source: sparkConflict === true ? 'muse-spark' : ctx.semantic.source === 'rules-fallback' ? 'rules-fallback' : 'deterministic',
    })
  } else if (marketing) {
    notes[2].push(keywordConflict === false || sparkConflict === false ? 'Marketing returns wording agrees with the formal terms.' : 'Marketing copy says nothing about returns.')
  }
  const d = ctx.semantic.deconstructed
  if (d && d.size_cm !== null && present(row.size_cm) && d.size_cm !== row.size_cm) {
    flags.push({
      key: 'p2.size_conflict', pillar: 2, flag_type: 'contradiction', subtype: 'Contradiction', category: 1,
      title: `Marketing size ${d.size_cm} cm vs size field ${row.size_cm} cm`,
      evidence: [`Marketing copy states ${d.size_cm} cm.`, `size_cm field: ${row.size_cm}.`],
      impact: 'An agent cannot tell which size is right, so it may state either one, skip the listing as ambiguous, or present it inconsistently.',
      suggested_fix: 'Make the marketing copy and the size field agree. You decide which is correct.',
      value_fields: [], source: ctx.semantic.source,
    })
  }
  if (d && d.colour && colour && !norm(d.colour).includes(norm(colour)) && !norm(colour).includes(norm(d.colour))) {
    flags.push({
      key: 'p2.colour_conflict', pillar: 2, flag_type: 'contradiction', subtype: 'Contradiction', category: 1,
      title: `Marketing colour ${quote(d.colour)} vs colour field ${quote(colour)}`,
      evidence: [`Marketing copy states ${quote(d.colour)}.`, `colour field: ${quote(colour)}.`],
      impact: 'An agent cannot tell which colour is right, so it may state either one, skip the listing as ambiguous, or present it inconsistently.',
      suggested_fix: 'Make the marketing copy and the colour field agree. You decide which is correct.',
      value_fields: [], source: ctx.semantic.source,
    })
  }

  // ---- Pillar 3: Machine-Readable Schema (Schema.org), from the HTML as served ----
  const p3Result = (): PillarResult | null => (ctx.markup.status === 'fetched' ? null : 'not_checked')
  if (ctx.markup.status !== 'fetched') {
    notes[3].push(ctx.markup.status === 'not_configured'
      ? `Not checked: ${ctx.markup.error}`
      : `Not checked: the store page could not be fetched (${ctx.markup.error}).`)
  } else {
    const where = `HTML as served at ${ctx.markup.url} (HTTP ${ctx.markup.http_status}, ${ctx.markup.bytes} bytes; no JavaScript run)`
    if (!ld) {
      flags.push({
        key: 'p3.markup', pillar: 3, flag_type: 'missing', subtype: 'Missing', category: 2,
        title: 'No Schema.org Product / Offer markup for this listing',
        evidence: [
          `${where}: ${ctx.markup.products.length === 0 ? 'no application/ld+json Product block' : `${ctx.markup.products.length} Product block(s), none for this listing`}${ctx.markup.has_microdata_product ? '; schema.org/Product microdata is present but not tied to this listing' : ', no schema.org/Product microdata'}.`,
          'So no price, currency, stock status, reviews or returnPolicy is declared in markup.',
          ...(ctx.markup.has_breadcrumbs ? [] : ['No BreadcrumbList markup for category / variant navigation.']),
        ],
        impact: 'An agent parsing markup alone does not see price or return policy, so it cannot compare this listing accurately.',
        suggested_fix: `Add Schema.org Product / Offer JSON-LD to the page as served, declaring price, currency, stock status and returnPolicy. Built from your catalogue values:\n${suggestedJsonLd(row, ctx.merchantName)}`,
        value_fields: [], source: 'deterministic',
      })
    } else {
      const missing = [
        ld.price === null && 'price', ld.priceCurrency === null && 'currency', ld.availability === null && 'stock status',
        !ld.hasReturnPolicy && 'returnPolicy', !ld.hasReviews && 'reviews', !ctx.markup.has_breadcrumbs && 'breadcrumbs',
      ].filter(Boolean) as string[]
      const blocking = missing.filter((m) => m !== 'reviews' && m !== 'breadcrumbs')
      if (missing.length) {
        flags.push({
          key: 'p3.incomplete', pillar: 3, flag_type: 'missing', subtype: 'Incomplete', category: blocking.length ? 2 : 5,
          title: `Schema.org markup omits ${missing.join(', ')}`,
          evidence: [`${where}: Product markup found for this listing but it does not declare ${missing.join(', ')}.`],
          impact: 'An agent parsing markup alone does not see what is not declared, so it cannot compare this listing accurately on those fields.',
          suggested_fix: `Declare ${missing.join(', ')} in the Product / Offer markup.`,
          value_fields: [], source: 'deterministic',
        })
      }
      const ldFinal = ld.returnPolicyCategory?.includes(RETURN_NOT_PERMITTED) ?? null
      const contradictions: string[] = []
      if (ld.priceCurrency && ld.priceCurrency !== text(row.currency)) contradictions.push(`markup currency ${ld.priceCurrency} vs catalogue ${String(row.currency)}`)
      if (ld.returnPolicyCategory && ldFinal !== (row.formal_returns === 'final_sale')) contradictions.push(`markup returnPolicyCategory ${ld.returnPolicyCategory} vs formal terms ${quote(terms)}`)
      if (contradictions.length) {
        flags.push({
          key: 'p3.contradictory', pillar: 3, flag_type: 'contradiction', subtype: 'Contradictory', category: 1,
          title: 'Schema.org markup contradicts the formal terms',
          evidence: contradictions,
          impact: 'An agent cannot tell whether the markup or the formal terms are right, so it may repeat the markup, skip the listing as ambiguous, or present it inconsistently.',
          suggested_fix: 'Make the markup say what the formal terms say. You decide which is correct.',
          value_fields: [], source: 'deterministic',
        })
      }
      if (!missing.length && !contradictions.length) notes[3].push(`${where}: Product / Offer markup declares price, currency, stock status, reviews and returnPolicy.`)
    }
  }

  // ---- Pillar 4: Answer Engine Optimization ----
  const std = row.price_cents + Number(row.standard_shipping_cents ?? 0)
  const expCents = typeof row.expedited_shipping_cents === 'number' ? row.expedited_shipping_cents : null
  const exp = expCents === null ? null : row.price_cents + expCents
  const qaPresent = present(fieldOf(row, 'qa', 'faq', 'qa_pairs')) || ctx.markup.has_faq
  const returnsConflicting = flags.some((f) => f.key === 'p2.returns')
  const returnsAnswer = row.formal_returns === 'final_sale' ? `No — ${terms}.` : `Yes — ${terms}.`
  if (!qaPresent) {
    flags.push({
      key: 'p4.qa', pillar: 4, flag_type: 'missing', subtype: returnsConflicting ? 'Ambiguous answer' : 'Unanswerable',
      category: 4,
      title: 'No structured Q&A for the questions agents ask before confirming',
      evidence: [
        `Size range: only one size (${row.size_cm} cm) is listed; no applicable range is stated. Unanswerable.`,
        `Total with standard shipping (${money(std)})${exp !== null ? ` and with expedited shipping (${money(exp)})` : ''} is not shown as a direct answer before confirmation; an agent must add separate fields.`,
        returnsConflicting
          ? `Returns: answered two ways — marketing ${quote(returnsLine(marketing) ?? marketing ?? '', 60)} vs formal ${quote(terms)}. Ambiguous answer.`
          : `Returns: only in the formal terms field (${quote(terms)}); no direct Q&A answer.`,
        `Delivery: standard ${row.standard_delivery_days} days${row.expedited_delivery_days != null ? `, expedited ${row.expedited_delivery_days} days` : ''} are in fields, not in a direct answer.`,
        'No Q&A field in the catalogue and no FAQPage / Question markup on the page.',
      ],
      impact: 'An agent cannot answer these questions directly from the listing, so it may work out the total or terms itself, present them inconsistently, or skip the listing for one it can answer from.',
      suggested_fix: [
        'Add these question-and-answer pairs to the listing (totals computed from your own fields):',
        `Q: What size range is this for? A: ${row.size_cm} cm. Applicable range: [to be filled by merchant].`,
        `Q: What is the total with standard shipping? A: ${money(std)} (item ${money(row.price_cents)} + shipping ${money(Number(row.standard_shipping_cents ?? 0))}).`,
        ...(exp !== null ? [`Q: What is the total with expedited shipping? A: ${money(exp)} (item ${money(row.price_cents)} + shipping ${money(expCents!)}).`] : []),
        `Q: Is it returnable? A: ${returnsAnswer}`,
        `Q: When will it arrive? A: Standard ${row.standard_delivery_days} days${row.expedited_delivery_days != null ? `; expedited ${row.expedited_delivery_days} days` : ''}.`,
      ].join('\n'),
      value_fields: ['Applicable size range'], source: 'deterministic',
    })
  } else {
    notes[4].push('Structured Q&A is present on the listing.')
  }

  // ---- Pillar 5: Multi-Point Trust & Verification (merchant-controlled only; no external sentiment) ----
  const reviews = present(fieldOf(row, 'review_count', 'rating', 'reviews', 'aggregate_rating')) || (ld?.hasReviews ?? false)
  const qaMeta = present(fieldOf(row, 'qa_count', 'qa', 'faq', 'qa_pairs')) || ctx.markup.has_faq
  const trustMissing = [!reviews && 'reviews metadata', !qaMeta && 'aggregate Q&A metadata'].filter(Boolean) as string[]
  if (trustMissing.length) {
    flags.push({
      key: 'p5.metadata', pillar: 5, flag_type: 'missing', subtype: trustMissing.map((m) => `Missing ${m}`).join(', '), category: 5,
      title: `No ${trustMissing.join(' or ')} on the listing`,
      evidence: trustMissing.map((m) => `${m}: not in the catalogue and not in page markup.`),
      impact: 'An agent cannot confirm what other buyers say about this listing, so it may recommend it with less confidence or prefer a listing that shows reviews. It does not block parsing.',
      suggested_fix: 'Add reviews and Q&A metadata to the listing, if reviews exist. If there are none, leave it: never invent reviews.',
      value_fields: [...(!reviews ? ['Review count', 'Average rating'] : []), ...(!qaMeta ? ['Q&A count'] : [])], source: 'deterministic',
    })
  }
  const brandVar = inconsistency(vocab.brand, brand, norm)
  if (brandVar) {
    flags.push({
      key: 'p5.brand', pillar: 5, flag_type: 'missing', subtype: 'Inconsistent brand / seller_name', category: 5,
      title: 'Brand spelled differently across your catalogue',
      evidence: [`This listing: ${quote(brand ?? '')}.`, `Also spelled ${brandVar.map((s) => `${quote(s.v)} (${s.n})`).join(', ')}.`],
      impact: 'An agent cross-referencing brand signals cannot tell these spellings are one brand, so it may treat them as different brands.',
      suggested_fix: `Use one brand spelling, e.g. ${quote(brandVar[0].v)}. You choose.`,
      value_fields: [], source: 'deterministic',
    })
  }
  notes[5].push(`seller_name: ${quote(ctx.merchantName)} on every listing in this catalogue. External sentiment is out of scope and not checked.`)

  // ---- roll up per pillar ----
  const pillars: PillarCheck[] = ([1, 2, 3, 4, 5] as Pillar[]).map((p) => {
    const mine = rankFlags(flags.filter((f) => f.pillar === p))
    const forced = p === 3 ? p3Result() : null
    const result: PillarResult = forced ?? (mine.some((f) => f.flag_type === 'contradiction') ? 'contradiction' : mine.length ? 'missing' : 'pass')
    const top = mine[0]
    const summary = result === 'not_checked' ? 'Not checked' : top ? `${result === 'contradiction' ? 'Contradiction' : 'Missing'} — ${top.title}` : 'Pass'
    return { pillar: p, name: PILLAR_NAMES[p], result, summary, notes: notes[p] }
  })

  return {
    product_id: row.id,
    product_name: displayedTitle(row),
    brand,
    product_scope: text(row.category),
    size_cm: typeof row.size_cm === 'number' ? row.size_cm : null,
    colour,
    price_cents: row.price_cents,
    currency: text(row.currency) ?? 'USD',
    pillars,
    flags: rankFlags(flags),
    semantic: {
      source: ctx.semantic.source,
      label: ctx.semantic.source === 'muse-spark' ? 'Muse Spark deconstruction' : 'rules-fallback — deterministic check only, Spark deconstruction unavailable',
      reason: ctx.semantic.reason,
      deconstructed: ctx.semantic.deconstructed,
    },
  }
}

// Section 8 only: rank by category (1 contradictions, 2 missing fields that block parsing, 3 identifiers, 4 AEO answers,
// 5 trust metadata), then by pillar. No order history or mismatch count is used, and no score is invented.
export function rankFlags<T extends Pick<Flag, 'category' | 'pillar'>>(flags: T[]): T[] {
  return [...flags].sort((a, b) => a.category - b.category || a.pillar - b.pillar)
}
