// The shopper agent's brain. Pure TypeScript: the model, the database and the clock are injected, so tests run
// it with a fake model. It only ever sees the store's product summaries, never the store's fine print or any merchant-side data.
import { canonicalJson, sha256Hex } from './hash.ts'
import type { ChatMessage, ModelClient, ToolDef } from './model.ts'

export const AGENT_ID = 'meta-muse-j0376672'
export const MERCHANT_NAME = 'Northwind Outfitters'
export const PAYMENT_LABEL = 'Demo PayPal'
export const SCHEMA_LABEL = 'VI-aligned demo representation'
export const MAX_MESSAGES = 40
export const MAX_TEXT = 1000
export const MAX_MODEL_TURNS = 6

// ---------- types ----------
export type Msg = { role: 'user' | 'assistant'; text: string }

// What the store tells the agent about a product. No formal terms, ever.
export type ProductRow = {
  id: string
  name: string
  brand: string | null
  category: string
  size_cm: number
  colour: string | null
  price_cents: number
  currency: string
  marketing_blurb: string | null
  standard_shipping_cents: number
  standard_delivery_days: number
  expedited_shipping_cents: number | null
  expedited_delivery_days: number | null
}

export type Rules = {
  merchant: typeof MERCHANT_NAME
  budget_max_cents: number | null
  size_min_cm: number | null
  size_max_cm: number | null
  colour_preference: string | null
  delivery_by: string | null
  return_policy_required: boolean | null
  product_scope: string | null
  payment_method_ref: typeof PAYMENT_LABEL
}

export type Shipping = 'standard' | 'expedited'

export type Offer = {
  product_id: string
  name: string
  brand: string | null
  size_cm: number
  colour: string | null
  price_cents: number
  summary: string
  delivery_label: string
  delivery_date: string
  shipping_method: Shipping
  shown_at: string
}

export type OrderView = {
  product_name: string
  brand: string | null
  size_cm: number
  colour: string | null
  item_price_cents: number
  shipping_label: string
  shipping_cents: number
  total_cents: number
  delivery_label: string
  payment_label: string
}

export type AgentReply = { session_id?: string; steps?: string[] } & (
  | { type: 'message'; text: string }
  | { type: 'confirm_rules'; text: string; draft: Rules; view: { label: string; value: string }[] }
  | { type: 'proposals'; text: string; offers: Offer[] }
  | { type: 'ordered'; text: string; order: OrderView }
  | { type: 'error'; message: string }
)

export type AgentRequest = {
  messages: Msg[]
  session_id: string | null
  draft: Rules | null
  offers: Offer[]
  confirm: boolean
}

export type Step =
  | 'verified_agent_detected' | 'session_started' | 'intent_captured' | 'intent_hash_recorded'
  | 'grant_captured' | 'order_received' | 'receipt_issued'

export interface Store {
  listProducts(): Promise<ProductRow[]>
  merchantId(): Promise<string>
  getGrant(sessionId: string): Promise<{ grantId: string; rules: Rules } | null>
  hasStep(sessionId: string, step: Step): Promise<boolean>
  createSession(row: Record<string, unknown>): Promise<void>
  logStep(sessionId: string, step: Step, detail: Record<string, unknown>, simulated: boolean): Promise<void>
  addGrant(row: Record<string, unknown>): Promise<void>
  addProposal(row: Record<string, unknown>): Promise<void>
  addAction(grantId: string, type: string, detail: Record<string, unknown>, believed: Record<string, unknown> | null): Promise<number>
}

export type Deps = {
  model: ModelClient
  store: Store
  now: () => Date
  demoDate?: string | null
  newId: () => string
}

// ---------- small helpers ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function isoDateIn(d: Date, timeZone = 'America/Los_Angeles'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function dayLabel(date: string): string {
  const t = new Date(`${date}T00:00:00Z`)
  return `${DAYS[t.getUTCDay()]} ${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`
}

