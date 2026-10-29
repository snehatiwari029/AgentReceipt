import type { Reply } from '../../supabase/functions/disputes/run'
import type { Processor, TextSource, Texts } from '../../supabase/functions/disputes/pack'

// The Disputes page and the Agent orders merchant-action form write through one place: the disputes edge function
// (publishable key only). The browser never writes a table; row-level security blocks it anyway.
export type DisputesRequest =
  | {
    action: 'record_dispute'; merchant_id: string; order_ref: string; processor: Processor; claim: string; claim_type: string
    reason_code: string; dispute_date: string; dispute_amount_cents: number | null; processor_reference: string | null; channel: string | null
  }
  | {
    action: 'record_review'; merchant_id: string; receipt_id: string; action_taken: string; method: string; notes: string
    confirmed_total: string | null; confirmed_terms: string | null; release_decision: string
  }
  | { action: 'record_event'; merchant_id: string; dispute_id: string; event_type: string; date: string | null; reason: string | null }
  | { action: 'format_pack'; merchant_id: string; dispute_id: string; processor: Processor }
  | { action: 'record_pack'; merchant_id: string; dispute_id: string; processor: Processor; pack_hash: string; text_source: TextSource; texts: Texts | null }

export async function callDisputes(body: DisputesRequest): Promise<Reply> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key) return { type: 'error', message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.' }
  try {
    const res = await fetch(`${base}/functions/v1/disputes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as Reply | null
    if (json && typeof json === 'object' && 'type' in json) return json
    return { type: 'error', message: `The dispute function answered HTTP ${res.status}.` }
  } catch {
    return { type: 'error', message: 'Could not reach the dispute function. Check your connection and try again.' }
  }
}

export const MERCHANT_NAME = 'Northwind Outfitters'
