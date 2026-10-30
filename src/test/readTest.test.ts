import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  ALL_MATCH_LINE, compareReadTest, createSparkAgentReader, displayedListing, guardAnswers, NOT_STATED, readTestInput, runReadTest,
  UNAVAILABLE_LABEL, type AgentAnswers, type AgentReader,
} from '../../supabase/functions/optimizer/readtest'
import { runScan } from '../../supabase/functions/optimizer/run'
import { BURTON, northwind, NW, scriptedAgent, world } from './optimizerFixtures'

const TODAY = '2026-10-30'
const burton = () => northwind()[0]
const orca = () => northwind()[1]
const raw = (over: Record<string, unknown> = {}) => ({
  returns: { answer: 'Yes, easy returns', quote: 'Easy returns.' },
  delivery: { answer: 'In 5 days standard', option: 'standard', days: 5, date: '2026-11-04', quote: 'Standard: Free, 5 days' },
  cost: { answer: '$449.95 with free standard shipping', option: 'standard', option_reason: 'free', item_price: '$449.95', shipping_cost: 'Free', total: '$449.95', item_quote: '$449.95', shipping_quote: 'Standard: Free, 5 days' },
  colour_size: { answer: 'Serpent, 156 cm', colour: 'Serpent', size: '156 cm', quote: '156cm · Serpent' },
  ...over,
})
const answers = (over: Record<string, unknown> = {}, row = burton()) => guardAnswers(raw(over), displayedListing(row)) as AgentAnswers
const byKey = (qs: ReturnType<typeof compareReadTest>, k: string) => qs.find((x) => x.key === k)!

describe('Agent Read-Test: blind input', () => {
  it('sends the listing as displayed only: no formal terms, returns enum, pillar flags or previous scans', () => {
    const input = readTestInput(burton(), TODAY)
    expect(input).toEqual({
      today: TODAY,
      listing: {
        title: 'Burton Spellbinder Snowboard 2026/2027', price: '$449.95',
        shipping: { standard: 'Standard: Free, 5 days', expedited: 'Expedited: $60, 2 days' },
        marketing_blurb: 'Easy returns. Directional twin all-mountain and freestyle board with a soft flex.',
        product_details: '156cm · Serpent',
      },
    })
    const s = JSON.stringify(input)
    for (const banned of ['Final Sale', 'final_sale', 'formal', 'terms', 'Free returns within 30 days', 'pillar', 'p2.', 'flag', 'scan', 'suggest', BURTON, NW]) {
      expect(s, banned).not.toContain(banned)
    }
  })

  it('the Spark request has its own system prompt and one fresh conversation, with nothing else in it', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw()) } }] })))
    await runReadTest(burton(), createSparkAgentReader('k', fetchFn as never), TODAY)
    const body = JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toMatch(/^You are a shopping agent reading this listing for a customer\. Answer the questions below from this listing only\./)
    expect(body.messages[0].content).not.toMatch(/Listing Optimizer|contradiction|mismatch|formal|trap/i) // no hint of a trap
    expect(JSON.parse(body.messages[1].content)).toEqual(readTestInput(burton(), TODAY))
    expect(body.messages[1].content).not.toMatch(/Final Sale|final_sale/)
  })

  it('during a scan the agent sees each listing once, displayed fields only, never another listing or a flag', async () => {
    const seen: unknown[] = []
    const w = world({ agent: scriptedAgent(seen) })
    await runScan({ merchant_id: NW }, w.deps)
    expect(seen).toHaveLength(9)
    for (const s of seen) {
      expect(Object.keys(s as object).sort()).toEqual(['listing', 'today'])
      expect(Object.keys((s as { listing: object }).listing).sort()).toEqual(['marketing_blurb', 'price', 'product_details', 'shipping', 'title'])
      expect(JSON.stringify(s)).not.toMatch(/Final Sale|final_sale|Free returns within 30 days|p[1-5]\.|Other Board/)
    }
  })
})