function validDate(s: unknown): s is string {
  return typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())
}

export function today(deps: Deps): string {
  return deps.demoDate && validDate(deps.demoDate) ? deps.demoDate : isoDateIn(deps.now())
}

function calendar(from: string): string {
  return Array.from({ length: 8 }, (_, i) => {
    const d = addDays(from, i)
    return `${DAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${d}${i === 0 ? ' (today)' : ''}`
  }).join(', ')
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

const posInt = (v: unknown): number | null => {
  const n = toNum(v)
  return n !== null && n > 0 ? Math.round(n) : null
}

function parseArgs(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// ---------- rules ----------
function finishRules(r: Omit<Rules, 'merchant' | 'payment_method_ref'>): Rules {
  let { size_min_cm, size_max_cm } = r
  if (size_min_cm !== null && size_max_cm !== null && size_min_cm > size_max_cm) [size_min_cm, size_max_cm] = [size_max_cm, size_min_cm]
  return { merchant: MERCHANT_NAME, ...r, size_min_cm, size_max_cm, payment_method_ref: PAYMENT_LABEL }
}

// From the model's tool arguments (budget in dollars). Unmentioned or invalid = null, never false.
export function rulesFromModel(args: Record<string, unknown>, todayDate: string): Rules {
  const dollars = toNum(args.budget_max_dollars)
  const by = args.delivery_by
  return finishRules({
    budget_max_cents: dollars !== null && dollars > 0 ? Math.round(dollars * 100) : null,
    size_min_cm: posInt(args.size_min_cm),
    size_max_cm: posInt(args.size_max_cm),
    colour_preference: clean(args.colour_preference, 40),
    delivery_by: validDate(by) && by >= todayDate ? by : null,
    return_policy_required: args.return_policy_required === true ? true : null,
    product_scope: clean(args.product_scope, 60),
  })
}

// From a draft sent back by the phone screen: re-checked the same way, in cents.
export function rulesFromDraft(raw: unknown): Rules | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const cents = posInt(d.budget_max_cents)
  const rules = finishRules({
    budget_max_cents: cents,
    size_min_cm: posInt(d.size_min_cm),
    size_max_cm: posInt(d.size_max_cm),
    colour_preference: clean(d.colour_preference, 40),
    delivery_by: validDate(d.delivery_by) ? d.delivery_by : null,
    return_policy_required: d.return_policy_required === true ? true : null,
    product_scope: clean(d.product_scope, 60),
  })
  return hasAnyRule(rules) ? rules : null
}

export function hasAnyRule(r: Rules): boolean {
  return [r.budget_max_cents, r.size_min_cm, r.size_max_cm, r.colour_preference, r.delivery_by, r.return_policy_required, r.product_scope]
    .some((v) => v !== null)
}

export function rulesView(r: Rules): { label: string; value: string }[] {
  const size = r.size_min_cm && r.size_max_cm ? `${r.size_min_cm}–${r.size_max_cm} cm` : r.size_min_cm ? `${r.size_min_cm} cm or longer` : r.size_max_cm ? `${r.size_max_cm} cm or shorter` : 'Not specified'
  return [
    { label: 'Store', value: r.merchant },
    { label: 'Looking for', value: r.product_scope ?? 'Not specified' },
    { label: 'Budget', value: r.budget_max_cents ? `Under ${usd(r.budget_max_cents)}` : 'Not specified' },
    { label: 'Size', value: size },
    { label: 'Colour', value: r.colour_preference ?? 'Not specified' },
    { label: 'Needed by', value: r.delivery_by ? dayLabel(r.delivery_by) : 'Not specified' },
    { label: 'Returns', value: r.return_policy_required ? 'Must be returnable' : 'Not specified' },
    { label: 'Payment', value: r.payment_method_ref },
  ]
}

// ---------- request checking ----------
export function parseRequest(raw: unknown): AgentRequest | string {
  if (!raw || typeof raw !== 'object') return 'Bad request'
  const b = raw as Record<string, unknown>
  if (!Array.isArray(b.messages) || b.messages.length === 0) return 'Please send a message.'
  if (b.messages.length > MAX_MESSAGES) return 'This chat is too long. Please start a new one.'
  const messages: Msg[] = []
  for (const m of b.messages) {
    const o = m as Record<string, unknown>
    if ((o?.role !== 'user' && o?.role !== 'assistant') || typeof o.text !== 'string') return 'Bad message.'
    const text = o.text.trim()
    if (!text) continue
    if (text.length > MAX_TEXT) return `Messages can be at most ${MAX_TEXT} characters.`
    messages.push({ role: o.role, text })
  }
  if (messages.length === 0) return 'Please send a message.'
  const sid = b.session_id
  if (sid !== undefined && sid !== null && !(typeof sid === 'string' && UUID_RE.test(sid))) return 'Bad session.'
  const offers: Offer[] = []
  if (Array.isArray(b.offers)) {
    for (const o of b.offers.slice(0, 3)) {
      const r = o as Record<string, unknown>
      if (typeof r?.product_id !== 'string' || !UUID_RE.test(r.product_id)) continue
      if (r.shipping_method !== 'standard' && r.shipping_method !== 'expedited') continue
      const summary = clean(r.summary, 80)
      const shown = typeof r.shown_at === 'string' && !Number.isNaN(Date.parse(r.shown_at)) ? new Date(r.shown_at).toISOString() : null
      if (!summary || !shown) continue
      offers.push({
        product_id: r.product_id, name: clean(r.name, 120) ?? '', brand: clean(r.brand, 40), size_cm: posInt(r.size_cm) ?? 0,
        colour: clean(r.colour, 40), price_cents: posInt(r.price_cents) ?? 0, summary,
        delivery_label: clean(r.delivery_label, 20) ?? '', delivery_date: validDate(r.delivery_date) ? r.delivery_date : '',
        shipping_method: r.shipping_method, shown_at: shown,
      })
    }
  }
  return {
    messages,
    session_id: typeof sid === 'string' ? sid : null,
    draft: rulesFromDraft(b.draft),
    offers,
    confirm: b.confirm === true,
  }
}

// ---------- tools ----------
const why = { type: 'string', description: 'Plain words, under 12 words, shown to the customer: what you are doing and why.' }

const CAPTURE_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'capture_order_rules',
    description: "Record the rules the customer stated for this purchase. Use null for anything the customer did not mention. Never guess.",
    parameters: {
      type: 'object',
      properties: {
        budget_max_dollars: { type: ['number', 'null'], description: 'Budget the customer stated, in dollars.' },
        size_min_cm: { type: ['integer', 'null'] },
        size_max_cm: { type: ['integer', 'null'] },
        colour_preference: { type: ['string', 'null'] },
        delivery_by: { type: ['string', 'null'], description: 'Exact date YYYY-MM-DD the customer needs it by.' },
        return_policy_required: { type: ['boolean', 'null'], description: 'true only if the customer said it must be returnable; otherwise null.' },
        product_scope: { type: ['string', 'null'], description: 'What they want, e.g. "snowboard".' },
        why,
      },
      required: ['budget_max_dollars', 'size_min_cm', 'size_max_cm', 'colour_preference', 'delivery_by', 'return_policy_required', 'product_scope', 'why'],
    },
  },
}

