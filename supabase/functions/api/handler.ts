// Public AgentReceipt API for third-party agents. Pure TypeScript: the database, the auditor call, the clock and the
// key generator are injected, so tests run it end to end with the real auditor (supabase/functions/auditor/run.ts).
//
// This file holds NO verdict logic. It validates input, writes the same chained records the shopper writes
// (session, grant, proposal, checkout action), then asks the existing auditor function for the verdict. The auditor
// decides Pass / Review Required / Hold for Suspicion and writes the receipt. Hashes are computed here with the shared
// hash spec (hash.ts, a byte-identical copy of _shared/hash.ts); a model never takes part.
//
// Auth (hackathon only): demo-issued per-agent keys, stored as SHA-256 only, checked on every POST.
import { appendChained, type ChainDb } from './chain.ts'
import { canonicalJson, computeEntryHash, GENESIS_HASH, sha256Hex } from './hash.ts'

type Row = Record<string, unknown>

export const MERCHANT_NAME = 'Northwind Outfitters'
export const PAYMENT_REF = 'Demo Checkout'
export const SCHEMA_LABEL = 'VI-aligned demo representation'
export const KEY_NOTE = 'Demo-issued key for hackathon, not a production credential.'
export const DASHBOARD_PATH = '/dashboard/orders'
// Limits reused from the shopper / auditor: request size, text length (MAX_TEXT), agent summary length (80, as the shopper's offer summary).
export const MAX_BODY = 4_000
export const MAX_TEXT = 1000
export const MAX_SUMMARY = 80

// Display names only. The decision itself comes from the auditor.
const DECISION_LABEL: Record<string, string> = { pass: 'Pass', review_required: 'Review Required', hold_suspicion: 'Hold for Suspicion' }

export type Step = 'verified_agent_detected' | 'session_started' | 'grant_captured' | 'order_received'

export interface ApiDb extends ChainDb {
  insertAgent(row: { id: string; agent_name: string; key_hash: string }): Promise<void>
  agentByKeyHash(keyHash: string): Promise<{ id: string; agent_name: string } | null>
  merchantId(name: string): Promise<string | null>
  createSession(row: Row): Promise<void>
  session(id: string): Promise<{ id: string; agent_id: string | null; merchant_id: string } | null>
  logStep(sessionId: string, step: Step, detail: Row, simulated: boolean): Promise<void>
  grantForSession(sessionId: string): Promise<Row | null>
  checkoutForGrant(grantId: string): Promise<Row | null>
  catalog(merchantId: string): Promise<{ id: string; name: string; brand: string | null; size_cm: number; standard_shipping_cents: number; expedited_shipping_cents: number | null }[]>
  receiptBy(field: 'order_ref' | 'receipt_ref' | 'grant_id', value: string): Promise<Row | null>
  record(table: 'grants' | 'proposals', id: string): Promise<Row | null>
  prevEntryHash(chainSeq: number): Promise<string | null> // entry_hash of the newest chain entry before this one
}

// What the existing auditor function answers (POST /functions/v1/auditor { session_id }).
export type AuditorAnswer = {
  type: 'audit' | 'error'
  receipt_ref?: string | null
  order_ref?: string | null
  audit?: { decision: string; problems: number; missing_components: string[]; suspicion_reasons?: string[]; checks: Row[] }
  message?: string
}

export type ApiDeps = { db: ApiDb; auditor: (sessionId: string) => Promise<AuditorAnswer>; now: () => Date; newId: () => string; newKey: () => string }
export type ApiRequest = { method: string; path: string[]; header: (name: string) => string | null; body: string }
export type ApiResponse = { status: number; body: unknown }

const ok = (body: unknown, status = 200): ApiResponse => ({ status, body })
const fail = (status: number, error: string, extra: Row = {}): ApiResponse => ({ status, body: { error, ...extra } })