describe('Agent Read-Test: quote or "Not stated in listing", nothing invented', () => {
  it('keeps answers whose quotes are in the displayed listing', () => {
    const a = answers()
    expect(a.returns).toEqual({ answer: 'Yes, easy returns', quote: 'Easy returns.' })
    expect(a.delivery).toMatchObject({ days: 5, date: '2026-11-04', option: 'standard' })
    expect(a.cost).toMatchObject({ item_price: '$449.95', shipping_cost: 'Free', total: '$449.95' })
    expect(a.colour_size).toMatchObject({ colour: 'Serpent', size: '156 cm' })
    expect(a.dropped).toEqual([])
  })

  it('an answer with no quote, or a quote not in the listing, becomes "Not stated in listing"', () => {
    const a = answers({ returns: { answer: 'Free returns within 30 days', quote: 'Free returns within 30 days' } })
    expect(a.returns).toEqual({ answer: NOT_STATED, quote: null })
    expect(a.dropped[0]).toMatch(/Returns quote "Free returns within 30 days" is not in the displayed listing/)
    expect(answers({ returns: { answer: 'Yes, returnable', quote: null } }).returns.answer).toBe(NOT_STATED)
  })

  it('drops an invented price, shipping cost, number of days, colour or size', () => {
    const a = answers({
      delivery: { answer: 'In 3 days', option: 'standard', days: 3, date: null, quote: 'Standard: Free, 5 days' },
      cost: { answer: '$399 total', option: 'standard', item_price: '$399.00', shipping_cost: '$10', total: '$409', item_quote: '$449.95', shipping_quote: 'Standard: Free, 5 days' },
      colour_size: { answer: 'Blue, 160 cm', colour: 'Blue', size: '160 cm', quote: '156cm · Serpent' },
    })
    expect(a.delivery.answer).toBe(NOT_STATED)
    expect(a.cost).toMatchObject({ answer: NOT_STATED, item_price: null, shipping_cost: null, total: null })
    expect(a.colour_size).toMatchObject({ answer: NOT_STATED, colour: null, size: null })
    expect(a.dropped).toHaveLength(5)
  })

  it('a colour the listing does not show is "Not stated" (Orca shows no colour)', () => {
    const a = guardAnswers(raw({ colour_size: { answer: '156 cm', colour: 'Not stated in listing', size: '156 cm', quote: '156cm' } }), displayedListing(orca()))!
    expect(a.colour_size).toMatchObject({ colour: null, size: '156 cm' })
  })

  it('an answer that is not the JSON shape asked for is unavailable, not guessed', async () => {
    const bad: AgentReader = { read: async () => ({ ok: true, raw: { returns: 'yes' } }) }
    const t = await runReadTest(burton(), bad, TODAY)
    expect(t).toMatchObject({ source: 'unavailable', label: UNAVAILABLE_LABEL, questions: [] })
  })
})