const SHOP_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: "List Northwind products with the store's own product summary, price and shipping options. All filters are optional.",
      parameters: {
        type: 'object',
        properties: {
          category: { type: ['string', 'null'], enum: ['snowboard', 'ski', null] },
          max_item_price_dollars: { type: ['number', 'null'] },
          size_min_cm: { type: ['integer', 'null'] },
          size_max_cm: { type: ['integer', 'null'] },
          why,
        },
        required: ['why'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: 'Look closely at one product.',
      parameters: { type: 'object', properties: { product_id: { type: 'string' }, why }, required: ['product_id', 'why'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_products',
      description: 'Show the customer one or two options as cards. Each card shows item price, your summary and the delivery day. Then wait for the customer.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'One or two friendly sentences to the customer.' },
          offers: {
            type: 'array', minItems: 1, maxItems: 2,
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string' },
                shipping_method: { type: 'string', enum: ['standard', 'expedited'] },
                summary: { type: 'string', description: 'Under 60 characters: the return situation in plain words, from the product page text.' },
              },
              required: ['product_id', 'shipping_method', 'summary'],
            },
          },
          why,
        },
        required: ['message', 'offers', 'why'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_order',
      description: 'Place the order for an option the customer has seen and clearly told you to order.',
      parameters: { type: 'object', properties: { product_id: { type: 'string' }, why }, required: ['product_id', 'why'] },
    },
  },
]