class Bad extends Error {}
const isObj = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v)
const UUID = /^[0-9a-f-]{36}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EXACT_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function text(b: Row, k: string, max = MAX_TEXT): string | null {
  const v = b[k]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') throw new Bad(`${k} must be a string or null.`)
  const s = v.trim()
  if (s.toLowerCase() === 'null') throw new Bad(`${k}: send JSON null, not the string "null".`)
  if (s.length > max) throw new Bad(`${k} is longer than ${max} characters.`)
  return s || null
}
function dollars(b: Row, k: string): number | null {
  const v = b[k]
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1_000_000) throw new Bad(`${k} must be a number of US dollars (e.g. 449.95) or null.`)
  return Math.round(v * 100)
}
function date(b: Row, k: string): string | null {
  const v = text(b, k)
  if (v === null) return null
  if (!DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Bad(`${k} must be a date YYYY-MM-DD or null.`)
  return v
}
function bool(b: Row, k: string): boolean | null {
  const v = b[k]
  if (v === undefined || v === null) return null
  if (typeof v !== 'boolean') throw new Bad(`${k} must be true, false or null.`)
  return v
}
function sizeCm(v: unknown, k: string): number | null {
  if (v === undefined || v === null) return null
  const n = typeof v === 'string' ? Number(v.replace(/\s*cm$/i, '')) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0 || n > 400) throw new Bad(`${k} must be a whole number of cm or null.`)
  return n
}
// "150-165 cm", "150-165", { "min": 150, "max": 165 } or null.
function sizeRange(v: unknown): { min: number | null; max: number | null } {
  if (v === undefined || v === null) return { min: null, max: null }
  if (typeof v === 'string') {
    if (v.trim().toLowerCase() === 'null') throw new Bad('size_range: send JSON null, not the string "null".')
    const m = /^\s*(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:cm)?\s*$/i.exec(v)
    if (!m) throw new Bad('size_range must look like "150-165 cm", {"min":150,"max":165}, or null.')
    return check({ min: Number(m[1]), max: Number(m[2]) })
  }
  if (isObj(v)) return check({ min: sizeCm(v.min, 'size_range.min'), max: sizeCm(v.max, 'size_range.max') })
  throw new Bad('size_range must look like "150-165 cm", {"min":150,"max":165}, or null.')
  function check(r: { min: number | null; max: number | null }) {
    if (r.min !== null && r.max !== null && r.min > r.max) throw new Bad('size_range: min is larger than max.')
    if ((r.min !== null && r.min <= 0) || (r.max !== null && r.max <= 0)) throw new Bad('size_range values must be positive.')
    return r
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const keyHash = async (key: string) => `sha256:${await sha256Hex(key)}`

async function authed(req: ApiRequest, db: ApiDb) {
  const key = req.header('x-agent-key')?.trim()
  if (!key) return null
  return db.agentByKeyHash(await keyHash(key))
}

async function ownSession(b: Row, agentId: string, db: ApiDb) {
  const id = b.session_id
  if (typeof id !== 'string' || !UUID.test(id)) throw new Bad('session_id is required.')
  const s = await db.session(id)
  return s && s.agent_id === agentId ? s : null
}

// ---------- hash verification for one order's records (display only; the auditor ran its own at order time) ----------
async function verifyRow(type: string, row: Row | null, db: ApiDb) {
  if (!row) return { type, id: null, present: false, chain_seq: null, prev_hash: null, entry_hash: null, recomputed_hash: null, content_ok: null, link_ok: null }
  const seq = row.chain_seq as number
  const recomputed = await computeEntryHash(row.prev_hash as string, row)
  const before = (await db.prevEntryHash(seq)) ?? GENESIS_HASH
  return {
    type, id: row.id, present: true, chain_seq: seq, prev_hash: row.prev_hash, entry_hash: row.entry_hash, recomputed_hash: recomputed,
    content_ok: recomputed === row.entry_hash, link_ok: before === row.prev_hash,
  }
}

async function receiptView(receipt: Row, db: ApiDb) {
  const grant = await db.record('grants', receipt.grant_id as string)
  const proposal = typeof receipt.proposal_id === 'string' ? await db.record('proposals', receipt.proposal_id) : null
  const action = grant ? await db.checkoutForGrant(grant.id as string) : null
  const chain = [
    await verifyRow('grant', grant, db), await verifyRow('proposal', proposal, db),
    await verifyRow('action', action, db), await verifyRow('receipt', receipt, db),
  ]
  const present = chain.filter((c) => c.present)
  const verified = present.length > 0 && present.every((c) => c.content_ok === true && c.link_ok === true)
  const audit = (receipt.audit as AuditorAnswer['audit'] | null) ?? null
  const checks = (audit?.checks ?? (receipt.mismatch_results as Row[] | null) ?? []).map((c) => ({
    field: c.field, grant: c.grant, merchant_terms: c.merchant_terms, actual: c.actual, match: c.result, cause: c.cause,
  }))
  const decision = (receipt.decision as string | null) ?? audit?.decision ?? null
  return {
    order_id: receipt.order_ref ?? null,
    receipt_id: receipt.receipt_ref,
    decision: decision ? DECISION_LABEL[decision] ?? decision : null,
    decision_code: decision,
    problems_count: receipt.problems_found,
    problems: checks.filter((c) => c.match === 'mismatch'),
    checks,
    missing_components: receipt.missing_components ?? [],
    suspicion_reasons: audit?.suspicion_reasons ?? [],
    receipt_hash: receipt.entry_hash,
    sealed_at: receipt.sealed_at ?? null,
    hash_chain: chain,
    hash_verification: {
      verified,
      method: 'entry_hash = SHA-256(prev_hash + "\\n" + canonical JSON of the stored row without prev_hash, entry_hash, chain_seq, created_at); link = prev_hash equals the previous chain entry',
    },
    dashboard_path: DASHBOARD_PATH,
  }
}

// ---------- routes ----------
async function register(b: Row, deps: ApiDeps): Promise<ApiResponse> {
  const name = text(b, 'agent_name', 80)
  if (!name) throw new Bad('agent_name is required.')
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'agent'
  const agent_id = `ext-${slug}-${deps.newId().replace(/-/g, '').slice(0, 8)}`
  const api_key = deps.newKey()
  await deps.db.insertAgent({ id: agent_id, agent_name: name, key_hash: await keyHash(api_key) })
  return ok({ agent_id, agent_name: name, api_key, note: KEY_NOTE }, 201)
}

async function openSession(b: Row, agent: { id: string; agent_name: string }, deps: ApiDeps): Promise<ApiResponse> {
  const merchant = text(b, 'merchant')
  if (merchant !== MERCHANT_NAME) throw new Bad(`merchant must be "${MERCHANT_NAME}" in the demo.`)
  const merchantId = await deps.db.merchantId(MERCHANT_NAME)
  if (!merchantId) return fail(500, 'Demo merchant is missing.')
  const session_id = deps.newId()
  await deps.db.createSession({
    id: session_id, merchant_id: merchantId, detection_source: 'self_declared_simulated', agent_id: agent.id,
    agent_verified: true, agent_verified_simulated: true, gap_note: null,
  })
  await deps.db.logStep(session_id, 'verified_agent_detected', { agent_id: agent.id, agent_name: agent.agent_name, agent_verified: true, label: 'simulated (demo API key)' }, true)
  await deps.db.logStep(session_id, 'session_started', { merchant: MERCHANT_NAME, source: 'public-api' }, false)
  return ok({ session_id, merchant: MERCHANT_NAME, agent_id: agent.id }, 201)
}

async function addGrant(b: Row, agent: { id: string }, deps: ApiDeps): Promise<ApiResponse> {
  const { db } = deps
  const s = await ownSession(b, agent.id, db)
  if (!s) return fail(404, 'Session not found for this agent.')
  if (await db.grantForSession(s.id)) return fail(409, 'This session already has a grant. One grant per session.')

  const merchant = text(b, 'merchant')
  // The receipt must name a known merchant, so the grant's merchant is the demo merchant only.
  if (merchant !== MERCHANT_NAME) throw new Bad(`merchant must be "${MERCHANT_NAME}" in the demo.`)
  const merchantId = s.merchant_id
  const budget = dollars(b, 'budget_total_max')
  if (budget === 0) throw new Bad('budget_total_max must be more than 0, or null.')
  const size = sizeRange(b.size_range)
  const expiry = text(b, 'expiry')
  if (!expiry || !EXACT_TS.test(expiry) || Number.isNaN(Date.parse(expiry))) throw new Bad('expiry is required: an exact timestamp, e.g. 2026-10-29T19:00:00Z.')
  const confirmed = deps.now()
  if (Date.parse(expiry) <= confirmed.getTime()) throw new Bad('expiry must be in the future.')
  const confirmed_at = confirmed.toISOString()
  const expires_at = new Date(expiry).toISOString()

  // The canonical grant fields, in the same shape the shopper seals (plus the merchant name the agent named).
  const sealed = {
    shopper_ref: 'External agent customer', agent_id: agent.id, agent_verified: true, merchant, merchant_id: merchantId,
    product_scope: text(b, 'product_scope'), size_min_cm: size.min, size_max_cm: size.max,
    colour_preference: text(b, 'colour'), currency: 'USD', amount_max_cents: budget, budget_limit_cents: budget,
    payment_method_ref: text(b, 'payment_method_ref'), shipping_method: null, shipping_max_cost_cents: null,
    delivery_by: date(b, 'delivery_by'), return_policy_required: bool(b, 'return_policy_required'), confirmed_at, expires_at,
  }
  const { merchant: _merchant, ...columns } = sealed
  const grant_id = deps.newId()
  // No chat is ever sent through this API: private_chat_hash is the SHA-256 of an empty string.
  const private_chat_hash = `sha256:${await sha256Hex('')}`
  const stored = await appendChained(db, 'grants', {
    id: grant_id, session_id: s.id, version: 1, supersedes_grant_id: null, ...columns,
    private_chat_hash, grant_json: JSON.parse(canonicalJson(sealed)),
    system_metadata: { data_sharing_limits: 'grant fields only, this purchase only', checked: false, priority: 'P1', source: 'public-api' },
    schema_label: SCHEMA_LABEL,
  })
  const grant_hash = `sha256:${await sha256Hex(canonicalJson(sealed))}`
  await db.logStep(s.id, 'grant_captured', { grant_id, grant_seal: grant_hash, confirmed_at, expires_at, schema_label: SCHEMA_LABEL }, false)
  return ok({
    grant_id, grant_hash, grant_entry_hash: stored.entry_hash, canonical_grant_fields: JSON.parse(canonicalJson(sealed)),
    hash_note: 'grant_hash = SHA-256 of canonical JSON (sorted keys) of canonical_grant_fields. grant_entry_hash is its hash-chain entry.',
  }, 201)
}

async function addAction(b: Row, agent: { id: string }, deps: ApiDeps): Promise<ApiResponse> {
  const { db } = deps
  const s = await ownSession(b, agent.id, db)
  if (!s) return fail(404, 'Session not found for this agent.')
  const grant = await db.grantForSession(s.id)
  if (!grant) {
    // Nothing to hang an order on. Ask the auditor anyway: a missing grant is Hold for Suspicion, never a field pass/fail.
    const a = await deps.auditor(s.id)
    return fail(409, 'No grant registered for this session. Register a grant first (POST /api/grants).', {
      decision: a.audit ? DECISION_LABEL[a.audit.decision] ?? a.audit.decision : 'Hold for Suspicion',
      missing_components: a.audit?.missing_components ?? ['grant record'],
    })
  }
  const existing = await db.checkoutForGrant(grant.id as string)
  if (existing) {
    const r = await db.receiptBy('grant_id', grant.id as string)
    return fail(409, 'This session already has an order. One order per session.', { action_id: existing.id, order_id: r?.order_ref ?? null, receipt_id: r?.receipt_ref ?? null })
  }

  const product_name = text(b, 'product_name')
  const size_cm = sizeCm(b.size, 'size')
  const item = dollars(b, 'item_price')
  const shipping = dollars(b, 'shipping_price')
  const total = dollars(b, 'total_price')
  if (item !== null && shipping !== null && total !== null && item + shipping !== total) {
    throw new Bad(`total_price must equal item_price + shipping_price (${((item + shipping) / 100).toFixed(2)}).`)
  }
  const returns = text(b, 'agent_summary_returns', MAX_SUMMARY)
  const delivery = text(b, 'agent_summary_delivery', MAX_SUMMARY)
  const believedRaw = b.agent_believed_terms
  let believed: Row | null = null
  if (typeof believedRaw === 'string') believed = { returns: text(b, 'agent_believed_terms', MAX_SUMMARY) }
  else if (isObj(believedRaw)) believed = { returns: text(believedRaw, 'returns', MAX_SUMMARY), delivery: text(believedRaw, 'delivery', MAX_SUMMARY) }
  else if (believedRaw !== undefined && believedRaw !== null) throw new Bad('agent_believed_terms must be an object like {"returns": "..."}, a string, or null.')
  const payment = text(b, 'payment_method') ?? PAYMENT_REF
  const product_scope = text(b, 'product_scope')
  const colour = text(b, 'colour')
  const delivery_date = date(b, 'delivery_date')
  const formal_terms = text(b, 'formal_terms')

  // Every field is validated above, before anything is written (a failed insert would leave a gap in the chain).
  // The merchant's own catalog is the source of the product's category and formal terms. No match = no product
  // on the order, so the auditor finds the formal terms missing (Hold for Suspicion).
  const catalog = await db.catalog(s.merchant_id)
  const p = product_name
    ? catalog.find((c) => (norm(c.name) === norm(product_name) || norm(`${c.brand ?? ''} ${c.name}`) === norm(product_name)) && (size_cm === null || c.size_cm === size_cm)) ?? null
    : null
  const shipping_method = p && shipping !== null
    ? shipping === p.expedited_shipping_cents ? 'expedited' : shipping === p.standard_shipping_cents ? 'standard' : null
    : null

  const now = deps.now().toISOString()
  let proposal_id: string | null = null
  // The structured proposal record: what the agent told the customer. Without both summary fields it is not written,
  // and the auditor reports the proposal record missing (Hold for Suspicion).
  if (returns && delivery && item !== null) {
    proposal_id = deps.newId()
    await appendChained(db, 'proposals', {
      id: proposal_id, grant_id: grant.id, product_id: p?.id ?? null, shown_item_price_cents: item, shown_total_cents: null,
      shown_returns_summary: returns, shown_delivery: delivery, shown_at: now,
      confirmation_ref: `PC-${proposal_id.slice(0, 8).toUpperCase()}`, confirmed_at: now,
    })
  }
  const action_id = deps.newId()
  const detail = {
    product_id: p?.id ?? null, product_name, brand: p?.brand ?? null, product_scope, size_cm, colour,
    item_price_cents: item, shipping_method, shipping_cents: shipping, total_cents: total, delivery_date,
    sealed_at: now, payment_method: payment, payment_method_detail: `${payment} (public API)`, payment_simulated: true,
    agent_summary: { returns, delivery }, agent_reported_formal_terms: formal_terms, source: 'public-api',
  }
  await appendChained(db, 'actions', { id: action_id, grant_id: grant.id, seq: 1, type: 'checkout', detail, agent_believed_terms: believed, image_evidence_ref: null })
  await db.logStep(s.id, 'order_received', { product_id: p?.id ?? null, total_cents: total, action_seq: 1, source: 'public-api' }, false)

  // The existing auditor decides and writes the hash-chained receipt.
  let a: AuditorAnswer
  try { a = await deps.auditor(s.id) } catch { a = { type: 'error', message: 'auditor unreachable' } }
  if (a.type !== 'audit' || !a.audit) {
    return fail(502, 'Order recorded, but the auditor did not answer. The dashboard lists it as Hold for Suspicion (no receipt) until it does.', { action_id, order_id: null, receipt_id: null })
  }
  return ok({
    action_id, proposal_id, order_id: a.order_ref ?? null, receipt_id: a.receipt_ref ?? null,
    decision: DECISION_LABEL[a.audit.decision] ?? a.audit.decision,
    catalog_product_id: p?.id ?? null,
    verdict_path: a.order_ref ? `/api/verdicts/${a.order_ref}` : null,
  }, 201)
}

export async function handleApi(req: ApiRequest, deps: ApiDeps): Promise<ApiResponse> {
  const [a, b, extra] = req.path
  try {
    if (req.method === 'GET') {
      if (!a) return ok({ name: 'AgentReceipt public agent API (hackathon demo)', docs: 'docs/API.md', endpoints: ['POST /api/agents/register', 'POST /api/sessions', 'POST /api/grants', 'POST /api/actions', 'GET /api/verdicts/{order_id}', 'GET /api/receipts/{receipt_id}'] })
      if (a === 'verdicts' && b && !extra) {
        if (!/^\d{1,10}$/.test(b)) return fail(400, 'order_id must be a number, e.g. 15002.')
        const r = await deps.db.receiptBy('order_ref', b)
        return r ? ok(await receiptView(r, deps.db)) : fail(404, `No receipt for order ${b}.`)
      }
      if (a === 'receipts' && b && !extra) {
        if (!/^AR-\d{4}-\d{1,6}$/.test(b)) return fail(400, 'receipt_id looks like AR-2026-0045.')
        const r = await deps.db.receiptBy('receipt_ref', b)
        if (!r) return fail(404, `No receipt ${b}.`)
        const { audit: _audit, ...record } = r
        return ok({ ...(await receiptView(r, deps.db)), receipt_record: record })
      }
      return fail(404, 'Unknown endpoint.')
    }
    if (req.method !== 'POST') return fail(405, 'Use GET or POST.')
    if (req.body.length > MAX_BODY) return fail(413, `Request too large (max ${MAX_BODY} bytes).`)
    let body: unknown
    try { body = JSON.parse(req.body || '{}') } catch { return fail(400, 'Body must be JSON.') }
    if (!isObj(body)) return fail(400, 'Body must be a JSON object.')

    if (a === 'agents' && b === 'register' && !extra) return await register(body, deps)
    const route = !b ? a : null
    if (route !== 'sessions' && route !== 'grants' && route !== 'actions') return fail(404, 'Unknown endpoint.')
    const agent = await authed(req, deps.db)
    if (!req.header('x-agent-key')) return fail(401, 'Missing X-Agent-Key header. Get a demo key from POST /api/agents/register.')
    if (!agent) return fail(401, 'Invalid X-Agent-Key.')
    if (route === 'sessions') return await openSession(body, agent, deps)
    if (route === 'grants') return await addGrant(body, agent, deps)
    return await addAction(body, agent, deps)
  } catch (e) {
    if (e instanceof Bad) return fail(400, e.message)
    throw e
  }
}
