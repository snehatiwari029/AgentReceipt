import { describe, expect, it } from 'vitest'
import {
  checkListing, displayedTitle, parseMarkup, rankFlags, returnsConflict, suggestedJsonLd, unscannedMarkup,
  type MarkupScan, type Row, type Semantic,
} from '../../supabase/functions/optimizer/checks'
import { createSparkListingReader, fallback, keepIfQuoted, sparkInput, type ListingReader } from '../../supabase/functions/optimizer/spark'
import { approveAll, decide, runScan } from '../../supabase/functions/optimizer/run'
import { BURTON, CAPITA, final, northwind, NW, ORCA, OTHER, p, QST, SPA, SPA_HTML, world } from './optimizerFixtures'

const sparkSays = (matches: boolean | null, deconstructed: Record<string, unknown> = {}): Semantic => ({
  source: 'muse-spark', returns_matches_terms: matches, reason: 'Spark: compared.',
  deconstructed: { brand: null, product_type: null, size_cm: null, colour: null, price: null, shipping: null, returns_claim: null, terms: null, ...deconstructed } as never,
})
const ctx = (row: Row, over: Partial<{ markup: MarkupScan; semantic: Semantic }> = {}) => ({
  merchantName: 'Northwind Outfitters', catalogue: northwind(), markup: over.markup ?? SPA,
  semantic: over.semantic ?? fallback(row, 'Spark deconstruction unavailable (test).'),
})
const spellbinder = () => northwind()[0]
const pillar = (r: ReturnType<typeof checkListing>, n: number) => r.pillars.find((x) => x.pillar === n)!

describe('Pillar 3 input: the HTML as served', () => {
  it('finds no Product markup in the single-page app shell', () => {
    expect(SPA.status).toBe('fetched')
    expect(SPA.products).toEqual([])
    expect(SPA.has_microdata_product).toBe(false)
  })

  it('reads JSON-LD Product / Offer fields, including inside @graph', () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","productID":"${BURTON}","name":"Spellbinder Snowboard 2026/2027","brand":{"@type":"Brand","name":"Burton"},"offers":{"@type":"Offer","price":"449.95","priceCurrency":"USD","availability":"https://schema.org/InStock","hasMerchantReturnPolicy":{"@type":"MerchantReturnPolicy","returnPolicyCategory":"https://schema.org/MerchantReturnNotPermitted"}}},{"@type":"BreadcrumbList"}]}</script>`
    const m = parseMarkup(html, 'u', 200)
    expect(m.products).toHaveLength(1)
    expect(m.products[0]).toMatchObject({ productID: BURTON, name: 'Burton Spellbinder Snowboard 2026/2027', price: '449.95', priceCurrency: 'USD', hasReturnPolicy: true, hasReviews: false })
    expect(m.has_breadcrumbs).toBe(true)
  })
})