// ---------- prompts ----------
function intakePrompt(t: string): string {
  return [
    'You are Muse, a friendly personal shopping assistant for a customer shopping at Northwind Outfitters (snowboards and skis).',
    `Today is ${t}. Upcoming days: ${calendar(t)}.`,
    "Read the customer's message and call capture_order_rules with the rules they stated.",
    'Record only what the customer actually said. Anything not mentioned is null. Never use false for something they did not mention.',
    'Turn a day like "Friday" into the exact date from the upcoming days above.',
    'If the message says nothing about what to buy or any limits, ask one short question instead of calling the tool.',
    'Keep replies short.',
  ].join('\n')
}

function shopPrompt(t: string, rules: Rules, offers: Offer[]): string {
  const shown = offers.length
    ? `Options already shown to the customer:\n${offers.map((o) => `- ${o.name} (product_id ${o.product_id}), you described its returns as "${o.summary}", delivery ${o.delivery_label}`).join('\n')}`
    : 'You have not shown the customer any options yet.'
  return [
    'You are Muse, a personal shopping agent for a customer at Northwind Outfitters.',
    `Today is ${t}. Upcoming days: ${calendar(t)}.`,
    `The customer confirmed these order rules. Act only inside them. They cannot be widened: ${JSON.stringify({
      budget_max_dollars: rules.budget_max_cents ? rules.budget_max_cents / 100 : null,
      size_min_cm: rules.size_min_cm, size_max_cm: rules.size_max_cm, colour_preference: rules.colour_preference,
      delivery_by: rules.delivery_by, return_policy_required: rules.return_policy_required, product_scope: rules.product_scope,
    })}`,
    "Use the tools to look at the store's products. You only see the store's product summaries, prices and shipping options.",
    'When you have good matches, call propose_products with one or two options. For each option choose the shipping method and write a short summary of the return situation from the product page text. The customer sees item price, your summary and the delivery day on each card, then decides.',
    'Only call place_order after the customer clearly tells you to order a specific option you showed.',
    shown,
    "Every tool call needs a short plain-words 'why' that the customer will see. Do not invent details the tools did not give you. Keep messages short.",
  ].join('\n')
}

// ---------- product views for the model ----------
function shippingOptions(p: ProductRow, t: string) {
  const out: { method: Shipping; cost: string; arrives: string; arrives_date: string }[] = [
    { method: 'standard', cost: p.standard_shipping_cents === 0 ? 'free' : usd(p.standard_shipping_cents), arrives: dayLabel(addDays(t, p.standard_delivery_days)), arrives_date: addDays(t, p.standard_delivery_days) },
  ]
  if (p.expedited_shipping_cents !== null && p.expedited_delivery_days !== null) {
    out.push({ method: 'expedited', cost: usd(p.expedited_shipping_cents), arrives: dayLabel(addDays(t, p.expedited_delivery_days)), arrives_date: addDays(t, p.expedited_delivery_days) })
  }
  return out
}

