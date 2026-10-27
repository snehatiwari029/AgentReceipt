# PRD Amendment 8: detection engine, PASS / HOLD / REVIEW at order received (Oct 26, evening)

Source: Sneha's detection-engine spec and PRD v1.0 section 8 (governing). This amendment records how it was built and where it deviates.

## What was built
- `supabase/functions/_shared/audit.ts`: the engine. Pure rules, no model, no hash, no network. 9 checks in the specified order
  (Product, Budget, Delivery, Colour, Size, Merchant, Payment, Returns, Validity), then missing components and tamper.
  Output is structured JSON only. Decisions are exactly PASS / HOLD / REVIEW. Gap (no session, grant, action) gives no decision.
- `supabase/functions/auditor/`: the separate AgentReceipt auditor edge function (PRD section 11). Per order it reads only that order's
  grant, proposal, checkout action and the product's formal terms, recomputes the grant / proposal / action hashes and every chain link,
  runs the engine, writes a chained receipt and logs `receipt_issued`. It is idempotent: a repeat call returns the verdict on record.
- Muse Spark's one job in the auditor: read the agent's believed-returns phrase ("Easy returns") and say whether it claims returnable
  or final sale. The rules decide; Spark never decides a verdict or a hash. If Spark is unavailable the keyword reading is used and
  labelled `rules-fallback` in the audit JSON.
- `supabase/008_audit_decision.sql`: receipts gets `decision`, `audit`, `sealed_at`, `fulfillment`; `recommendation` is nullable
  (it is the post-dispute verdict and stays null until a dispute exists); view `orders_requiring_attention` (HOLD + REVIEW, plus any
  received order that has no receipt, which counts as REVIEW).
- The seed now gets its verdicts from the same engine (no hand-written verdicts).
- Shopper: sends the auditor only the session id when an order is received and never reads the reply. The phone says "Order received" and
  "Northwind confirms your order before it ships" for every order, so it never shows a merchant decision.

## Deviations and decisions
1. Hash record field names: kept the existing design (entry_hash = SHA-256(prev hash + canonical fields), backend only). Mapping:
   canonical_fields_json = the record's fields, previous_entry_hash = prev_hash, sealed_at is now an exact timestamp inside every sealed
   record (grant: confirmed_at, action: detail.sealed_at, receipt: sealed_at). Decided by Sneha.
2. "Orders requiring attention" counts decision = hold or review, as specified. The seeded historical hero 12322 is decision HOLD with
   `fulfillment = shipped_override` (shipped under Auto-approve, then disputed). The dashboard step must label it historical and
   post-dispute, and never mix it with a live HOLD row.
3. Tool-trace step names required by PRD section 5 (search_catalog, check_delivery, calculate_total, check_budget, propose, confirm,
   create_order, seal_receipt) are NOT built yet. Next.
4. `shopper-agent` separation test now allows one thing: index.ts posts the session id to the order system. The agent code itself is unchanged
   and still cannot see terms, verdicts or receipts.

## Conflicts flagged and resolved (Sneha, Oct 26 evening)
- Live prompt: the returns line was added back so the live hero shows 2 problems (Budget, Returns). The prompt changed from the 2-day PRD v1 text, with her approval.
- Store data: free standard shipping is 5-7 days for every product except the Orca at 3 days, so Scenario B still works with the Friday prompt (Orca arrives Thu Oct 29).
