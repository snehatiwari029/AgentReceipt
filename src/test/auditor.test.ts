import { describe, expect, it } from 'vitest'
import { handle, type AgentReply, type ProductRow, type Step, type Store } from '../../supabase/functions/shopper-agent/agent'
import { appendChained, type ChainDb } from '../../supabase/functions/auditor/chain'
import { runAuditor, type AuditorDb } from '../../supabase/functions/auditor/run'
import { createSparkReader, type SemanticReader } from '../../supabase/functions/auditor/spark'
import type { ModelClient, ModelReply } from '../../supabase/functions/shopper-agent/model'
import { verifyChain, type ChainRecord } from '../shared/chain'

const BURTON = '40c70768-77ac-4953-8bae-c75c8319fcf4'
const ORCA = 'd53088eb-40e0-4fa5-b2f8-1b81e9c7c37e'
const MERCHANT = '32b14be6-26e6-49df-a7af-79532f910510'

const PRODUCTS: ProductRow[] = [
  { id: BURTON, name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', category: 'snowboard', size_cm: 156, colour: 'Serpent', price_cents: 44995, currency: 'USD', marketing_blurb: 'Easy returns.', standard_shipping_cents: 0, standard_delivery_days: 5, expedited_shipping_cents: 6000, expedited_delivery_days: 4 },
  { id: ORCA, name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech', category: 'snowboard', size_cm: 156, colour: null, price_cents: 48983, currency: 'USD', marketing_blurb: 'Free returns.', standard_shipping_cents: 0, standard_delivery_days: 3, expedited_shipping_cents: null, expedited_delivery_days: null },
]
const TERMS: Record<string, { formal_returns: string; formal_terms_text: string }> = {
  [BURTON]: { formal_returns: 'final_sale', formal_terms_text: 'Final Sale' },
  [ORCA]: { formal_returns: 'free', formal_terms_text: 'Free returns within 30 days' },
}

// One in-memory "database" that plays Postgres: it assigns chain_seq and created_at, like the real tables do.
function world() {
  const tables: Record<string, Record<string, unknown>[]> = { sessions: [], session_events: [], grants: [], proposals: [], actions: [], receipts: [] }
  const reads: string[] = []
  let seq = 0
  const stamp = (table: string, row: Record<string, unknown>) => {
    seq += 1
    const stored = { ...row, chain_seq: seq, created_at: '2026-10-26T18:00:00.000Z' }
    tables[table].push(stored)
    return stored
  }
  const chainRows = () => ['grants', 'proposals', 'actions', 'receipts'].flatMap((t) => tables[t]).sort((a, b) => (a.chain_seq as number) - (b.chain_seq as number))
  const chainDb: ChainDb = {
    latestHash: async () => (chainRows().at(-1)?.entry_hash as string | undefined) ?? null,
    insert: async (table, row) => void stamp(table, row),
  }
  const store: Store = {
    listProducts: async () => PRODUCTS,
    merchantId: async () => MERCHANT,
    hasStep: async (sid, step: Step) => tables.session_events.some((e) => e.session_id === sid && e.step === step),
    createSession: async (row) => void tables.sessions.push(row),
    logStep: async (session_id, step, detail, simulated) => void tables.session_events.push({ session_id, step, detail, simulated }),
    addGrant: async (row) => void (await appendChained(chainDb, 'grants', row)),
    addProposal: async (row) => void (await appendChained(chainDb, 'proposals', row)),
    addAction: async (grant_id, type, detail, believed) => {
      await appendChained(chainDb, 'actions', { id: `act-${seq}`, grant_id, seq: 1, type, detail, agent_believed_terms: believed, image_evidence_ref: null })
      return 1
    },
  }
  const auditorDb: AuditorDb = {
    ...chainDb,
    sessionExists: async (id) => tables.sessions.some((s) => s.id === id),
    grantForSession: async (id) => { reads.push(`grant:${id}`); return tables.grants.find((g) => g.session_id === id) ?? null },
    proposalForGrant: async (id) => tables.proposals.find((p) => p.grant_id === id) ?? null,
    checkoutForGrant: async (id) => tables.actions.find((a) => a.grant_id === id && a.type === 'checkout') ?? null,
    product: async (id) => {
      const p = PRODUCTS.find((x) => x.id === id)
      const t = TERMS[id]
      return p && t ? { category: p.category, ...t, merchant_name: 'Northwind Outfitters', row: { ...p } } : null
    },
    merchantName: async () => 'Northwind Outfitters',
    entryHashAt: async (s) => (chainRows().find((r) => r.chain_seq === s)?.entry_hash as string | undefined) ?? null,
    receiptForGrant: async (id) => tables.receipts.find((r) => r.grant_id === id) ?? null,
    refs: async () => tables.receipts.map((r) => ({ receipt_ref: r.receipt_ref as string, order_ref: (r.order_ref as string | null) ?? null })),
    logStep: async (session_id, step, detail) => void tables.session_events.push({ session_id, step, detail, simulated: false }),
  }
  const records = (): ChainRecord[] => chainRows().map((r) => ({ chain_seq: r.chain_seq as number, entry_type: ((['grants', 'proposals', 'actions', 'receipts'] as const).find((t) => tables[t].includes(r))!.slice(0, -1)) as ChainRecord['entry_type'], row: r as ChainRecord['row'] }))
  return { tables, store, auditorDb, reads, records, attention: () => tables.receipts.filter((r) => r.decision === 'hold' || r.decision === 'review').length }
}

const call = (name: string, args: unknown, id = `c${Math.random()}`): ModelReply => ({ content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })
const fake = (script: (() => ModelReply)[]): ModelClient => {
  let i = 0
  return { complete: async () => { const f = script[i++]; if (!f) throw new Error('over-called'); return f() } }
}

let n = 0
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const NOW = () => new Date('2026-10-26T18:00:00Z')
const CHAT = 'Help me place an order for a snowboard for this weekend trip with my friends. It should look cool, size 150-165 cm, I need it by Friday. Budget under $500. I should be able to return it if it doesn\'t work for me.'
const rules = { budget_max_dollars: 500, size_min_cm: 150, size_max_cm: 165, colour_preference: null, delivery_by: '2026-10-30', return_policy_required: true, product_scope: 'snowboard', why: 'Reading your request' }

// The reader the auditor uses. Records exactly what Spark would be sent.
function reader(kind: 'returnable' | 'final_sale' | 'unclear' = 'returnable') {
  const sent: [string, string][] = []
  const r: SemanticReader = { readReturns: async (b, f) => { sent.push([b, f]); return { believed_kind: kind, source: 'muse-spark' } } }
  return { r, sent }
}

// A full order through the real shopper brain, with the order-received signal wired to the real auditor.
async function placeOrder(w: ReturnType<typeof world>, pick: { id: string; ship: 'standard' | 'expedited'; said: string }, r: SemanticReader, wire = true) {
  const first = (await handle({ messages: [{ role: 'user', text: CHAT }] }, {
    model: fake([
      () => call('set_order_rules', rules, 'a'),
      () => call('propose_products', { message: 'Looking for snowboards under $500 that arrive by Friday and that you can return. Here are two options:', payment_stated: false, why: 'Showing picks', offers: [{ product_id: pick.id, shipping_method: pick.ship, summary: pick.said }] }),
    ]),
    store: w.store, now: NOW, newId,
  })) as Extract<AgentReply, { type: 'proposals' }> & AgentReply
  expect(first.type).toBe('proposals')
  const done = await handle(
    { messages: [{ role: 'user', text: CHAT }, { role: 'assistant', text: first.text }, { role: 'user', text: 'Order it. Use my PayPal.' }], draft: first.draft, offers: first.offers },
    {
      model: fake([() => call('place_order', { product_id: pick.id, payment_method: 'PayPal', why: 'Placing your order' })]), store: w.store, now: NOW, newId,
      onOrderReceived: wire ? async (sid) => void (await runAuditor({ session_id: sid }, { db: w.auditorDb, reader: r, now: NOW, newId })) : undefined,
    },
  )
  expect(done.type).toBe('ordered')
  return done as Extract<AgentReply, { type: 'ordered' }> & AgentReply
}

describe('auditor: live runs on stored records', () => {
  it('hero: the auditor runs at order received, finds 2 problems, HOLD, and Orders requiring attention goes 0 -> 1', async () => {
    const w = world()
    const rd = reader('returnable')
    // Scenario B first: PASS, nothing needs attention
    await placeOrder(w, { id: ORCA, ship: 'standard', said: 'Free returns' }, rd.r)
    expect(w.tables.receipts).toHaveLength(1)
    expect(w.tables.receipts[0]).toMatchObject({ decision: 'pass', problems_found: 0, fulfillment: 'proceed', recommendation: null })
    expect(w.attention()).toBe(0)

    // the hero: Burton + expedited, told "Easy returns" while the formal terms are Final sale
    await placeOrder(w, { id: BURTON, ship: 'expedited', said: 'Easy returns' }, rd.r)
    expect(w.tables.receipts).toHaveLength(2)
    const hero = w.tables.receipts[1]
    expect(hero).toMatchObject({ decision: 'hold', problems_found: 2, fulfillment: 'held', recommendation: null, missing_components: [] })
    expect((hero.audit as { problem_fields: string[] }).problem_fields).toEqual(['Budget', 'Returns'])
    expect(hero.receipt_ref).toBe('AR-2026-0002')
    expect(hero.order_ref).toBe('15002')
    expect(w.attention()).toBe(1) // no dispute was filed; the order is flagged immediately
    // the receipt is a real chained, sealed record that verifies
    expect(typeof hero.sealed_at).toBe('string')
    expect((await verifyChain(w.records())).ok).toBe(true)
    // receipt_issued is logged on the session
    expect(w.tables.session_events.filter((e) => e.step === 'receipt_issued')).toHaveLength(2)
    // editing the stored receipt breaks verification
    const forged = w.records().map((r) => (r.row.receipt_ref === 'AR-2026-0002' ? { ...r, row: { ...r.row, problems_found: 0 } } : r))
    expect((await verifyChain(forged)).ok).toBe(false)
  })

  it('a repeat call returns the verdict already on record and writes nothing', async () => {
    const w = world()
    const rd = reader()
    const done = await placeOrder(w, { id: BURTON, ship: 'expedited', said: 'Easy returns' }, rd.r)
    const again = await runAuditor({ session_id: done.session_id }, { db: w.auditorDb, reader: rd.r, now: NOW, newId })
    expect(again).toMatchObject({ type: 'audit', issued: false, receipt_ref: 'AR-2026-0001' })
    expect(w.tables.receipts).toHaveLength(1)
  })

  it('tamper: an action edited after it was written fails hash recomputation -> REVIEW, never pass', async () => {
    const w = world()
    const rd = reader()
    const done = await placeOrder(w, { id: ORCA, ship: 'standard', said: 'Free returns' }, rd.r, false)
    const action = w.tables.actions[0]
    ;(action.detail as Record<string, unknown>).total_cents = 4498 // $44.99
    const r = await runAuditor({ session_id: done.session_id }, { db: w.auditorDb, reader: rd.r, now: NOW, newId })
    expect(r.type).toBe('audit')
    if (r.type !== 'audit') return
    expect(r.audit.decision).toBe('review')
    expect(r.audit.tamper_failed).toBe(true)
    expect(r.attention).toBe(true)
    expect(w.tables.receipts[0]).toMatchObject({ decision: 'review' })
  })

  it('missing formal terms: REVIEW with terms listed missing, Returns neither passed nor failed', async () => {
    const w = world()
    const rd = reader()
    const done = await placeOrder(w, { id: ORCA, ship: 'standard', said: 'Free returns' }, rd.r, false)
    const db: AuditorDb = { ...w.auditorDb, product: async () => null }
    const r = await runAuditor({ session_id: done.session_id }, { db, reader: rd.r, now: NOW, newId })
    if (r.type !== 'audit') throw new Error('expected audit')
    expect(r.audit.decision).toBe('review')
    expect(r.audit.missing_components).toContain('formal terms')
    expect(r.audit.checks.find((c) => c.field === 'Returns')!.result).toBe('missing')
  })

  it('gap: an unknown session gives no decision, no verdict and writes no receipt', async () => {
    const w = world()
    const r = await runAuditor({ session_id: '11111111-1111-4111-8111-111111111111' }, { db: w.auditorDb, reader: reader().r, now: NOW, newId })
    if (r.type !== 'audit') throw new Error('expected audit')
    expect(r.audit.decision).toBeNull()
    expect(r.audit.gap).toBe('Unverified agent, no AgentReceipt session opened, no receipt (gap recorded)')
    expect(w.tables.receipts).toHaveLength(0)
  })

  it('isolation: reads one order, sends Spark only two short texts, and the receipt holds no chat, reasoning or card details', async () => {
    const w = world()
    const rd = reader()
    await placeOrder(w, { id: ORCA, ship: 'standard', said: 'Free returns' }, rd.r) // another order already on record
    const done = await placeOrder(w, { id: BURTON, ship: 'expedited', said: 'Easy returns' }, rd.r)
    w.reads.length = 0
    rd.sent.length = 0
    await runAuditor({ session_id: done.session_id }, { db: w.auditorDb, reader: rd.r, now: NOW, newId })
    expect(w.reads).toEqual([`grant:${done.session_id}`]) // only this order's grant is ever read
    expect(rd.sent).toEqual([]) // repeat call: nothing re-sent
    expect(rd.sent.concat(...[])).toEqual([])
    // first-run input to Spark for the hero: exactly the agent's returns text and the formal terms text
    const fresh = world()
    const rd2 = reader()
    await placeOrder(fresh, { id: BURTON, ship: 'expedited', said: 'Easy returns' }, rd2.r)
    expect(rd2.sent).toEqual([['Easy returns', 'Final Sale']])
    const stored = JSON.stringify(fresh.tables.receipts)
    expect(stored).not.toMatch(/weekend trip|looks cool|Use my PayPal/i)
    expect(stored).not.toMatch(/mastercard|visa|••|\d{4} \d{4}/i)
    expect(stored).not.toMatch(/liability column/i)
  })

  it('if Spark is unavailable the keyword reading is used and labelled, and a Final sale still fails', async () => {
    const w = world()
    const failing: SemanticReader = createSparkReader(undefined)
    await placeOrder(w, { id: BURTON, ship: 'expedited', said: 'Easy returns' }, failing)
    const a = w.tables.receipts[0].audit as { semantic_source: string; problem_fields: string[]; decision: string }
    expect(a.semantic_source).toBe('rules-fallback')
    expect(a.problem_fields).toEqual(['Budget', 'Returns'])
    expect(a.decision).toBe('hold')
  })
})

describe('auditor: Muse Spark reader', () => {
  const ok = (content: string) => (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })) as unknown as typeof fetch

  it('sends only the two short texts and uses the answer', async () => {
    let body = ''
    const f = (async (_u: string, init: RequestInit) => { body = String(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: '{"believed_kind":"returnable"}' } }] }), { status: 200 }) }) as unknown as typeof fetch
    const r = await createSparkReader('key', f).readReturns('Easy returns', 'Final Sale')
    expect(r).toEqual({ believed_kind: 'returnable', source: 'muse-spark' })
    expect(body).toContain('"model":"muse-spark-1.3"')
    expect(body).toContain('Easy returns')
    expect(body).not.toMatch(/tool_calls|weekend|budget/i)
  })

  it('falls back, labelled, on no key, an error, or an unreadable answer', async () => {
    expect(await createSparkReader(undefined).readReturns('Final sale', 'Final Sale')).toEqual({ believed_kind: 'final_sale', source: 'rules-fallback' })
    expect(await createSparkReader('k', (async () => new Response('no', { status: 500 })) as unknown as typeof fetch).readReturns('Easy returns', 'x')).toMatchObject({ source: 'rules-fallback', believed_kind: 'returnable' })
    expect(await createSparkReader('k', ok('I think it is fine')).readReturns('Easy returns', 'x')).toMatchObject({ source: 'rules-fallback' })
    expect(await createSparkReader('k', (async () => { throw new Error('net') }) as unknown as typeof fetch).readReturns('See you soon', 'x')).toEqual({ believed_kind: 'unclear', source: 'rules-fallback' })
  })
})
