import { GENESIS_HASH, computeEntryHash } from '../../supabase/functions/_shared/hash'

export type ChainEntryType = 'grant' | 'proposal' | 'action' | 'receipt' | 'dispute_event'

// One stored record with its chain fields, as read from its own table.
export type ChainRecord = {
  chain_seq: number
  entry_type: ChainEntryType
  row: Record<string, unknown> & { prev_hash: string; entry_hash: string }
}

export type ChainProblem = {
  chain_seq: number
  kind: 'broken_link' | 'content_changed' | 'missing_entry'
  message: string
}

export type EntryCheck = {
  chain_seq: number
  entry_type: ChainEntryType
  linkOk: boolean
  contentOk: boolean
}

export type ChainCheck = {
  ok: boolean
  checked: number
  entries: EntryCheck[]
  problems: ChainProblem[]
}

// Real verification, in two parts for every record, in written order:
//  1. Link: prev_hash must equal the stored entry_hash of the record before it (the first record
//     must start from the chain origin), and no chain_seq may be missing.
//  2. Content: the hash recomputed from the record's own fields must equal its stored entry_hash.
// Editing any stored record fails (2) for it. Deleting one leaves a gap and fails (1) after it.
export async function verifyChain(records: ChainRecord[]): Promise<ChainCheck> {
  const sorted = [...records].sort((a, b) => a.chain_seq - b.chain_seq)
  const problems: ChainProblem[] = []
  const entries: EntryCheck[] = []

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i]
    const before = i > 0 ? sorted[i - 1] : null
    const expectedPrev = before ? before.row.entry_hash : GENESIS_HASH

    let linkOk = rec.row.prev_hash === expectedPrev
    if (before && rec.chain_seq !== before.chain_seq + 1) {
      linkOk = false
      problems.push({
        chain_seq: rec.chain_seq,
        kind: 'missing_entry',
        message: `Entries ${before.chain_seq + 1} to ${rec.chain_seq - 1} are missing.`,
      })
    }
    if (rec.row.prev_hash !== expectedPrev) {
      problems.push({
        chain_seq: rec.chain_seq,
        kind: 'broken_link',
        message: before
          ? `Entry ${rec.chain_seq} does not point at the stored hash of entry ${before.chain_seq}.`
          : `Entry ${rec.chain_seq} does not start from the chain origin.`,
      })
    }

    const recomputed = await computeEntryHash(rec.row.prev_hash, rec.row)
    const contentOk = recomputed === rec.row.entry_hash
    if (!contentOk) {
      problems.push({
        chain_seq: rec.chain_seq,
        kind: 'content_changed',
        message: `Entry ${rec.chain_seq} (${rec.entry_type}) no longer matches its hash. Its contents were changed after it was written.`,
      })
    }
    entries.push({ chain_seq: rec.chain_seq, entry_type: rec.entry_type, linkOk, contentOk })
  }

  return { ok: problems.length === 0, checked: sorted.length, entries, problems }
}
