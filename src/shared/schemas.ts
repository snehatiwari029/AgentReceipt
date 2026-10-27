// Row shapes for the AgentReceipt tables (supabase/001_schema_v0.2.sql). Shared by any view that
// reads them. Labelled "VI-aligned demo representation": fields follow Mastercard Verifiable Intent
// concepts (who, what, scope/constraints, expiry) without claiming compliance.
export type Sha256Hash = `sha256:${string}`

export type ChainFields = {
  chain_seq: number
  prev_hash: Sha256Hash
  entry_hash: Sha256Hash
}

// A null checkable field means "not specified, no check".
export type Grant = ChainFields & {
  id: string
  session_id: string
  version: number
  shopper_ref: string
  agent_id: string
  agent_verified: boolean
  merchant_id: string | null
  product_scope: string | null
  size_min_cm: number | null
  size_max_cm: number | null
  colour_preference: string | null
  currency: string
  amount_max_cents: number | null
  budget_limit_cents: number | null
  payment_method_ref: string | null
  shipping_method: string | null
  shipping_max_cost_cents: number | null
  delivery_by: string | null
  return_policy_required: boolean | null
  confirmed_at: string
  expires_at: string
  private_chat_hash: Sha256Hash
  grant_json: Record<string, unknown>
  schema_label: string
}

export type Proposal = ChainFields & {
  id: string
  grant_id: string
  product_id: string | null
  shown_item_price_cents: number
  shown_total_cents: number | null
  shown_returns_summary: string
  shown_delivery: string
  shown_at: string
  confirmation_ref: string
  confirmed_at: string
}

export type ActionType = 'view' | 'terms_read' | 'select' | 'shipping' | 'checkout' | 'data_share'

export type AgentAction = ChainFields & {
  id: string
  grant_id: string
  seq: number
  type: ActionType
  detail: Record<string, unknown>
  agent_believed_terms: Record<string, unknown> | null
  image_evidence_ref: Record<string, unknown> | null
}

export type MismatchResult = {
  field: string
  grant: string | null
  merchant_terms: string | null
  actual: string | null
  result: 'match' | 'mismatch' | 'unspecified'
  cause: string | null
  next_action_who: string | null
  cited_fields: string[]
}

export type Recommendation = 'represent' | 'concede' | 'review'

export type Receipt = ChainFields & {
  id: string
  receipt_ref: string
  order_ref: string | null
  grant_id: string
  proposal_id: string | null
  merchant_id: string
  terms_snapshot: Record<string, unknown>
  action_summary: Record<string, unknown>
  mismatch_results: MismatchResult[]
  problems_found: number
  recommendation: Recommendation
  missing_components: string[]
  image_evidence_ref: Record<string, unknown> | null
  schema_label: string
}

export type Dispute = {
  id: string
  receipt_id: string
  reason: string
  opened_at: string
}

export type DisputeEventType =
  | 'opened'
  | 'recommendation'
  | 'conceded'
  | 'represented'
  | 'pack_generated'
  | 'outcome_won'
  | 'outcome_lost'

export type DisputeEvent = ChainFields & {
  id: string
  dispute_id: string
  event_type: DisputeEventType
  decided_by: string | null
  basis: Record<string, unknown>
}
