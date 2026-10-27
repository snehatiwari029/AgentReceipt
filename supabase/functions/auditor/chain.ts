// Appends one record to the hash chain. Spec lives in hash.ts (single source of truth).
// The database assigns chain_seq and created_at; prev_hash is the newest entry_hash across all chained tables.
import { GENESIS_HASH, computeEntryHash } from './hash.ts'

export interface ChainDb {
  latestHash(): Promise<string | null>
  insert(table: string, row: Record<string, unknown>): Promise<void>
}

// Known limitation (documented in Amendment 3): two sessions appending at the same instant could both read the
// same latest hash and fork the chain. Acceptable for a single-presenter demo; fix before any real use.
export async function appendChained(db: ChainDb, table: string, row: Record<string, unknown>) {
  const prev = (await db.latestHash()) ?? GENESIS_HASH
  const entry_hash = await computeEntryHash(prev, row)
  const stored = { ...row, prev_hash: prev, entry_hash }
  await db.insert(table, stored)
  return stored
}
