import { describe, expect, it } from 'vitest'
import { verifyLinks, withAlteredEntry, type ChainEntry } from '../shared/chain'
import type { Sha256Hash } from '../shared/schemas'

const h = (c: string) => `sha256:${c.repeat(64)}` as Sha256Hash

// Test fixture: a 4-entry chain whose links are correct.
export const CHAIN: ChainEntry[] = [
  { chain_seq: 1, entry_type: 'grant', entry_id: 'g', prev_hash: h('0'), entry_hash: h('a'), created_at: '2026-10-26T00:00:00Z' },
  { chain_seq: 2, entry_type: 'proposal', entry_id: 'p', prev_hash: h('a'), entry_hash: h('b'), created_at: '2026-10-26T00:00:01Z' },
  { chain_seq: 3, entry_type: 'action', entry_id: 'x', prev_hash: h('b'), entry_hash: h('c'), created_at: '2026-10-26T00:00:02Z' },
  { chain_seq: 4, entry_type: 'receipt', entry_id: 'r', prev_hash: h('c'), entry_hash: h('d'), created_at: '2026-10-26T00:00:03Z' },
]

describe('verifyLinks', () => {
  it('accepts an intact chain', () => {
    expect(verifyLinks(CHAIN)).toEqual({ ok: true, checked: 4, problems: [] })
  })

  it('accepts an empty chain and a single entry', () => {
    expect(verifyLinks([]).ok).toBe(true)
    expect(verifyLinks([CHAIN[0]]).ok).toBe(true)
  })

  it('fails at the entry after an altered one', () => {
    const r = verifyLinks(withAlteredEntry(CHAIN, 2))
    expect(r.ok).toBe(false)
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toMatchObject({ chain_seq: 3, kind: 'broken_link' })
  })

  it('does not change the original array when altering', () => {
    const before = JSON.stringify(CHAIN)
    withAlteredEntry(CHAIN, 1)
    expect(JSON.stringify(CHAIN)).toBe(before)
  })

  it('reports a removed entry as missing, plus the broken link', () => {
    const r = verifyLinks(CHAIN.filter((e) => e.chain_seq !== 3))
    expect(r.ok).toBe(false)
    expect(r.problems.map((p) => p.kind).sort()).toEqual(['broken_link', 'missing_entry'])
  })

  it('sorts entries before checking', () => {
    expect(verifyLinks([...CHAIN].reverse()).ok).toBe(true)
  })
})