function productView(p: ProductRow, t: string) {
  return {
    product_id: p.id, name: p.name, brand: p.brand, category: p.category, size_cm: p.size_cm,
    colour: p.colour ?? 'not listed', item_price: usd(p.price_cents), item_price_cents: p.price_cents,
    product_page_text: p.marketing_blurb ?? 'no text on the product page',
    shipping_options: shippingOptions(p, t),
  }
}

function priceAndDelivery(p: ProductRow, method: Shipping, t: string) {
  const expedited = method === 'expedited'
  if (expedited && (p.expedited_shipping_cents === null || p.expedited_delivery_days === null)) return null
  const shipping_cents = expedited ? (p.expedited_shipping_cents as number) : p.standard_shipping_cents
  const days = expedited ? (p.expedited_delivery_days as number) : p.standard_delivery_days
  const delivery_date = addDays(t, days)
  return { shipping_cents, delivery_date, delivery_label: dayLabel(delivery_date), total_cents: p.price_cents + shipping_cents }
}

// ---------- the loop ----------
type Outcome = { result: unknown; done?: AgentReply }

async function runLoop(
  deps: Deps, system: string, history: Msg[], tools: ToolDef[],
  run: (name: string, args: Record<string, unknown>) => Promise<Outcome>,
  extra?: string,
): Promise<AgentReply> {
  const steps: string[] = []
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history.map((m) => ({ role: m.role, content: m.text }) as ChatMessage)]
  if (extra) messages.push({ role: 'user', content: extra })
  for (let i = 0; i < MAX_MODEL_TURNS; i++) {
    const reply = await deps.model.complete(messages, tools)
    if (!reply.tool_calls) {
      return { type: 'message', text: reply.content ?? "Sorry, I didn't catch that. Could you say it another way?", steps }
    }
    messages.push({ role: 'assistant', content: reply.content, tool_calls: reply.tool_calls })
    let finished: AgentReply | null = null
    for (const call of reply.tool_calls) {
      const args = parseArgs(call.function.arguments)
      const w = clean(args.why, 100)
      if (w) steps.push(`Muse is checking: ${w}`)
      const out = await run(call.function.name, args)
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out.result) })
      if (out.done && !finished) finished = out.done
    }
    if (finished) return { ...finished, steps }
  }
  return { type: 'message', text: "I'm taking longer than expected on this. Please try again.", steps }
}

// ---------- stage 1: understand the request ----------
async function intake(deps: Deps, req: AgentRequest): Promise<AgentReply> {
  const t = today(deps)
  return runLoop(deps, intakePrompt(t), req.messages, [CAPTURE_TOOL], async (name, args) => {
    if (name !== 'capture_order_rules') return { result: { error: `Unknown tool ${name}` } }
    const rules = rulesFromModel(args, t)
    if (!hasAnyRule(rules)) return { result: { error: 'The customer has not stated any rules yet. Ask them a short question.' } }
    return {
      result: { ok: true },
      done: { type: 'confirm_rules', text: "Here's what I understood. Please check it. I'll only shop inside these rules.", draft: rules, view: rulesView(rules) },
    }
  })
}

