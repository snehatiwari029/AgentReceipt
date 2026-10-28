import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleApi, type ApiDb, type ApiDeps, type ApiResponse } from '../../supabase/functions/api/handler'
import { runAuditor, type AuditorDb } from '../../supabase/functions/auditor/run'
import { createSparkReader } from '../../supabase/functions/auditor/spark'
import { computeEntryHash, canonicalJson, sha256Hex } from '../../supabase/functions/_shared/hash'

const MERCHANT = '32b14be6-26e6-49df-a7af-79532f910510'
const BURTON = '40c70768-77ac-4953-8bae-c75c8319fcf4'
const CATALOG = [
  { id: BURTON, name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', category: 'snowboard', size_cm: 156, colour: 'Blue/Black', price_cents: 44995, formal_returns: 'final_sale', formal_terms_text: 'Final Sale', standard_shipping_cents: 0, expedited_shipping_cents: 6000 },
]
const NOW = new Date('2026-10-28T20:00:00.000Z')

// One in-memory "database" shared by the API and the REAL auditor (run.ts), like the deployed functions share Postgres.
function world() {
  const t: Record<string, Record<string, unknown>[]> = { api_agents: [], sessions: [], session_events: [], grants: [], proposals: [], actions: [], receipts: [] }
  let seq = 20 // the seeded chain already holds 20 entries
  let ids = 0
  const chain = () => ['grants', 'proposals', 'actions', 'receipts'].flatMap((k) => t[k]).sort((a, b) => (a.chain_seq as number) - (b.chain_seq as number))
  const base = {
    latestHash: async () => (chain().at(-1)?.entry_hash as string | undefined) ?? `sha256:${'a'.repeat(64)}`,
    insert: async (table: string, row: Record<string, unknown>) => { seq += 1; t[table].push({ ...row, chain_seq: seq, created_at: NOW.toISOString() }) },
  }
  const checkout = async (id: string) => t.actions.find((a) => a.grant_id === id && a.type === 'checkout') ?? null
  const db: ApiDb = {
    ...base,
    insertAgent: async (row) => void t.api_agents.push(row),
    agentByKeyHash: async (h) => (t.api_agents.find((a) => a.key_hash === h) as { id: string; agent_name: string } | undefined) ?? null,
    merchantId: async (name) => (name === 'Northwind Outfitters' ? MERCHANT : null),
    createSession: async (row) => void t.sessions.push(row),
    session: async (id) => (t.sessions.find((s) => s.id === id) as { id: string; agent_id: string; merchant_id: string } | undefined) ?? null,
    logStep: async (session_id, step, detail) => void t.session_events.push({ session_id, step, detail }),
    grantForSession: async (id) => t.grants.find((g) => g.session_id === id) ?? null,
    checkoutForGrant: checkout,
    catalog: async () => CATALOG,
    receiptBy: async (field, value) => t.receipts.find((r) => r[field] === value) ?? null,
    record: async (table, id) => t[table].find((r) => r.id === id) ?? null,
    prevEntryHash: async (s) => (chain().filter((r) => (r.chain_seq as number) < s).at(-1)?.entry_hash as string | undefined) ?? `sha256:${'a'.repeat(64)}`,
  }
  const auditorDb: AuditorDb = {
    ...base,
    sessionExists: async (id) => t.sessions.some((s) => s.id === id),
    grantForSession: db.grantForSession,
    proposalForGrant: async (id) => t.proposals.find((p) => p.grant_id === id) ?? null,
    checkoutForGrant: checkout,
    product: async (id) => {
      const p = CATALOG.find((c) => c.id === id)
      return p ? { category: p.category, formal_returns: p.formal_returns, formal_terms_text: p.formal_terms_text, merchant_name: 'Northwind Outfitters', row: { ...p } } : null
    },
    merchantName: async (id) => (id === MERCHANT ? 'Northwind Outfitters' : null),
    entryHashAt: async (s) => (chain().find((r) => r.chain_seq === s)?.entry_hash as string | undefined) ?? (s === 20 ? `sha256:${'a'.repeat(64)}` : null),
    receiptForGrant: async (id) => t.receipts.find((r) => r.grant_id === id) ?? null,
    refs: async () => [{ receipt_ref: 'AR-2026-0044', order_ref: '15001' }, ...t.receipts.map((r) => ({ receipt_ref: r.receipt_ref as string, order_ref: r.order_ref as string | null }))],
    logStep: async (session_id, step, detail) => void t.session_events.push({ session_id, step, detail }),
  }
  const deps: ApiDeps = {
    db, now: () => NOW, newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`, newKey: () => `ark_demo_test${ids}`,
    auditor: (sessionId) => runAuditor({ session_id: sessionId }, { db: auditorDb, reader: createSparkReader(null), now: () => NOW, newId: () => `00000000-0000-4000-9000-${String(++ids).padStart(12, '0')}`, today: () => '2026-10-28' }),
  }
  const call = (method: string, path: string, body?: unknown, key?: string): Promise<ApiResponse> =>
    handleApi({ method, path: path.split('/').filter(Boolean).slice(1), header: (n) => (n === 'x-agent-key' ? key ?? null : null), body: body === undefined ? '' : JSON.stringify(body) }, deps)
  return { t, call }
}

const GRANT = {
  merchant: 'Northwind Outfitters', budget_total_max: 500, product_scope: 'snowboard', size_range: '150-165 cm', colour: null,
  delivery_by: '2026-10-28', return_policy_required: true, payment_method_ref: 'Demo Checkout', expiry: '2026-10-29T20:00:00Z',
}
const ACTION = {
  product_name: 'Burton Spellbinder Snowboard 2026/2027', product_scope: 'snowboard', size: 156, colour: null,
  item_price: 449.95, shipping_price: 60, total_price: 509.95, delivery_date: '2026-10-28', formal_terms: 'Final Sale',
  agent_summary_returns: 'Easy returns', agent_summary_delivery: 'Wed Oct 28', agent_believed_terms: { returns: 'Easy returns' }, payment_method: 'Demo Checkout',
}

async function flow(w: ReturnType<typeof world>) {
  const reg = (await w.call('POST', '/api/agents/register', { agent_name: 'Judge Agent' })).body as Record<string, string>
  const key = reg.api_key
  const s = (await w.call('POST', '/api/sessions', { merchant: 'Northwind Outfitters' }, key)).body as Record<string, string>
  const g = await w.call('POST', '/api/grants', { session_id: s.session_id, ...GRANT }, key)
  const a = await w.call('POST', '/api/actions', { session_id: s.session_id, ...ACTION }, key)
  return { reg, key, session_id: s.session_id, g, a }
}

describe('Public agent API', () => {
  it('external flow: register, session, grant, action, verdict = Review Required with Budget + Returns, from the real auditor', async () => {
    const w = world()
    const { reg, g, a } = await flow(w)
    expect(reg.note).toBe('Demo-issued key for hackathon, not a production credential.')
    expect(w.t.api_agents[0].key_hash).toBe(`sha256:${await sha256Hex(reg.api_key)}`)
    expect(JSON.stringify(w.t.api_agents)).not.toContain(reg.api_key)

    expect(g.status).toBe(201)
    const gb = g.body as Record<string, unknown>
    expect(gb.grant_hash).toBe(`sha256:${await sha256Hex(canonicalJson(gb.canonical_grant_fields))}`)
    expect((gb.canonical_grant_fields as Record<string, unknown>).colour_preference).toBeNull()

    expect(a.status).toBe(201)
    const ab = a.body as Record<string, string>
    expect(ab.order_id).toBe('15002')
    expect(ab.receipt_id).toBe('AR-2026-0045')
    expect(ab.decision).toBe('Review Required')

    const v = await w.call('GET', `/api/verdicts/${ab.order_id}`)
    const vb = v.body as { decision: string; problems: { field: string; match: string; cause: string }[]; receipt_hash: string; hash_verification: { verified: boolean }; hash_chain: { content_ok: boolean; link_ok: boolean }[] }
    expect(vb.decision).toBe('Review Required')
    expect(vb.problems.map((p) => p.field)).toEqual(['Budget', 'Returns'])
    expect(vb.problems.every((p) => p.match === 'mismatch')).toBe(true)
    expect(vb.hash_verification.verified).toBe(true)
    expect(vb.hash_chain).toHaveLength(4)

    // The receipt hash recomputes from its own canonical fields.
    const r = w.t.receipts[0]
    expect(await computeEntryHash(r.prev_hash as string, r)).toBe(vb.receipt_hash)
    const rc = (await w.call('GET', `/api/receipts/${ab.receipt_id}`)).body as { receipt_hash: string; receipt_record: Record<string, unknown> }
    expect(rc.receipt_hash).toBe(vb.receipt_hash)
    expect(rc.receipt_record.order_ref).toBe('15002')
  })

  it('rejects missing and invalid API keys on every POST', async () => {
    const w = world()
    expect((await w.call('POST', '/api/sessions', { merchant: 'Northwind Outfitters' })).status).toBe(401)
    expect((await w.call('POST', '/api/sessions', { merchant: 'Northwind Outfitters' }, 'ark_demo_wrong')).status).toBe(401)
    expect((await w.call('POST', '/api/grants', GRANT, 'ark_demo_wrong')).status).toBe(401)
    expect((await w.call('POST', '/api/actions', ACTION)).status).toBe(401)
  })

  it('rejects the string "null", a non-demo merchant and a total that is not item + shipping', async () => {
    const w = world()
    const key = ((await w.call('POST', '/api/agents/register', { agent_name: 'x' })).body as Record<string, string>).api_key
    const session_id = ((await w.call('POST', '/api/sessions', { merchant: 'Northwind Outfitters' }, key)).body as Record<string, string>).session_id
    expect((await w.call('POST', '/api/sessions', { merchant: 'Other Store' }, key)).status).toBe(400)
    const bad = await w.call('POST', '/api/grants', { session_id, ...GRANT, colour: 'null' }, key)
    expect(bad.status).toBe(400)
    expect(w.t.grants).toHaveLength(0)
    expect((await w.call('POST', '/api/grants', { session_id, ...GRANT }, key)).status).toBe(201)
    const t = await w.call('POST', '/api/actions', { session_id, ...ACTION, total_price: 449.95 }, key)
    expect(t.status).toBe(400)
    expect(w.t.actions).toHaveLength(0)
    expect(w.t.proposals).toHaveLength(0)
  })

  it('an action with no grant is Hold for Suspicion from the auditor, and writes nothing', async () => {
    const w = world()
    const k = ((await w.call('POST', '/api/agents/register', { agent_name: 'x' })).body as Record<string, string>).api_key
    const s = ((await w.call('POST', '/api/sessions', { merchant: 'Northwind Outfitters' }, k)).body as Record<string, string>).session_id
    const a = await w.call('POST', '/api/actions', { session_id: s, ...ACTION }, k)
    expect(a.status).toBe(409)
    expect((a.body as Record<string, unknown>).decision).toBe('Hold for Suspicion')
    expect(w.t.actions).toHaveLength(0)
    expect(w.t.receipts).toHaveLength(0)
  })

  it('missing agent summary fields = missing proposal record = Hold for Suspicion, not a field pass/fail', async () => {
    const w = world()
    const k = ((await w.call('POST', '/api/agents/register', { agent_name: 'x' })).body as Record<string, string>).api_key
    const s = ((await w.call('POST', '/api/sessions', { merchant: 'Northwind Outfitters' }, k)).body as Record<string, string>).session_id
    await w.call('POST', '/api/grants', { session_id: s, ...GRANT }, k)
    const a = await w.call('POST', '/api/actions', { session_id: s, ...ACTION, agent_summary_returns: null, agent_summary_delivery: null }, k)
    expect((a.body as Record<string, unknown>).decision).toBe('Hold for Suspicion')
    const v = (await w.call('GET', `/api/verdicts/${(a.body as Record<string, string>).order_id}`)).body as { missing_components: string[] }
    expect(v.missing_components).toContain('proposal record')
  })

  it('another agent cannot use a session it did not open; one grant and one order per session', async () => {
    const w = world()
    const { session_id, key } = await flow(w)
    const other = ((await w.call('POST', '/api/agents/register', { agent_name: 'other' })).body as Record<string, string>).api_key
    expect((await w.call('POST', '/api/grants', { session_id, ...GRANT }, other)).status).toBe(404)
    expect((await w.call('POST', '/api/grants', { session_id, ...GRANT }, key)).status).toBe(409)
    expect((await w.call('POST', '/api/actions', { session_id, ...ACTION }, key)).status).toBe(409)
    expect(w.t.receipts).toHaveLength(1)
  })
})

describe('Public API separation', () => {
  const API = join(__dirname, '..', '..', 'supabase', 'functions', 'api')
  const FN = join(__dirname, '..', '..', 'supabase', 'functions')
  it('keeps byte-identical copies of the hash spec and chain append, and holds no verdict engine of its own', () => {
    expect(readFileSync(join(API, 'hash.ts'), 'utf8')).toBe(readFileSync(join(FN, '_shared', 'hash.ts'), 'utf8'))
    expect(readFileSync(join(API, 'chain.ts'), 'utf8')).toBe(readFileSync(join(FN, 'shopper-agent', 'chain.ts'), 'utf8'))
    for (const f of readdirSync(API)) {
      const text = readFileSync(join(API, f), 'utf8')
      expect(text, f).not.toMatch(/from\s+['"].*audit(-input)?(\.ts)?['"]/)
      expect(text, f).not.toMatch(/api\.meta\.ai|MODEL_API_KEY/)
      expect(text, f).not.toMatch(/sb_secret_|eyJ[A-Za-z0-9_-]{30,}/)
    }
  })
  it('the external demo script hardcodes no key and no verdict', () => {
    const script = readFileSync(join(__dirname, '..', '..', 'examples', 'external-agent-demo.js'), 'utf8')
    expect(script).not.toMatch(/ark_demo_[0-9a-f]{8,}/)
    expect(script).not.toMatch(/decision\s*=\s*['"]/)
    expect(script).toContain('process.env.AGENTRECEIPT_API_KEY')
  })
})
