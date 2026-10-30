import type { Dispute, Receipt } from '../shared/schemas'

// The sample dispute example. Built in the browser only, never written to the database and never sent to the disputes
// function: it shows what a complete pack looks like when the dispute notice data is present. In the real product that
// data comes from the merchant's dispute records once the store is connected and dispute permission is granted.
// It reuses order 13422's REAL transaction record (grant, action, formal terms, verdict, receipt, hash, tamper check);
// only the dispute notice fields below are sample values. Live 13422's own dispute record is not changed.
export const SAMPLE_ORDER_REF = '13422'
// A well-formed id that no stored dispute has, so reads by this id find nothing.
export const SAMPLE_DISPUTE_ID = '00000000-0000-4000-8000-000000013422'

export function sampleDisputeFor(receipt: Receipt): Dispute {
  return {
    id: SAMPLE_DISPUTE_ID,
    receipt_id: receipt.id,
    merchant_id: receipt.merchant_id,
    sample: true,
    // The customer's description, as on the live dispute: not a network code, shown apart from the condition.
    reason: 'Agent overstep — agent exceeded budget / bought outside grant',
    claim_type: 'agent_outside_grant',
    processor: 'visa',
    reason_code: '10.4 — Other Fraud, Card-Absent Environment',
    dispute_date: '2026-10-30',
    dispute_amount_cents: 48983, // sample: same as the transaction amount, for this demo example only
    processor_reference: 'SAMPLE-13422-VISA-104',
    channel: 'Sample acquirer (demo)',
    card_last4_or_token: '•••• 4242 (sample token / test last 4)',
    opened_at: '2026-10-30T00:00:00.000Z',
  }
}