// ---------- stage 2: customer confirmed the rules ----------
async function confirmRules(deps: Deps, req: AgentRequest, rules: Rules): Promise<AgentReply> {
  const { store } = deps
  const sessionId = deps.newId()
  const merchant = await store.merchantId()
  const confirmed = deps.now()
  const confirmed_at = confirmed.toISOString()
  const expires_at = new Date(confirmed.getTime() + 24 * 3600 * 1000).toISOString()
  const private_chat_hash = `sha256:${await sha256Hex(canonicalJson(req.messages))}`

  await store.createSession({
    id: sessionId, merchant_id: merchant, detection_source: 'self_declared_simulated', agent_id: AGENT_ID,
    agent_verified: true, agent_verified_simulated: true, gap_note: null,
  })
  await store.logStep(sessionId, 'verified_agent_detected', { agent_id: AGENT_ID, agent_verified: true, label: 'simulated' }, true)
  await store.logStep(sessionId, 'session_started', { merchant: MERCHANT_NAME }, false)
  await store.logStep(sessionId, 'intent_captured', { fields: rules }, false)
  await store.logStep(sessionId, 'intent_hash_recorded', { private_chat_hash, note: 'Hash only. The chat text is not stored.' }, false)

  const sealed = {
    shopper_ref: 'Demo customer', agent_id: AGENT_ID, agent_verified: true, merchant_id: merchant,
    product_scope: rules.product_scope, size_min_cm: rules.size_min_cm, size_max_cm: rules.size_max_cm,
    colour_preference: rules.colour_preference, currency: 'USD',
    amount_max_cents: rules.budget_max_cents, budget_limit_cents: rules.budget_max_cents,
    payment_method_ref: PAYMENT_LABEL, shipping_method: null, shipping_max_cost_cents: null,
    delivery_by: rules.delivery_by, return_policy_required: rules.return_policy_required, confirmed_at, expires_at,
  }
  const grantId = deps.newId()
  const grant_json = JSON.parse(canonicalJson(sealed))
  await store.addGrant({
    id: grantId, session_id: sessionId, version: 1, supersedes_grant_id: null, ...sealed,
    private_chat_hash, grant_json,
    system_metadata: { data_sharing_limits: 'grant fields only, this purchase only', checked: false, priority: 'P1' },
    schema_label: SCHEMA_LABEL,
  })
  const grant_seal = `sha256:${await sha256Hex(canonicalJson(sealed))}`
  await store.logStep(sessionId, 'grant_captured', { grant_id: grantId, grant_seal, confirmed_at, expires_at, schema_label: SCHEMA_LABEL }, false)

  const reply = await shop(deps, req, grantId, sessionId, rules, 'The customer has confirmed the order rules. Please look at the products and propose options.')
  return { ...reply, session_id: sessionId }
}

