import { describe, expect, it } from 'vitest'
import { buildSeed } from '../../scripts/seed-dashboard-demo'
import { verifyOrderChain, type ChainRecord } from '../shared/chain'

// The tamper check as a per-order function (used inside the dispute evidence; there is no Tamper page).
// Test data: the seeded demo chain, exactly as the seed script writes it.
async function seeded() {
  const { records } = await buildSeed()
  const chain: ChainRecord[] = records
    .filter((r) => r.entry_type)
    .map((r) => ({ chain_seq: r.row.chain_seq as number, entry_type: r.entry_type as ChainRecord['entry_type'], row: r.row as ChainRecord['row'] }))
  // This order's records only: its grant, proposal, actions and receipt.
  const order = (orderRef: string) => {
    const receipt = chain.find((c) => c.entry_type === 'receipt' && c.row.order_ref === orderRef)!
    const grantId = receipt.row.grant_id
    return chain.filter((c) =>
      c === receipt || (c.entry_type === 'grant' && c.row.id === grantId) || (c.entry_type === 'proposal' && c.row.id === receipt.row.proposal_id) ||
      (c.entry_type === 'action' && c.row.grant_id === grantId))
  }
  const asked: number[] = []
  // The chain view: hashes only, by chain_seq.
  const hashAt = (s: number) => { asked.push(s); return chain.find((c) => c.chain_seq === s)?.row.entry_hash ?? null }
  return { chain, order, hashAt, asked }
}

const editTotal = (records: ChainRecord[], cents: number) =>
  records.map((c) => (c.entry_type === 'receipt' ? { ...c, row: { ...c.row, action_summary: { ...(c.row.action_summary as object), total_cents: cents } } } : c))

describe('verifyOrderChain: one order\'s tamper check', () => {
  it('13422 / AR-2026-0043 verifies from its own 4 records plus one neighbouring hash, and returns the receipt hash', async () => {
    const { order, hashAt, asked } = await seeded()
    const records = order('13422')
    expect(records.map((r) => r.entry_type)).toEqual(['grant', 'proposal', 'action', 'receipt'])
    const check = await verifyOrderChain(records, hashAt)
    expect(check).toMatchObject({ ok: true, checked: 4, failed: null, problems: [] })
    expect(check.receipt_hash).toBe(records[3].row.entry_hash)
    expect(asked).toEqual([records[0].chain_seq - 1]) // only the hash of the entry before its first record
  })

  it('an edited copy fails as content changed, with the stored and recomputed hashes', async () => {
    const { order, hashAt } = await seeded()
    const records = order('13422')
    const check = await verifyOrderChain(editTotal(records, 4898), hashAt)
    expect(check.ok).toBe(false)
    expect(check.failed).toMatchObject({ entry_type: 'receipt', kind: 'content_changed', stored_hash: records[3].row.entry_hash })
    expect(check.failed!.recomputed_hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(check.failed!.recomputed_hash).not.toBe(records[3].row.entry_hash)
  })

  it('AR-2026-0041: the original $449.95 passes and an edited copy at $44.99 fails', async () => {
    const { chain, hashAt } = await seeded()
    const receipt = chain.find((c) => c.entry_type === 'receipt' && c.row.receipt_ref === 'AR-2026-0041')!
    const records = chain.filter((c) => c === receipt || c.row.id === receipt.row.grant_id || c.row.id === receipt.row.proposal_id || (c.entry_type === 'action' && c.row.grant_id === receipt.row.grant_id))
    expect((receipt.row.action_summary as { total_cents: number }).total_cents).toBe(44995)
    expect((await verifyOrderChain(records, hashAt)).ok).toBe(true)
    expect((await verifyOrderChain(editTotal(records, 4499), hashAt)).failed).toMatchObject({ kind: 'content_changed', entry_type: 'receipt' })
  })

  it('a broken chain link fails: a record that does not point at the entry before it', async () => {
    const { order, hashAt } = await seeded()
    const records = order('13422').map((c) => (c.entry_type === 'proposal' ? { ...c, row: { ...c.row, prev_hash: `sha256:${'1'.repeat(64)}` } } : c))
    const check = await verifyOrderChain(records, hashAt)
    expect(check.ok).toBe(false)
    expect(check.problems.map((p) => p.kind)).toContain('broken_link')
  })

  it('fails, never passes, when the neighbouring hash or the receipt is missing', async () => {
    const { order } = await seeded()
    expect((await verifyOrderChain(order('13422'), () => null)).failed).toMatchObject({ kind: 'missing_entry' })
    const noReceipt = order('13422').filter((c) => c.entry_type !== 'receipt')
    expect((await verifyOrderChain(noReceipt, (s) => `x${s}`)).ok).toBe(false)
  })
})