describe('Agent Read-Test: code decides Match / Mismatch / Agent answer not stated', () => {
  it('Burton: "Easy returns" vs formal "Final Sale" is a mismatch, with the would-tell-customers line', () => {
    const r = byKey(compareReadTest(answers(), burton(), TODAY), 'returns')
    expect(r).toMatchObject({ result: 'mismatch', agent_answer: 'Yes, easy returns', formal_term: '"Final Sale"', agent_quotes: ['Easy returns.'] })
    expect(r.customer_line).toBe('An AI agent reading your listing would tell customers "Yes, easy returns", but your terms say "Final Sale".')
  })

  it('returns: "No, final sale" matches Final Sale; "Not stated" is no check; Orca "Free returns" matches', () => {
    expect(byKey(compareReadTest(answers({ returns: { answer: 'No, final sale', quote: 'Easy returns.' } }), burton(), TODAY), 'returns').result).toBe('match')
    const ns = byKey(compareReadTest(answers({ returns: { answer: NOT_STATED, quote: null } }), burton(), TODAY), 'returns')
    expect(ns).toMatchObject({ result: 'not_stated', customer_line: null })
    const o = guardAnswers(raw({ returns: { answer: 'Yes, free returns', quote: 'Free returns.' } }), displayedListing(orca()))!
    expect(byKey(compareReadTest(o, orca(), TODAY), 'returns').result).toBe('match')
  })

  it('delivery: code adds the catalogue days to today and compares exactly; a wrong date is a mismatch with both dates', () => {
    const ok = byKey(compareReadTest(answers(), burton(), TODAY), 'delivery')
    expect(ok).toMatchObject({ result: 'match', formal_term: 'standard shipping 5 days (arrives Wed 4 Nov 2026 if ordered Fri 30 Oct 2026)' })
    const wrong = byKey(compareReadTest(answers({ delivery: { answer: 'Arrives Nov 3', option: 'standard', days: 5, date: '2026-11-03', quote: 'Standard: Free, 5 days' } }), burton(), TODAY), 'delivery')
    expect(wrong.result).toBe('mismatch')
    expect(wrong.code_note).toBe('Mismatch: agent date Tue 3 Nov 2026 vs Wed 4 Nov 2026 calculated by code.')
    expect(wrong.customer_line).toMatch(/would tell customers "Arrives Nov 3", but your terms say standard shipping 5 days/)
  })

  it('cost: item price only with expedited picked is a mismatch ($449.95 vs $509.95); code does the arithmetic', () => {
    const c = byKey(compareReadTest(answers({ cost: { answer: '$449.95', option: 'expedited', option_reason: 'customer wants it fast', item_price: '$449.95', shipping_cost: null, total: null, item_quote: '$449.95', shipping_quote: null } }), burton(), TODAY), 'cost')
    expect(c).toMatchObject({ result: 'mismatch', formal_term: '$509.95 total (item $449.95 + expedited shipping $60.00)', agent_detail: 'Option the agent picked: expedited — why: customer wants it fast' })
    expect(c.code_note).toBe('Mismatch: agent gave the item price only $449.95 vs $509.95 calculated by code.')
    const right = byKey(compareReadTest(answers({ cost: { answer: '$509.95 total with expedited shipping', option: 'expedited', item_price: '$449.95', shipping_cost: '$60', total: '$509.95', item_quote: '$449.95', shipping_quote: 'Expedited: $60, 2 days' } }), burton(), TODAY), 'cost')
    expect(right.result).toBe('match')
    expect(byKey(compareReadTest(answers(), burton(), TODAY), 'cost').result).toBe('match') // free standard: item = total
  })

  it('colour / size: exact match with catalogue attributes; a different value is a mismatch; not stated is no check', () => {
    expect(byKey(compareReadTest(answers(), burton(), TODAY), 'colour_size')).toMatchObject({ result: 'match', formal_term: 'Serpent, 156 cm' })
    const wrongRow = { ...burton(), size_cm: 154 } // the catalogue says 154; the listing as displayed is built from the same row, so use the guarded answer directly
    expect(byKey(compareReadTest(answers(), wrongRow, TODAY), 'colour_size').result).toBe('mismatch')
    const ns = byKey(compareReadTest(answers({ colour_size: { answer: NOT_STATED, colour: null, size: null, quote: null } }), burton(), TODAY), 'colour_size')
    expect(ns).toMatchObject({ result: 'not_stated', customer_line: null })
  })

  it('code never changes the formal terms, the catalogue row or the agent answer', () => {
    const row = burton()
    const before = JSON.stringify(row)
    const a = answers()
    const aBefore = JSON.stringify(a)
    compareReadTest(a, row, TODAY)
    expect(JSON.stringify(row)).toBe(before)
    expect(JSON.stringify(a)).toBe(aBefore)
  })

  it('no mismatch: the all-match line and no would-tell-customers line', async () => {
    const t = await runReadTest(orca(), scriptedAgent(), TODAY)
    expect(t.questions.map((x) => x.result)).toEqual(['match', 'match', 'match', 'match'])
    expect(t.summary).toBe(ALL_MATCH_LINE)
    expect(t.questions.every((x) => x.customer_line === null)).toBe(true)
  })
})

