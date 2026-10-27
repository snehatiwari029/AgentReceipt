import type { Sha256Hash } from './schemas'

// One row of the chain_entries view: every grant, proposal, action, receipt and dispute event,
// in the order they were written.
export type ChainEntry = {
  chain_seq: number
  entry_type: 'grant' | 'proposal' | 'action' | 'receipt' | 'dispute_event'
  entry_id: string
  prev_hash: Sha256Hash
  entry_hash: Sha256Hash
  created_at: string
}

export type ChainProblem = {
  chain_seq: number
  kind: 'broken_link' | 'missing_entry'
  message: string
}

export type ChainCheck = {
  ok: boolean
  checked: number
  problems: ChainProblem[]
}

// Link check: every entry must point at the hash of the entry written just before it, and no
// sequence number may be missing. Editing any earlier entry changes its hash, so the next entry
// no longer points at it. Deleting an entry leaves a gap.
// The content re-hash (recomputing each hash from the record itself) belongs to the receipt
// function, which is not built yet; this check does not claim to do it.
export function verifyLinks(entries: ChainEntry[]): ChainCheck {
  const sorted = [...entries].sort((a, b) => a.chain_seq - b.chain_seq)
  const problems: ChainProblem[] = []

  for (let i = 1; i < sorted.length; i++) {
    const before = sorted[i - 1]
    const here = sorted[i]
    if (here.chain_seq !== before.chain_seq + 1) {
      problems.push({
        chain_seq: here.chain_seq,
        kind: 'missing_entry',
        message: `Entries ${before.chain_seq + 1} to ${here.chain_seq - 1} are missing.`,
      })
    }
    if (here.prev_hash !== before.entry_hash) {
      problems.push({
        chain_seq: here.chain_seq,
        kind: 'broken_link',
        message: `Entry ${here.chain_seq} points at a hash that is not entry ${before.chain_seq}'s hash. Entry ${before.chain_seq} was changed after entry ${here.chain_seq} was written.`,
      })
    }
  }

  return { ok: problems.length === 0, checked: sorted.length, problems }
}

// Demo only: returns a COPY of the chain in which one entry's hash is altered, as if that record had
// been edited. The stored records are never touched.
export function withAlteredEntry(entries: ChainEntry[], chainSeq: number): ChainEntry[] {
  return entries.map((e) => {
    if (e.chain_seq !== chainSeq) return e
    const last = e.entry_hash.slice(-1)
    const flipped = last === '0' ? '1' : '0'
    return { ...e, entry_hash: (e.entry_hash.slice(0, -1) + flipped) as Sha256Hash }
  })
}