describe('Spellbinder worked example (feature document section 7)', () => {
  const r = checkListing(spellbinder(), ctx(spellbinder()))

  it('Pillar 1: Missing GTIN / MPN / SKU and availability (not in the catalogue)', () => {
    expect(pillar(r, 1).result).toBe('missing')
    const keys = r.flags.filter((f) => f.pillar === 1).map((f) => f.key)
    expect(keys).toEqual(expect.arrayContaining(['p1.identifiers', 'p1.required']))
    expect(r.flags.find((f) => f.key === 'p1.identifiers')!.value_fields).toEqual(['GTIN', 'MPN', 'SKU'])
    expect(r.flags.find((f) => f.key === 'p1.required')!.value_fields).toContain('availability')
  })

  it('Pillar 2: Contradiction for Easy returns vs Final Sale, and Pass on size 156 cm and colour Serpent', () => {
    expect(pillar(r, 2).result).toBe('contradiction')
    const c = r.flags.find((f) => f.key === 'p2.returns')!
    expect(c.title).toBe('Marketing "Easy returns." vs formal terms "Final Sale"')
    expect(c.category).toBe(1)
    expect(c.suggested_fix).toMatch(/You decide which is correct/)
    expect(pillar(r, 2).notes.join(' ')).toMatch(/size 156 cm.*colour Serpent/)
    expect(r.flags.some((f) => f.key === 'p2.colour')).toBe(false)
  })

  it('Pillar 3: the actual markup result (Missing in the SPA shell), with a fix built only from catalogue values', () => {
    expect(pillar(r, 3).result).toBe('missing')
    const f = r.flags.find((x) => x.key === 'p3.markup')!
    expect(f.evidence[0]).toMatch(/HTML as served at https:\/\/store\.test\/shop \(HTTP 200/)
    expect(f.suggested_fix).toContain('"price": "449.95"')
    expect(f.suggested_fix).toContain('MerchantReturnNotPermitted')
    expect(f.suggested_fix).toContain('"availability": "TO BE FILLED BY MERCHANT"')
  })

  it('Pillar 3 is "Not checked" (never assumed) when the page could not be fetched', () => {
    const x = checkListing(spellbinder(), ctx(spellbinder(), { markup: unscannedMarkup('failed', 'https://store.test/shop', 'timeout') }))
    expect(pillar(x, 3).result).toBe('not_checked')
    expect(x.flags.some((f) => f.pillar === 3)).toBe(false)
  })

  it('Pillar 4: Missing, with $509.95 computed by code as the expedited total and returns answered as Final Sale', () => {
    expect(pillar(r, 4).result).toBe('missing')
    const f = r.flags.find((x) => x.key === 'p4.qa')!
    expect(f.subtype).toBe('Ambiguous answer')
    expect(f.suggested_fix).toContain('Q: What is the total with expedited shipping? A: $509.95 (item $449.95 + shipping $60.00).')
    expect(f.suggested_fix).toContain('Q: Is it returnable? A: No — Final Sale.')
    expect(f.value_fields).toEqual(['Applicable size range'])
  })

  it('Pillar 5: Missing reviews and Q&A metadata; no invented reviews', () => {
    expect(pillar(r, 5).result).toBe('missing')
    const f = r.flags.find((x) => x.key === 'p5.metadata')!
    expect(f.suggested_fix).toMatch(/never invent reviews/)
    expect(f.value_fields).toEqual(['Review count', 'Average rating', 'Q&A count'])
  })

  it('ranks by the Section 8 category only: contradiction, blocking fields, identifiers, AEO answers, trust', () => {
    expect(r.flags.map((f) => f.category)).toEqual([...r.flags.map((f) => f.category)].sort((a, b) => a - b))
    const keys = r.flags.map((f) => f.key)
    expect(keys[0]).toBe('p2.returns')
    expect(keys.indexOf('p1.identifiers')).toBeLessThan(keys.indexOf('p4.qa')) // no order-history boost any more
    expect(keys[keys.length - 1]).toBe('p5.metadata')
  })

  it('impact statements describe agent behaviour, never an order, dispute, Review Required or chargeback outcome', () => {
    expect(r.flags.find((f) => f.key === 'p2.returns')!.impact).toBe('An agent cannot tell which returns statement is true, so it may repeat the marketing line, skip the listing as ambiguous, or present it inconsistently.')
    expect(r.flags.find((f) => f.key === 'p3.markup')!.impact).toBe('An agent parsing markup alone does not see price or return policy, so it cannot compare this listing accurately.')
    for (const row of northwind()) {
      for (const f of checkListing(row, ctx(row)).flags) {
        expect(f.impact, `${row.name} ${f.key}`).not.toMatch(/review required|dispute|chargeback|mismatch|\border\b/i)
        expect(f.impact, `${row.name} ${f.key}`).toMatch(/^An agent /)
      }
    }
  })

  it('carries no order linkage: no order history on the listing and no mismatch fields on a flag', () => {
    expect(r).not.toHaveProperty('order_history')
    for (const f of r.flags) expect(f).not.toHaveProperty('mismatch_fields')
  })
})

describe('Other Northwind listings', () => {
  const all = northwind().map((row) => checkListing(row, ctx(row)))

  it('Missing structured colour on the 8 listings without one; prose colour is quoted as evidence, never copied into the field', () => {
    const colourFlags = all.filter((r) => r.flags.some((f) => f.key === 'p2.colour'))
    expect(colourFlags).toHaveLength(8)
    const qst = all.find((r) => r.product_id === QST)!.flags.find((f) => f.key === 'p2.colour')!
    expect(qst.title).toBe('Missing structured colour')
    expect(qst.subtype).toBe('Buried')
    expect(qst.evidence.join(' ')).toContain('"Iceberg Green/Dark Grey" (details). Prose does not count')
    expect(qst.value_fields).toEqual(['colour'])
  })

  it('Free returns marketing on Orca agrees with its formal terms: no contradiction', () => {
    const orca = all.find((r) => r.product_id === ORCA)!
    expect(orca.flags.some((f) => f.flag_type === 'contradiction')).toBe(false)
    expect(returnsConflict('Free returns.', 'free')).toBe(false)
  })

  it('flags style vocabulary only on the listing that spells it differently', () => {
    const flagged = all.filter((r) => r.flags.some((f) => f.key === 'p2.vocabulary.style')).map((r) => r.product_id)
    expect(flagged).toEqual([CAPITA])
  })

  it('Spark can catch a returns contradiction that keyword matching misses, and the flag is labelled muse-spark', () => {
    const row = p(ORCA, { marketing_blurb: 'Hassle-free if it does not fit.', ...final })
    expect(returnsConflict(row.marketing_blurb as string, 'final_sale')).toBeNull()
    const r = checkListing(row, ctx(row, { semantic: sparkSays(false, { returns_claim: 'Hassle-free if it does not fit.' }) }))
    const f = r.flags.find((x) => x.key === 'p2.returns')!
    expect(f.source).toBe('muse-spark')
    expect(r.semantic.label).toBe('Muse Spark deconstruction')
  })

  it('without Spark every listing is labelled rules-fallback, deterministic check only', () => {
    for (const r of all) expect(r.semantic.label).toBe('rules-fallback — deterministic check only, Spark deconstruction unavailable')
  })

  it('rankFlags never puts an identifier fix above a contradiction', () => {
    const ranked = rankFlags([{ category: 3, pillar: 1 }, { category: 1, pillar: 2 }])
    expect(ranked[0].category).toBe(1)
  })
})

describe('Front-loaded title: checked on the title as the store displays it', () => {
  it('Spellbinder: the displayed title "Burton Spellbinder Snowboard 2026/2027" starts with the brand, so no title flag', () => {
    const r = checkListing(spellbinder(), ctx(spellbinder()))
    expect(r.flags.some((f) => f.key === 'p2.title')).toBe(false)
    expect(pillar(r, 2).notes).toContain('Title front-loaded (Pass): the store displays "Burton Spellbinder Snowboard 2026/2027", brand first.')
    expect(r.product_name).toBe('Burton Spellbinder Snowboard 2026/2027')
  })

  it('checks each of the 9 listings on its own displayed title; all 9 start with their brand', () => {
    for (const row of northwind()) {
      const r = checkListing(row, ctx(row))
      expect(r.flags.some((f) => f.key === 'p2.title'), row.name).toBe(false)
      expect(pillar(r, 2).notes.join(' '), row.name).toContain(`the store displays "${row.brand} ${row.name}", brand first.`)
    }
  })

  it('a displayed title that does not start with a brand is flagged, with the displayed title as evidence', () => {
    const row = p(ORCA, { name: 'T. Rice Orca Snowboard 2025/2026', brand: null })
    const f = checkListing(row, ctx(row)).flags.find((x) => x.key === 'p2.title')!
    expect(f.title).toBe('Displayed title does not start with the brand')
    expect(f.evidence[0]).toBe('Displayed title: "T. Rice Orca Snowboard 2025/2026" (the store shows the brand line, then the name).')
    expect(f.value_fields).toEqual(['brand']) // to be filled by the merchant, never by the optimizer
  })

  it('does not double a brand the name already starts with', () => {
    expect(displayedTitle({ name: 'Burton Spellbinder', brand: 'Burton' })).toBe('Burton Spellbinder')
    expect(displayedTitle({ name: 'Spellbinder', brand: 'Burton' })).toBe('Burton Spellbinder')
  })

  it('the 9 Northwind rows produce 55 flags (64 before: the 9 title flags were removed)', () => {
    const total = northwind().reduce((n, row) => n + checkListing(row, ctx(row)).flags.length, 0)
    expect(total).toBe(55)
  })
})

describe('Muse Spark client: listing fields in, nothing invented out', () => {
  const answer = (content: unknown) => (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }))) as unknown as typeof fetch

  it('sends only the listing\'s own fields', () => {
    expect(Object.keys(sparkInput(spellbinder())).sort()).toEqual(['brand', 'details', 'formal_terms', 'marketing_copy', 'title'])
  })

  it('drops any value that is not written in the listing (no invented colour, size or GTIN)', async () => {
    const reader = createSparkListingReader('k', answer({
      deconstructed: { brand: 'Burton', colour: 'Red', size_cm: 160, returns_claim: 'Easy returns.', terms: 'Final Sale', price: '$399' },
      returns_claim_matches_terms: false, reason: 'Easy returns claims returnable; Final Sale does not.',
    }))
    const s = await reader.deconstruct(spellbinder())
    expect(s.source).toBe('muse-spark')
    expect(s.returns_matches_terms).toBe(false)
    expect(s.deconstructed).toMatchObject({ brand: 'Burton', colour: null, size_cm: null, price: null, returns_claim: 'Easy returns.', terms: 'Final Sale' })
    expect(keepIfQuoted({ colour: 'Serpent' }, spellbinder()).colour).toBeNull() // colour is a field, not text in the copy
  })

  it('falls back to a labelled rules-fallback when there is no key, the call fails, or the answer is unreadable', async () => {
    expect((await createSparkListingReader('').deconstruct(spellbinder())).source).toBe('rules-fallback')
    const failing = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
    const s = await createSparkListingReader('k', failing).deconstruct(spellbinder())
    expect(s).toMatchObject({ source: 'rules-fallback', returns_matches_terms: false, deconstructed: null })
    expect((await createSparkListingReader('k', answer('not json')).deconstruct(spellbinder())).source).toBe('rules-fallback')
  })
})

