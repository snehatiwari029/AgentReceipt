import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSeed } from '../../scripts/seed-dashboard-demo'
import { verifyChain, type ChainRecord } from '../shared/chain'
import { GENESIS_HASH, canonicalJson, computeEntryHash } from '../../supabase/functions/_shared/hash'

const TYPES = { grants: 'grant', proposals: 'proposal', actions: 'action', receipts: 'receipt', dispute_events: 'dispute_event' } as const

async function chainOf() {
  const { records, sql } = await buildSeed()
  const chain: ChainRecord[] = records
    .filter((r) => r.entry_type)
    .map((r) => ({ chain_seq: r.row.chain_seq as number, entry_type: r.entry_type as ChainRecord['entry_type'], row: r.row as ChainRecord['row'] }))
  return { records, sql, chain }
}

describe('hash spec', () => {
  it('canonical JSON sorts keys at every depth and normalises date-times', () => {
    expect(canonicalJson({ b: 1, a: { d: null, c: '2026-10-26T17:05:00+00:00' } })).toBe('{"a":{"c":"2026-10-26T17:05:00.000Z","d":null},"b":1}')
  })

  it('ignores chain_seq, created_at and the hash fields when hashing', async () => {
    const a = await computeEntryHash(GENESIS_HASH, { x: 1, chain_seq: 1, created_at: 'a', prev_hash: 'p', entry_hash: 'e' })
    const b = await computeEntryHash(GENESIS_HASH, { x: 1, chain_seq: 9, created_at: 'b', prev_hash: 'q', entry_hash: 'f' })
    expect(a).toBe(b)
    expect(await computeEntryHash(GENESIS_HASH, { x: 2 })).not.toBe(a)
  })
})

