import type { ListingResult } from '../../supabase/functions/optimizer/checks'
import type { Reply, SuggestionRow } from '../../supabase/functions/optimizer/run'

// The Optimization page writes through one place: the optimizer edge function (publishable key only, like the phone
// screen). The function records decisions in its own tables; nothing here or there writes a listing.
export type OptimizerRequest =
  | { action: 'scan'; merchant_id: string }
  | { action: 'decide'; merchant_id: string; suggestion_id: string; decision: 'approve' | 'reject'; fix_text?: string; values?: Record<string, string> }
  | { action: 'approve_all'; merchant_id: string; suggestion_ids: string[] }

export async function callOptimizer(body: OptimizerRequest): Promise<Reply> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key) return { type: 'error', message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.' }
  try {
    const res = await fetch(`${base}/functions/v1/optimizer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as Reply | null
    if (json && typeof json === 'object' && 'type' in json) return json
    return { type: 'error', message: `The optimizer answered HTTP ${res.status}.` }
  } catch {
    return { type: 'error', message: 'Could not reach the optimizer. Check your connection and try again.' }
  }
}

// Rows as stored by the function (supabase/012_listing_optimizer.sql).
export type Suggestion = SuggestionRow & { created_at?: string; updated_at?: string }
export type ScanListing = Omit<ListingResult, 'flags'> & { flag_keys: string[] }
export type Scan = {
  id: string
  merchant_id: string
  scanned_at: string
  listings_scanned: number
  catalogue_source: string
  markup: { status: string; url: string | null; http_status: number | null; bytes: number; products_found: number; error: string | null }
  spark: Record<string, number>
  aggregate_mismatch_counts: Record<string, number>
  results: ScanListing[]
}

// Section 8, same rule as the function's rankFlags: category first; a category 3-5 flag that already caused a real
// mismatch ranks just after category 2; then by mismatches caused.
export function rankSuggestions<T extends Pick<Suggestion, 'category' | 'caused_mismatch_count' | 'pillar'>>(list: T[]): T[] {
  const tier = (s: T) => (s.category <= 2 ? s.category : s.caused_mismatch_count > 0 ? 2.5 : s.category)
  return [...list].sort((a, b) => tier(a) - tier(b) || b.caused_mismatch_count - a.caused_mismatch_count || a.pillar - b.pillar)
}

export const STATUS_LABEL: Record<Suggestion['status'], string> = {
  pending: 'Pending your decision',
  approved: 'Approved — awaiting merchant application',
  rejected: 'Rejected',
  resolved: 'Resolved on re-scan',
  still_flagged: 'Still flagged — see re-scan evidence',
}
