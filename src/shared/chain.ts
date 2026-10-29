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

export type OrderChainCheck = {
  ok: boolean
  checked: number
  receipt_hash: string | null
  // The first problem found, with the stored and recomputed hashes, so the failing link can be shown as it is.
  failed: (ChainProblem & { entry_type: ChainEntryType | null; stored_hash: string | null; recomputed_hash: string | null }) | null
  problems: ChainProblem[]
}

// Tamper check for ONE order, used inside the dispute evidence (there is no Tamper page and no tamper endpoint).
// Input: that order's chain records only (grant, proposal, action(s), receipt). Each record's hash is recomputed from
// its own fields and must equal its stored entry_hash; each record's prev_hash must equal the stored hash of the entry
// just before it. When that entry belongs to another order, only its hash is used (`hashAt`, read from the
// chain_entries view), never its contents. Deterministic code only: no model decides pass or fail.
export async function verifyOrderChain(
  records: ChainRecord[],
  hashAt: (chainSeq: number) => string | null | undefined,
): Promise<OrderChainCheck> {
  const sorted = [...records].sort((a, b) => a.chain_seq - b.chain_seq)
  const problems: OrderChainCheck['problems'] = []
  let failed: OrderChainCheck['failed'] = null
  const fail = (p: ChainProblem, entryType: ChainEntryType | null, stored: string | null, recomputed: string | null) => {
    problems.push(p)
    failed ??= { ...p, entry_type: entryType, stored_hash: stored, recomputed_hash: recomputed }
  }

  const receipts = sorted.filter((r) => r.entry_type === 'receipt')
  if (receipts.length !== 1) {
    fail({ chain_seq: receipts[0]?.chain_seq ?? 0, kind: 'missing_entry', message: receipts.length ? 'More than one receipt for this order.' : 'This order has no receipt record.' }, 'receipt', null, null)
  }

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i]
    const before = i > 0 && sorted[i - 1].chain_seq === rec.chain_seq - 1 ? sorted[i - 1].row.entry_hash : null
    const expectedPrev = rec.chain_seq <= 1 ? GENESIS_HASH : before ?? hashAt(rec.chain_seq - 1) ?? null
    const recomputed = await computeEntryHash(rec.row.prev_hash, rec.row)
    if (expectedPrev === null) {
      fail({ chain_seq: rec.chain_seq, kind: 'missing_entry', message: `Entry ${rec.chain_seq - 1}, before entry ${rec.chain_seq} (${rec.entry_type}), is missing from the chain.` }, rec.entry_type, rec.row.entry_hash, recomputed)
    } else if (rec.row.prev_hash !== expectedPrev) {
      fail({ chain_seq: rec.chain_seq, kind: 'broken_link', message: `Entry ${rec.chain_seq} (${rec.entry_type}) does not point at the stored hash of entry ${rec.chain_seq - 1}.` }, rec.entry_type, rec.row.entry_hash, recomputed)
    }
    if (recomputed !== rec.row.entry_hash) {
      fail({ chain_seq: rec.chain_seq, kind: 'content_changed', message: `Entry ${rec.chain_seq} (${rec.entry_type}) no longer matches its hash. Its contents were changed after it was written.` }, rec.entry_type, rec.row.entry_hash, recomputed)
    }
  }

  return { ok: problems.length === 0, checked: sorted.length, receipt_hash: receipts.length === 1 ? receipts[0].row.entry_hash : null, failed, problems }
}
