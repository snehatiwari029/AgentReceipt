// Builds the auditor's input from stored records. The only place that decides which fields reach the auditor.
// It reads grant FIELDS (never the chat: only a hash of it is stored), the action record, the merchant's formal
// terms and hash-check results. Nothing from other orders, disputes or the tamper page.
import type { ActionIn, AuditInput, GrantIn, HashIn, SemanticReturns, TermsIn } from './audit.ts'

type Row = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export type OrderRecords = {
  session_opened: boolean
  grant: Row | null
  proposal: Row | null
  action: Row | null
  product: { category: string | null; formal_returns: string | null; formal_terms_text: string | null; merchant_name: string | null } | null
  merchant_name: string | null // the merchant the grant allows
  hash: HashIn | null
  semantic_returns?: SemanticReturns | null
}

export function auditInputFromRecords(r: OrderRecords): AuditInput {
  const g = r.grant
  const a = r.action
  const detail = ((a?.detail as Row | undefined) ?? {}) as Row
  const believed = (a?.agent_believed_terms as Row | null | undefined) ?? null
  const summary = (detail.agent_summary as Row | undefined) ?? {}

  const grant: GrantIn | null = g
    ? {
      merchant_allowlist: r.merchant_name ? [r.merchant_name] : [],
      product_scope: str(g.product_scope),
      amount_max_cents: int(g.amount_max_cents),
      budget_limit_cents: int(g.budget_limit_cents),
      size_min_cm: int(g.size_min_cm),
      size_max_cm: int(g.size_max_cm),
      colour_preference: str(g.colour_preference),
      delivery_by: str(g.delivery_by),
      return_policy_required: g.return_policy_required === true ? true : g.return_policy_required === false ? false : null,
      payment_method_ref: str(g.payment_method_ref),
      sealed_at: str(g.confirmed_at),
      expires_at: str(g.expires_at),
    }
    : null

  const action: ActionIn | null = a
    ? {
      product_category: str(r.product?.category),
      merchant: str(r.product?.merchant_name),
      colour: str(detail.colour),
      size_cm: int(detail.size_cm),
      item_price_cents: int(detail.item_price_cents),
      shipping_cents: int(detail.shipping_cents),
      total_cents: int(detail.total_cents),
      delivery_date: str(detail.delivery_date),
      sealed_at: str(detail.sealed_at),
      payment_method_ref: str(detail.payment_method),
      agent_summary_returns: str(summary.returns),
      agent_believed_returns: str(believed?.returns),
    }
    : null

  const fr = r.product?.formal_returns
  const terms: TermsIn | null = r.product
    ? {
      formal_returns: fr === 'free' || fr === 'fee' || fr === 'final_sale' ? fr : null,
      formal_terms_text: str(r.product.formal_terms_text),
    }
    : null

  return {
    session_opened: r.session_opened,
    grant, action, terms,
    proposal_present: !!r.proposal,
    hash: r.hash,
    semantic_returns: r.semantic_returns ?? null,
  }
}