describe('Scan Now, decisions and re-scan (run.ts)', () => {
  it('scans the merchant\'s 9 listings only, reads no orders, and writes nothing but optimizer tables', async () => {
    const w = world()
    const r = await runScan({ merchant_id: NW }, w.deps)
    expect(r).toMatchObject({ type: 'scan', listings_scanned: 9, markup_status: 'fetched', spark: { 'rules-fallback': 9 } })
    const scan = w.tables.optimizer_scans[0] as { results: Record<string, unknown>[] }
    expect(scan.results.map((x) => x.product_id)).not.toContain('11111111-1111-4111-8111-111111111111')
    expect(scan).not.toHaveProperty('aggregate_mismatch_counts')
    for (const x of scan.results) expect(x).not.toHaveProperty('order_history')
    expect(Object.keys(w.deps.db).sort()).toEqual(['insertScan', 'insertSuggestions', 'merchant', 'products', 'suggestions', 'updateSuggestion'])
    expect(new Set(w.writes)).toEqual(new Set(['optimizer_scans', 'optimizer_suggestions']))
    expect(w.tables.optimizer_suggestions.every((s) => s.merchant_id === NW && s.status === 'pending')).toBe(true)
    expect(w.tables.optimizer_suggestions.every((s) => Object.keys(s.merchant_values).length === 0)).toBe(true)
    for (const s of w.tables.optimizer_suggestions) {
      expect(s).not.toHaveProperty('caused_mismatch_count')
      expect(s).not.toHaveProperty('mismatch_fields')
    }
  })

  it('approval records merchant, time and typed value; it never changes the listing', async () => {
    const w = world()
    await runScan({ merchant_id: NW }, w.deps)
    const before = JSON.stringify(w.products)
    const colour = w.find(ORCA, 'p2.colour')
    expect(await decide({ merchant_id: NW, suggestion_id: colour.id, decision: 'approve' }, w.deps)).toMatchObject({ type: 'error', message: expect.stringMatching(/Fill colour before approving/) })
    expect(await decide({ merchant_id: NW, suggestion_id: colour.id, decision: 'approve', values: { colour: 'Black', gtin: 'ignored' } }, w.deps)).toEqual({ type: 'decision', suggestion_id: colour.id, status: 'approved' })
    expect(w.find(ORCA, 'p2.colour')).toMatchObject({ status: 'approved', merchant_values: { colour: 'Black' }, decided_by: 'Northwind Outfitters (demo merchant sign-in)', decided_at: '2026-10-29T10:00:00.000Z' })
    const returns = w.find(BURTON, 'p2.returns')
    await decide({ merchant_id: NW, suggestion_id: returns.id, decision: 'approve', fix_text: 'Remove "Easy returns." from the copy.' }, w.deps)
    expect(w.find(BURTON, 'p2.returns').merchant_fix_text).toBe('Remove "Easy returns." from the copy.')
    expect(await decide({ merchant_id: NW, suggestion_id: returns.id, decision: 'approve' }, w.deps)).toMatchObject({ type: 'error' })
    expect(JSON.stringify(w.products)).toBe(before)
  })

  it('another merchant cannot decide on Northwind suggestions', async () => {
    const w = world()
    await runScan({ merchant_id: NW }, w.deps)
    const s = w.find(BURTON, 'p2.returns')
    expect(await decide({ merchant_id: OTHER, suggestion_id: s.id, decision: 'reject' }, w.deps)).toEqual({ type: 'error', message: 'Suggestion not found for this merchant.' })
    expect(w.find(BURTON, 'p2.returns').status).toBe('pending')
  })

  it('Approve All approves the shown pending suggestions, skips any with an empty To-be-filled field, and edits nothing', async () => {
    const w = world()
    await runScan({ merchant_id: NW }, w.deps)
    const burton = w.tables.optimizer_suggestions.filter((s) => s.product_id === BURTON)
    const before = JSON.stringify(w.products)
    const r = await approveAll({ merchant_id: NW, suggestion_ids: burton.map((s) => s.id) }, w.deps)
    const needValue = burton.filter((s) => s.value_fields.length > 0).length
    expect(r).toEqual({ type: 'approve_all', approved: burton.length - needValue, skipped_unfilled: needValue, skipped_not_pending: 0 })
    expect(w.find(BURTON, 'p2.returns').status).toBe('approved')
    expect(w.find(BURTON, 'p1.identifiers').status).toBe('pending')
    expect(w.tables.optimizer_suggestions.filter((s) => s.product_id !== BURTON).every((s) => s.status === 'pending')).toBe(true)
    expect(JSON.stringify(w.products)).toBe(before)
  })

  it('re-scan: still flagged until the merchant applies the fix in the catalogue, then resolved by the deterministic check', async () => {
    const w = world()
    await runScan({ merchant_id: NW }, w.deps)
    const id = w.find(ORCA, 'p2.colour').id
    await decide({ merchant_id: NW, suggestion_id: id, decision: 'approve', values: { colour: 'Black' } }, w.deps)

    expect(await runScan({ merchant_id: NW }, w.deps)).toMatchObject({ still_flagged: 1, resolved: 0 })
    expect(w.find(ORCA, 'p2.colour')).toMatchObject({ status: 'still_flagged', rescan_result: expect.stringMatching(/^Still flagged on re-scan/) })

    w.products.find((x) => x.id === ORCA)!.colour = 'Black' // the merchant edits their own catalogue
    expect(await runScan({ merchant_id: NW }, w.deps)).toMatchObject({ resolved: 1 })
    expect(w.find(ORCA, 'p2.colour')).toMatchObject({ status: 'resolved', resolved_at: '2026-10-29T10:00:00.000Z' })
  })

  it('re-scan resolves the Easy returns contradiction only when the copy and terms agree', async () => {
    const w = world()
    await runScan({ merchant_id: NW }, w.deps)
    w.products.find((x) => x.id === BURTON)!.marketing_blurb = 'Final Sale. Directional twin all-mountain and freestyle board with a soft flex.'
    await runScan({ merchant_id: NW }, w.deps)
    expect(w.find(BURTON, 'p2.returns').status).toBe('resolved')
  })

  it('never resolves a markup flag on a scan that could not read the page, nor a Spark flag when Spark is down', async () => {
    let markup = SPA
    const sparkFalse: ListingReader = { async deconstruct(row) { return row.id === ORCA ? sparkSays(false) : fallback(row, 'x') } }
    const w = world({ rows: northwind().map((r) => (r.id === ORCA ? { ...r, ...final, marketing_blurb: 'Hassle-free.' } : r)), reader: sparkFalse, markup: () => markup })
    await runScan({ merchant_id: NW }, w.deps)
    expect(w.find(ORCA, 'p2.returns').source).toBe('muse-spark')

    markup = unscannedMarkup('failed', 'https://store.test/shop', 'timeout')
    w.deps.reader = createSparkListingReader(null)
    await runScan({ merchant_id: NW }, w.deps)
    expect(w.find(BURTON, 'p3.markup')).toMatchObject({ status: 'pending', rescan_result: expect.stringMatching(/^Not re-checked/) })
    expect(w.find(ORCA, 'p2.returns')).toMatchObject({ status: 'pending', rescan_result: expect.stringMatching(/Spark was unavailable/) })
  })

  it('JSON-LD added to the served page resolves the markup flag on re-scan', async () => {
    let html = SPA_HTML
    const w = world({ markup: () => parseMarkup(html, 'https://store.test/shop', 200) })
    await runScan({ merchant_id: NW }, w.deps)
    const burton = w.products.find((x) => x.id === BURTON)!
    html = `<script type="application/ld+json">${suggestedJsonLd({ ...burton, availability: 'https://schema.org/InStock' }, 'Northwind Outfitters')}</script>`
    await runScan({ merchant_id: NW }, w.deps)
    expect(w.find(BURTON, 'p3.markup').status).toBe('resolved')
    expect(w.find(BURTON, 'p3.incomplete')).toMatchObject({ title: 'Schema.org markup omits reviews, breadcrumbs', category: 5 })
  })

  it('rejects requests without a valid merchant', async () => {
    const w = world()
    expect(await runScan({}, w.deps)).toMatchObject({ type: 'error' })
    expect(await runScan({ merchant_id: '00000000-0000-4000-8000-000000000000' }, w.deps)).toEqual({ type: 'error', message: 'Unknown merchant.' })
  })
})