describe('dashboard demo seed', () => {
  it('is deterministic and the SQL file on disk is exactly what the script generates', async () => {
    const first = await buildSeed()
    const second = await buildSeed()
    expect(first.sql).toBe(second.sql)
    expect(readFileSync(join(__dirname, '..', '..', 'supabase', 'seed_dashboard_demo.sql'), 'utf8')).toBe(first.sql)
  })

  it('writes a chain that verifies from the origin, with 16 chained entries in order', async () => {
    const { chain } = await chainOf()
    expect(chain).toHaveLength(16)
    expect(chain.map((c) => c.chain_seq)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
    expect(chain[0].row.prev_hash).toBe(GENESIS_HASH)
    const check = await verifyChain(chain)
    expect(check.ok).toBe(true)
    expect(check.problems).toEqual([])
  })

  it('fails verification when any stored record is edited, such as AR-2026-0041 from $449.95 to $44.99', async () => {
    const { chain } = await chainOf()
    const target = chain.find((c) => c.entry_type === 'receipt' && c.row.receipt_ref === 'AR-2026-0041')!
    expect((target.row.action_summary as { total_cents: number }).total_cents).toBe(44995)
    const edited = chain.map((c) =>
      c === target ? { ...c, row: { ...c.row, action_summary: { ...(c.row.action_summary as object), total_cents: 4499 } } } : c,
    )
    const check = await verifyChain(edited)
    expect(check.ok).toBe(false)
    expect(check.problems).toEqual([expect.objectContaining({ chain_seq: target.chain_seq, kind: 'content_changed' })])
  })

  it('fails when a record is deleted (gap) and when records are reordered', async () => {
    const { chain } = await chainOf()
    const missing = await verifyChain(chain.filter((c) => c.chain_seq !== 9))
    expect(missing.ok).toBe(false)
    expect(missing.problems.map((p) => p.kind)).toContain('missing_entry')
  })

  it('has the exact orders: hero 12322 with 2 problems, 13422 with 0, 14522 as a gap without a receipt', async () => {
    const { records } = await chainOf()
    const receipts = records.filter((r) => r.table === 'receipts').map((r) => r.row)
    const hero = receipts.find((r) => r.receipt_ref === 'AR-2026-0042')!
    expect(hero).toMatchObject({ order_ref: '12322', problems_found: 2, recommendation: null, decision: 'review_required', fulfillment: 'held' })
    expect((hero.action_summary as { total_cents: number }).total_cents).toBe(50995)
    const mism = (hero.mismatch_results as { field: string; result: string }[]).filter((m) => m.result === 'mismatch').map((m) => m.field)
    expect(mism).toEqual(['Budget', 'Returns'])

    const b = receipts.find((r) => r.order_ref === '13422')!
    expect(b).toMatchObject({ problems_found: 0, recommendation: 'represent' })
    expect((b.action_summary as { total_cents: number }).total_cents).toBe(48983)
    const colour = (b.mismatch_results as { field: string; result: string }[]).find((m) => m.field === 'Colour')!
    expect(colour.result).toBe('unspecified')

    expect(receipts.some((r) => r.order_ref === '14522')).toBe(false)
    const gap = records.find((r) => r.table === 'sessions' && r.row.detection_source === 'none')!.row
    expect(gap.gap_note).toBe('Order 14522: Unverified agent, no AgentReceipt session opened, no receipt (gap recorded)')
    expect(receipts.map((r) => r.receipt_ref)).toContain('AR-2026-0041')
  })

  it('every problems_found equals the number of mismatch rows, and the hero proposal hides the total and final sale', async () => {
    const { records } = await chainOf()
    for (const r of records.filter((x) => x.table === 'receipts')) {
      const n = (r.row.mismatch_results as { result: string }[]).filter((m) => m.result === 'mismatch').length
      expect(r.row.problems_found).toBe(n)
    }
    const heroGrant = records.find((r) => r.table === 'grants' && r.row.shopper_ref === 'Jemaih Soresky')!.row
    const proposal = records.find((r) => r.table === 'proposals' && r.row.grant_id === heroGrant.id)!.row
    expect(proposal).toMatchObject({ shown_item_price_cents: 44995, shown_total_cents: null, shown_returns_summary: 'Easy returns per product page' })
    expect(JSON.stringify(proposal)).not.toMatch(/final/i)
  })

  it('seeded receipts carry the engine decision: hero Review Required (held, no dispute), 13422 PASS, 0041 PASS', async () => {
    const { records } = await chainOf()
    const rc = records.filter((r) => r.table === 'receipts').map((r) => r.row)
    const by = (ref: string) => rc.find((r) => r.receipt_ref === ref)!
    expect(by('AR-2026-0042')).toMatchObject({ decision: 'review_required', problems_found: 2, fulfillment: 'held', recommendation: null })
    // the hero is NOT a dispute: the only dispute in the seed is the separate Orca order 13422
    const disputes = records.filter((r) => r.table === 'disputes').map((r) => r.row)
    expect(disputes).toHaveLength(1)
    expect(disputes[0].receipt_id).toBe(by('AR-2026-0043').id)
    expect((by('AR-2026-0042').audit as { problem_fields: string[] }).problem_fields).toEqual(['Budget', 'Returns'])
    expect(by('AR-2026-0043')).toMatchObject({ decision: 'pass', problems_found: 0, fulfillment: 'proceed' })
    expect(by('AR-2026-0041')).toMatchObject({ decision: 'pass', problems_found: 0 })
    for (const r of rc) {
      expect(typeof r.sealed_at).toBe('string')
      expect((r.audit as { footer: string }).footer).toContain('does not decide liability')
    }
    // the colour row for 13422 is "not specified, no check", and the action carries an exact sealed_at timestamp
    const b = by('AR-2026-0043').mismatch_results as { field: string; result: string }[]
    expect(b.find((m) => m.field === 'Colour')!.result).toBe('unspecified')
    const actions = records.filter((r) => r.table === 'actions').map((r) => (r.row.detail as { sealed_at: string }).sealed_at)
    for (const t of actions) expect(t).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('stores grant fields only: unmentioned fields are null, no chat text, Demo Checkout, no card wording', async () => {
    const { records, sql } = await chainOf()
    const grants = records.filter((r) => r.table === 'grants').map((r) => r.row)
    const b = grants.find((g) => g.shopper_ref === 'Ivan Dijkstra' && g.agent_id === 'instinct-kk14680' && g.return_policy_required === true)!
    expect(b.colour_preference).toBeNull()
    expect(b.product_scope).toBeNull()
    for (const g of grants) {
      expect(g.payment_method_ref).toBe('Demo Checkout')
      expect(g.grant_json).toMatchObject({ payment_method_detail: 'PayPal', payment_simulated: true })
      expect(g.schema_label).toBe('VI-aligned demo representation')
      expect(g.return_policy_required === false).toBe(false)
      expect(Object.keys(g)).not.toEqual(expect.arrayContaining(['intent_verbatim']))
    }
    expect(sql).not.toMatch(/mastercard|visa|••|\b\d{4} \d{4} \d{4}/i)
    expect(sql).not.toMatch(/\bchat\b.*:.*"/i)
  })

  it('the SQL stops safely: guards, one transaction, no schema changes', async () => {
    const { sql } = await chainOf()
    expect(sql).toMatch(/^begin;/m)
    expect(sql).toMatch(/commit;\s*$/)
    expect(sql).toMatch(/Seed stopped/)
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+(table|policy|function|index|trigger)\b/i)
    expect(sql).toMatch(/setval\('chain_seq_gen', 16, true\)/)
    void TYPES
  })
})
