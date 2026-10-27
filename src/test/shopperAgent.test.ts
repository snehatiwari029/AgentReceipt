import { describe, expect, it } from 'vitest'
import { handle, type AgentReply, type Deps, type ProductRow, type Step, type Store } from '../../supabase/functions/shopper-agent/agent'
import { appendChained, type ChainDb } from '../../supabase/functions/shopper-agent/chain'
import { createMetaClient, META_CHAT_URL, MODEL_NAME, type ChatMessage, type ModelClient, type ModelReply } from '../../supabase/functions/shopper-agent/model'
import { verifyChain, type ChainRecord } from '../shared/chain'

const BURTON = '40c70768-77ac-4953-8bae-c75c8319fcf4'
const ORCA = 'd53088eb-40e0-4fa5-b2f8-1b81e9c7c37e'
const MERCHANT = '32b14be6-26e6-49df-a7af-79532f910510'

const PRODUCTS: ProductRow[] = [
  { id: BURTON, name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', category: 'snowboard', size_cm: 156, colour: 'Serpent', price_cents: 44995, currency: 'USD', marketing_blurb: 'Easy returns. Directional twin.', standard_shipping_cents: 0, standard_delivery_days: 5, expedited_shipping_cents: 6000, expedited_delivery_days: 4 },
  { id: ORCA, name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech', category: 'snowboard', size_cm: 156, colour: null, price_cents: 48983, currency: 'USD', marketing_blurb: 'Free returns.', standard_shipping_cents: 0, standard_delivery_days: 3, expedited_shipping_cents: null, expedited_delivery_days: null },
]

function memoryStore() {
  const tables: Record<string, Record<string, unknown>[]> = { sessions: [], session_events: [], grants: [], proposals: [], actions: [] }
  const chain: { chain_seq: number; table: string; row: Record<string, unknown> }[] = []
  const chainDb: ChainDb = {
    latestHash: async () => (chain.at(-1)?.row.entry_hash as string | undefined) ?? null,
    insert: async (table, row) => {
      tables[table].push(row)
      chain.push({ chain_seq: chain.length + 1, table, row })
    },
  }
  const store: Store = {
    listProducts: async () => PRODUCTS,
    merchantId: async () => MERCHANT,
    getGrant: async (sid) => {
      const g = tables.grants.find((x) => x.session_id === sid)
      if (!g) return null
      return { grantId: g.id as string, rules: { merchant: 'Northwind Outfitters', budget_max_cents: g.amount_max_cents as number, size_min_cm: g.size_min_cm as number, size_max_cm: g.size_max_cm as number, colour_preference: null, delivery_by: g.delivery_by as string, return_policy_required: g.return_policy_required as boolean, product_scope: g.product_scope as string, payment_method_ref: 'Demo PayPal' } }
    },
    hasStep: async (sid, step: Step) => tables.session_events.some((e) => e.session_id === sid && e.step === step),
    createSession: async (row) => void tables.sessions.push(row),
    logStep: async (session_id, step, detail, simulated) => void tables.session_events.push({ session_id, step, detail, simulated }),
    addGrant: async (row) => void (await appendChained(chainDb, 'grants', row)),
    addProposal: async (row) => void (await appendChained(chainDb, 'proposals', row)),
    addAction: async (grant_id, type, detail, believed) => {
      const seq = tables.actions.filter((a) => a.grant_id === grant_id).length + 1
      await appendChained(chainDb, 'actions', { id: `act-${chain.length}`, grant_id, seq, type, detail, agent_believed_terms: believed, image_evidence_ref: null })
      return seq
    },
  }
  return { store, tables, chain }
}

// A scripted stand-in for Muse. It only plays back model replies; it records what it was sent.
function fakeModel(script: ((messages: ChatMessage[]) => ModelReply)[]) {
  const seen: ChatMessage[][] = []
  let i = 0
  const model: ModelClient = {
    complete: async (messages) => {
      seen.push(JSON.parse(JSON.stringify(messages)))
      const f = script[i++]
      if (!f) throw new Error('model called more times than scripted')
      return f(messages)
    },
  }
  return { model, seen }
}

const call = (name: string, args: unknown, id = `c${Math.random()}`): ModelReply => ({ content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })

let n = 0
const deps = (model: ModelClient, store: Store): Deps => ({
  model, store, now: () => new Date('2026-10-26T18:00:00Z'), demoDate: null,
  newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
})

const HERO = 'Help me place an order for a snowboard for this weekend trip with my friends. It should look cool, size 150-165 cm, I need it by Friday. Budget under $500. I should be able to return it if it doesn\'t work for me.'
const heroArgs = { budget_max_dollars: 500, size_min_cm: 150, size_max_cm: 165, colour_preference: null, delivery_by: '2026-10-30', return_policy_required: true, product_scope: 'snowboard', why: 'Reading your request' }

async function asOk<T extends AgentReply['type']>(p: Promise<AgentReply>, type: T) {
  const r = await p
  expect(r.type).toBe(type)
  return r as Extract<AgentReply, { type: T }> & AgentReply
}

describe('shopper-agent: intake', () => {
  it('turns the plain-words request into confirmation fields and stores nothing yet', async () => {
    const m = memoryStore()
    const { model, seen } = fakeModel([() => call('capture_order_rules', heroArgs)])
    const r = await asOk(handle({ messages: [{ role: 'user', text: HERO }] }, deps(model, m.store)), 'confirm_rules')
    expect(r.draft).toMatchObject({ budget_max_cents: 50000, size_min_cm: 150, size_max_cm: 165, delivery_by: '2026-10-30', return_policy_required: true, payment_method_ref: 'Demo PayPal', merchant: 'Northwind Outfitters', colour_preference: null })
    expect(r.view.find((v) => v.label === 'Colour')?.value).toBe('Not specified')
    expect(r.view.find((v) => v.label === 'Needed by')?.value).toBe('Fri Oct 30')
    expect(r.steps).toEqual(['Muse is checking: Reading your request'])
    expect(m.tables.sessions).toHaveLength(0)
    // the model was told today's date, and never shown product data at this stage
    expect(JSON.stringify(seen[0])).toContain('2026-10-26 (today)')
  })

  it('asks a question instead when the model has nothing to record', async () => {
    const m = memoryStore()
    const { model } = fakeModel([() => ({ content: 'What are you shopping for?' })])
    const r = await asOk(handle({ messages: [{ role: 'user', text: 'hi' }] }, deps(model, m.store)), 'message')
    expect(r.text).toBe('What are you shopping for?')
  })

  it('rejects empty rules, bad dates and a false return flag (unmentioned is null, never false)', async () => {
    const m = memoryStore()
    const { model } = fakeModel([
      () => call('capture_order_rules', { budget_max_dollars: null, size_min_cm: null, size_max_cm: null, colour_preference: null, delivery_by: null, return_policy_required: null, product_scope: null, why: 'x' }),
      () => call('capture_order_rules', { ...heroArgs, delivery_by: 'Friday', return_policy_required: false, size_min_cm: 165, size_max_cm: 150 }),
    ])
    const r = await asOk(handle({ messages: [{ role: 'user', text: 'a board' }] }, deps(model, m.store)), 'confirm_rules')
    expect(r.draft.delivery_by).toBeNull()
    expect(r.draft.return_policy_required).toBeNull()
    expect([r.draft.size_min_cm, r.draft.size_max_cm]).toEqual([150, 165])
  })

  it('fails closed on bad requests and enforces the caps', async () => {
    const m = memoryStore()
    const { model } = fakeModel([])
    expect((await handle({ messages: [] }, deps(model, m.store))).type).toBe('error')
    expect((await handle({ messages: [{ role: 'user', text: 'x'.repeat(1001) }] }, deps(model, m.store))).type).toBe('error')
    expect((await handle({ messages: Array.from({ length: 41 }, () => ({ role: 'user', text: 'a' })) }, deps(model, m.store))).type).toBe('error')
    expect((await handle({ messages: [{ role: 'user', text: 'a' }], confirm: true }, deps(model, m.store))).type).toBe('error')
    expect((await handle({ messages: [{ role: 'user', text: 'a' }], session_id: 'nope' }, deps(model, m.store))).type).toBe('error')
  })
})

describe('shopper-agent: full hero flow', () => {
  it('confirm -> propose -> order writes the session log, grant, proposal and action in order, on a valid chain', async () => {
    const m = memoryStore()
    const d = (model: ModelClient) => deps(model, m.store)

    // 1. intake
    const r1 = await asOk(handle({ messages: [{ role: 'user', text: HERO }] }, d(fakeModel([() => call('capture_order_rules', heroArgs)]).model)), 'confirm_rules')

    // 2. confirm: the agent browses, then proposes Burton (expedited) and Orca (standard)
    const shopModel = fakeModel([
      () => call('search_products', { category: 'snowboard', max_item_price_dollars: 500, why: 'Looking at snowboards under $500' }, 's1'),
      () => call('get_product', { product_id: BURTON, why: 'Checking the Spellbinder' }, 's2'),
      () => call('propose_products', {
        message: 'Two good options.', why: 'Showing you my picks',
        offers: [{ product_id: BURTON, shipping_method: 'expedited', summary: 'Easy returns' }, { product_id: ORCA, shipping_method: 'standard', summary: 'Free returns' }],
      }),
    ])
    const history = [{ role: 'user', text: HERO }, { role: 'assistant', text: r1.text }]
    const r2 = await asOk(handle({ messages: history, confirm: true, draft: r1.draft }, d(shopModel.model)), 'proposals')
    expect(r2.session_id).toBeTruthy()
    expect(r2.offers.map((o) => [o.name, o.price_cents, o.summary, o.delivery_label])).toEqual([
      ['Spellbinder Snowboard 2026/2027', 44995, 'Easy returns', 'Fri Oct 30'],
      ['T. Rice Orca Snowboard 2025/2026', 48983, 'Free returns', 'Thu Oct 29'],
    ])
    expect(r2.steps).toHaveLength(3)
    // what the model saw from the tools: summaries, prices, shipping. Never formal terms.
    const toolText = JSON.stringify(shopModel.seen.at(-1))
    expect(toolText).toContain('Easy returns')
    expect(toolText).not.toMatch(/final.?sale|formal|terms_text|verdict|mismatch|receipt/i)

    // 3. customer orders
    const orderModel = fakeModel([() => call('place_order', { product_id: BURTON, why: 'Placing your order' })])
    const typed = 'Serpent looks cool. Order it. Use my PayPal account for checkout.'
    const r3 = await asOk(handle({ messages: [...history, { role: 'assistant', text: r2.text }, { role: 'user', text: typed }], session_id: r2.session_id, offers: r2.offers }, d(orderModel.model)), 'ordered')
    expect(r3.order).toMatchObject({ product_name: 'Spellbinder Snowboard 2026/2027', colour: 'Serpent', size_cm: 156, item_price_cents: 44995, shipping_cents: 6000, total_cents: 50995, delivery_label: 'Fri Oct 30', payment_label: 'Demo PayPal' })

    // session log, exact order, stops at "Order received"
    expect(m.tables.session_events.map((e) => e.step)).toEqual(['verified_agent_detected', 'session_started', 'intent_captured', 'intent_hash_recorded', 'grant_captured', 'order_received'])
    expect(m.tables.session_events[0]).toMatchObject({ simulated: true, detail: { agent_id: 'meta-muse-j0376672', agent_verified: true, label: 'simulated' } })
    expect(m.tables.sessions[0]).toMatchObject({ agent_id: 'meta-muse-j0376672', agent_verified: true, agent_verified_simulated: true })

    // grant stored as fields, no chat text
    const grant = m.tables.grants[0]
    expect(grant).toMatchObject({ amount_max_cents: 50000, budget_limit_cents: 50000, size_min_cm: 150, size_max_cm: 165, delivery_by: '2026-10-30', return_policy_required: true, payment_method_ref: 'Demo PayPal', colour_preference: null, shipping_method: null })
    expect(JSON.stringify(m.tables)).not.toContain('look cool')
    expect(JSON.stringify(m.tables)).not.toContain('weekend trip')
    expect(String(grant.private_chat_hash)).toMatch(/^sha256:[0-9a-f]{64}$/)

    // proposal: total NOT stored as shown
    expect(m.tables.proposals[0]).toMatchObject({ shown_item_price_cents: 44995, shown_total_cents: null, shown_returns_summary: 'Easy returns', shown_delivery: 'Fri Oct 30' })
    // actions: the view, then the checkout with the believed terms
    const checkout = m.tables.actions.find((a) => a.type === 'checkout')!
    expect(checkout).toMatchObject({ agent_believed_terms: { returns: 'Easy returns' }, detail: { item_price_cents: 44995, shipping_method: 'expedited', shipping_cents: 6000, total_cents: 50995, delivery_date: '2026-10-30', size_cm: 156, colour: 'Serpent' } })

    // the whole chain verifies, and an edit to any stored record fails it
    const records: ChainRecord[] = m.chain.map((c) => ({ chain_seq: c.chain_seq, entry_type: c.table === 'grants' ? 'grant' : c.table === 'proposals' ? 'proposal' : 'action', row: c.row as ChainRecord['row'] }))
    expect((await verifyChain(records)).ok).toBe(true)
    const edited = records.map((r, i) => (i === 0 ? { ...r, row: { ...r.row, amount_max_cents: 99900 } } : r))
    expect((await verifyChain(edited)).ok).toBe(false)
  })

  it('refuses place_order for an option the customer was never shown, and does not write', async () => {
    const m = memoryStore()
    const r1 = await asOk(handle({ messages: [{ role: 'user', text: HERO }] }, deps(fakeModel([() => call('capture_order_rules', heroArgs)]).model, m.store)), 'confirm_rules')
    const r2 = await asOk(handle({ messages: [{ role: 'user', text: HERO }], confirm: true, draft: r1.draft }, deps(fakeModel([() => ({ content: 'What colour?' })]).model, m.store)), 'message')
    const { model } = fakeModel([() => call('place_order', { product_id: BURTON, why: 'x' }), () => ({ content: 'Let me show you options first.' })])
    const r = await asOk(handle({ messages: [{ role: 'user', text: 'order it' }], session_id: r2.session_id, offers: [] }, deps(model, m.store)), 'message')
    expect(r.text).toContain('options first')
    expect(m.tables.proposals).toHaveLength(0)
    expect(m.tables.session_events.some((e) => e.step === 'order_received')).toBe(false)
  })

  it('does not enforce the budget itself (the receipt must be able to catch an overstep)', async () => {
    const m = memoryStore()
    const r1 = await asOk(handle({ messages: [{ role: 'user', text: HERO }] }, deps(fakeModel([() => call('capture_order_rules', heroArgs)]).model, m.store)), 'confirm_rules')
    const r2 = await asOk(handle({ messages: [{ role: 'user', text: HERO }], confirm: true, draft: r1.draft }, deps(fakeModel([() => call('propose_products', { message: 'x', why: 'x', offers: [{ product_id: BURTON, shipping_method: 'expedited', summary: 'Easy returns' }] })]).model, m.store)), 'proposals')
    const r3 = await asOk(handle({ messages: [{ role: 'user', text: 'order it' }], session_id: r2.session_id, offers: r2.offers }, deps(fakeModel([() => call('place_order', { product_id: BURTON, why: 'x' })]).model, m.store)), 'ordered')
    expect(r3.order.total_cents).toBe(50995)
    expect(r3.order.total_cents).toBeGreaterThan(50000)
  })

  it('will not place a second order in the same session', async () => {
    const m = memoryStore()
    const r1 = await asOk(handle({ messages: [{ role: 'user', text: HERO }] }, deps(fakeModel([() => call('capture_order_rules', heroArgs)]).model, m.store)), 'confirm_rules')
    const r2 = await asOk(handle({ messages: [{ role: 'user', text: HERO }], confirm: true, draft: r1.draft }, deps(fakeModel([() => call('propose_products', { message: 'x', why: 'x', offers: [{ product_id: ORCA, shipping_method: 'standard', summary: 'Free returns' }] })]).model, m.store)), 'proposals')
    const order = () => handle({ messages: [{ role: 'user', text: 'order it' }], session_id: r2.session_id, offers: r2.offers }, deps(fakeModel([() => call('place_order', { product_id: ORCA, why: 'x' })]).model, m.store))
    expect((await order()).type).toBe('ordered')
    const again = await order()
    expect(again.type).toBe('message')
    expect(m.tables.proposals).toHaveLength(1)
  })
})

describe('Meta Model API client', () => {
  it('fails with the clear message when MODEL_API_KEY is missing', () => {
    expect(() => createMetaClient(undefined)).toThrow('MODEL_API_KEY not set in Supabase secrets')
    expect(() => createMetaClient('  ')).toThrow('MODEL_API_KEY not set in Supabase secrets')
  })

  it('posts to the documented endpoint with tool_choice auto and the muse-spark-1.3 model', async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'hi' } }] }), { status: 200 })
    }) as unknown as typeof fetch
    const client = createMetaClient('test-key', fake)
    const r = await client.complete([{ role: 'user', content: 'x' }], [{ type: 'function', function: { name: 'a', description: 'b', parameters: { type: 'object' } } }])
    expect(r.content).toBe('hi')
    expect(seen!.url).toBe(META_CHAT_URL)
    expect(META_CHAT_URL).toBe('https://api.meta.ai/v1/chat/completions')
    const body = JSON.parse(seen!.init.body as string)
    expect(body).toMatchObject({ model: MODEL_NAME, tool_choice: 'auto', parallel_tool_calls: false })
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('does not leak the key in errors', async () => {
    const fake = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch
    await expect(createMetaClient('secret-key-123', fake).complete([], [])).rejects.toThrow(/401/)
    await createMetaClient('secret-key-123', fake).complete([], []).catch((e: Error) => expect(e.message).not.toContain('secret-key-123'))
  })
})