describe('Agent Read-Test: unavailable', () => {
  it('no key, HTTP error or a thrown call shows the unavailable label and no answer', async () => {
    for (const reader of [
      createSparkAgentReader(null),
      createSparkAgentReader('k', (async () => new Response('x', { status: 500 })) as never),
      createSparkAgentReader('k', (async () => { throw new Error('down') }) as never),
      { read: async () => { throw new Error('boom') } } as AgentReader,
    ]) {
      const t = await runReadTest(burton(), reader, TODAY)
      expect(t).toMatchObject({ source: 'unavailable', label: 'Agent read-test unavailable — deterministic checks only', questions: [], summary: null })
    }
  })
})

describe('Agent Read-Test: re-run loop on a fixture listing (never the live catalogue)', () => {
  it('run 1 mismatches on returns; with "Easy returns" removed from the fixture blurb, run 2 answers "Not stated" and the line is gone', async () => {
    const w = world({ agent: scriptedAgent() })
    await runScan({ merchant_id: NW }, w.deps)
    const rt = (i: number) => ((w.tables.optimizer_scans[i].results as { product_id: string; read_test: Awaited<ReturnType<typeof runReadTest>> }[]).find((r) => r.product_id === BURTON)!.read_test)
    const run1 = rt(0)
    expect(byKey(run1.questions, 'returns')).toMatchObject({ agent_answer: 'Yes, easy returns', formal_term: '"Final Sale"', result: 'mismatch' })
    expect(run1.questions.filter((x) => x.customer_line)).toHaveLength(1)

    const fixture = w.products.find((x) => x.id === BURTON)! // the in-memory fixture copy only
    fixture.marketing_blurb = 'Directional twin all-mountain and freestyle board with a soft flex.'
    await runScan({ merchant_id: NW }, w.deps)
    const run2 = rt(1)
    expect(byKey(run2.questions, 'returns')).toMatchObject({ agent_answer: NOT_STATED, result: 'not_stated', customer_line: null })
    expect(run2.questions.some((x) => x.customer_line)).toBe(false)
    expect(run2.summary).toBe(`${ALL_MATCH_LINE} Not stated in listing, so not checked: Can this be returned?`)
  })
})

describe('Agent Read-Test stays apart from the pillars and from order data', () => {
  it('pillar results, flags and suggestions are identical with and without the read-test', async () => {
    const a = world()
    const b = world({ agent: scriptedAgent() })
    const ra = await runScan({ merchant_id: NW }, a.deps)
    const rb = await runScan({ merchant_id: NW }, b.deps)
    expect(rb).toMatchObject({ flags: (ra as { flags: number }).flags, read_test: { 'muse-spark': 9 } })
    expect(ra).toMatchObject({ read_test: { unavailable: 9 } })
    expect(b.tables.optimizer_suggestions).toEqual(a.tables.optimizer_suggestions)
    const strip = (rows: Record<string, unknown>[]) => rows.map(({ read_test, ...r }) => r)
    expect(strip(b.tables.optimizer_scans[0].results as never)).toEqual(strip(a.tables.optimizer_scans[0].results as never))
    expect(new Set(b.writes)).toEqual(new Set(['optimizer_scans', 'optimizer_suggestions']))
  })

  it('the read-test module reads no table and has no order, dispute, receipt or grant code', () => {
    const src = readFileSync('supabase/functions/optimizer/readtest.ts', 'utf8')
    expect(src).not.toMatch(/\.from\(|createClient|insert|update\(/)
    expect(src).not.toMatch(/order_id|dispute|receipt|grant|chargeback/i)
  })
})