// ---------- stage 3: shop, propose, order ----------
async function shop(deps: Deps, req: AgentRequest, grantId: string, sessionId: string, rules: Rules, extra?: string): Promise<AgentReply> {
  const { store } = deps
  const t = today(deps)
  const products = await store.listProducts()
  const byId = new Map(products.map((p) => [p.id, p]))

  if (await store.hasStep(sessionId, 'order_received')) {
    return { type: 'message', text: 'Your order has already been placed.', session_id: sessionId, steps: [] }
  }

  const reply = await runLoop(deps, shopPrompt(t, rules, req.offers), req.messages, SHOP_TOOLS, async (name, args) => {
    if (name === 'search_products') {
      const cat = args.category === 'snowboard' || args.category === 'ski' ? args.category : null
      const maxDollars = toNum(args.max_item_price_dollars)
      const lo = posInt(args.size_min_cm)
      const hi = posInt(args.size_max_cm)
      const list = products.filter((p) =>
        (!cat || p.category === cat) && (maxDollars === null || p.price_cents <= maxDollars * 100) &&
        (lo === null || p.size_cm >= lo) && (hi === null || p.size_cm <= hi))
      return { result: { products: list.map((p) => productView(p, t)) } }
    }
    if (name === 'get_product') {
      const p = typeof args.product_id === 'string' ? byId.get(args.product_id) : undefined
      if (!p) return { result: { error: 'No such product. Use a product_id from search_products.' } }
      await store.addAction(grantId, 'view', { product_id: p.id, product_name: p.name }, null)
      return { result: productView(p, t) }
    }
    if (name === 'propose_products') {
      const raw = Array.isArray(args.offers) ? args.offers.slice(0, 2) : []
      const offers: Offer[] = []
      for (const o of raw as Record<string, unknown>[]) {
        const p = typeof o?.product_id === 'string' ? byId.get(o.product_id) : undefined
        const method: Shipping = o?.shipping_method === 'expedited' ? 'expedited' : 'standard'
        const summary = clean(o?.summary, 80)
        if (!p) return { result: { error: `Unknown product_id ${String(o?.product_id)}` } }
        if (!summary) return { result: { error: 'Each offer needs a short summary.' } }
        const pd = priceAndDelivery(p, method, t)
        if (!pd) return { result: { error: `${p.name} has no expedited shipping.` } }
        offers.push({
          product_id: p.id, name: p.name, brand: p.brand, size_cm: p.size_cm, colour: p.colour, price_cents: p.price_cents,
          summary, delivery_label: pd.delivery_label, delivery_date: pd.delivery_date, shipping_method: method,
          shown_at: deps.now().toISOString(),
        })
      }
      if (offers.length === 0) return { result: { error: 'Offer at least one product.' } }
      const text = clean(args.message, 300) ?? 'Here are my picks.'
      return { result: { ok: true, shown: offers.length }, done: { type: 'proposals', text, offers } }
    }
    if (name === 'place_order') {
      const pid = typeof args.product_id === 'string' ? args.product_id : ''
      const offer = req.offers.find((o) => o.product_id === pid)
      const p = byId.get(pid)
      if (!offer || !p) return { result: { error: 'The customer has not been shown that option yet. Propose it first.' } }
      const pd = priceAndDelivery(p, offer.shipping_method, t)
      if (!pd) return { result: { error: 'That shipping method is not available.' } }
      const confirmed_at = deps.now().toISOString()
      const proposalId = deps.newId()
      await store.addProposal({
        id: proposalId, grant_id: grantId, product_id: p.id, shown_item_price_cents: p.price_cents, shown_total_cents: null,
        shown_returns_summary: offer.summary, shown_delivery: offer.delivery_label, shown_at: offer.shown_at,
        confirmation_ref: `PC-${proposalId.slice(0, 8).toUpperCase()}`, confirmed_at,
      })
      const detail = {
        product_id: p.id, product_name: p.name, brand: p.brand, size_cm: p.size_cm, colour: p.colour,
        item_price_cents: p.price_cents, shipping_method: offer.shipping_method, shipping_cents: pd.shipping_cents,
        total_cents: pd.total_cents, delivery_date: pd.delivery_date, payment_method: PAYMENT_LABEL,
        agent_summary: { returns: offer.summary },
      }
      const seq = await store.addAction(grantId, 'checkout', detail, { returns: offer.summary })
      await store.logStep(sessionId, 'order_received', { product_id: p.id, total_cents: pd.total_cents, action_seq: seq }, false)
      const order: OrderView = {
        product_name: p.name, brand: p.brand, size_cm: p.size_cm, colour: p.colour, item_price_cents: p.price_cents,
        shipping_label: offer.shipping_method === 'expedited' ? 'Expedited shipping' : 'Standard shipping',
        shipping_cents: pd.shipping_cents, total_cents: pd.total_cents, delivery_label: pd.delivery_label, payment_label: PAYMENT_LABEL,
      }
      return { result: { ok: true, placed: true }, done: { type: 'ordered', text: 'Your order is placed.', order } }
    }
    return { result: { error: `Unknown tool ${name}` } }
  }, extra)
  return { ...reply, session_id: sessionId }
}

// ---------- entry point ----------
export async function handle(raw: unknown, deps: Deps): Promise<AgentReply> {
  const req = parseRequest(raw)
  if (typeof req === 'string') return { type: 'error', message: req }
  if (req.confirm) {
    if (!req.draft) return { type: 'error', message: 'There are no order rules to confirm yet.' }
    return confirmRules(deps, req, req.draft)
  }
  if (req.session_id) {
    const g = await deps.store.getGrant(req.session_id)
    if (!g) return { type: 'error', message: 'That session was not found. Please start a new chat.' }
    return shop(deps, req, g.grantId, req.session_id, g.rules)
  }
  return intake(deps, req)
}
