# AgentReceipt PRD — Amendment 1 (dated 26 October 2026)

**Applies to:** PRD v0.1 (22 Oct 2026). v0.1 text is NOT edited. This amendment supersedes the clauses listed in Section 2.
**Basis:** PRD v0.2 grant-section draft (26 Oct 2026) plus Sneha's decisions of 26 Oct 2026, 15:20 PT.
**Status:** Approved by Sneha for build. Source for the grant model: Mastercard Verifiable Intent (VI), open spec, Draft v0.1 — borrowed where applicable, not claimed as VI compliance.

---

## 1. Principle

The grant is **structured fields, not a sentence**. The full customer chat is held privately by the personal agent (Muse). AgentReceipt stores only a **hash of that chat** (`private_chat_hash`), never its text. A further excerpt is disclosed only with fresh customer consent for that specific dispute (described in text only; not built in the hackathon).

Honest limit (say this in the pitch): if Muse writes a wrong grant, the receipt checks against that wrong grant. The control for that is the customer's confirmation screen, not the merchant re-reading the chat.

## 2. v0.1 clauses superseded

| v0.1 clause | Now reads |
|---|---|
| Principle 6 "Verbatim before structured" | Fields before prose. The confirmed grant fields are the ground truth the verdict cites. The chat is private; only its hash is stored. |
| §1 and §3 "preserved verbatim", "verbatim intent" | "confirmed grant fields" |
| FR-GRT-01 (store instruction verbatim) | Store `private_chat_hash` (SHA-256 of the private chat). No chat text is stored. |
| FR-RCP-01 "six components" | Receipt components: confirmed grant (versioned), proposal record, action log, merchant terms snapshot, mismatch results, receipt ID + chain head. Any missing component is an explicit gap. |
| FR-DSH-03 "verbatim instruction always visible" | The confirmed grant fields are always visible. No chat text on any merchant screen. |
| NFR privacy row ("verbatim intent shown to merchant") | Merchants see grant fields for that purchase only. |
| Receipt schema `intent.verbatim` | `intent.private_chat_hash` |
| `grants.intent_verbatim` column | `grants.private_chat_hash` |
| Scenario B "receipt shows verbatim instruction" | Receipt shows the confirmed grant fields, the proposal record, and a compliant action log. |
| Appendix B/C wording ("verbatim intent + confirmed grant → proof of authorization") | "confirmed grant fields + proposal record → proof of authorization" |
| Verdict screen columns (Authorized / Terms / Actually happened) | Field / Grant / Merchant terms / Actual / Match / Cause / Next action / Who acts |
| Dashboard spec: "Liability" column; "exact confirmed grant excerpt" privacy note; "Generate dispute pack for Mastercard" | "Next action / Who acts"; "grant fields only, never the chat"; "Generate evidence pack (mapped to compelling-evidence fields)" |

## 3. Decisions (all eight, plus additions)

1. **`private_chat_hash`**: hash only, no text, stored separately from the grant seal (`entry_hash`).
2. **Verdict columns**: Field | Grant | Merchant terms | Actual | Match | Cause | Next action / Who acts. No separate "Intent" column.
3. **One Budget mismatch** citing both `payment.amount.max` and `payment.budget.limit`. Hero `problems_found` = 2.
4. **Unspecified never blocks represent.** Unspecified grant field = recorded as null, "not specified, no check" (grey). Only a missing record component (action log, terms snapshot, receipt) blocks represent and flips to "recommend review".
5. **`agent_believed_terms`** stays as a structured action-record field (e.g. `"Easy returns"`). It is not shopper reasoning or chain-of-thought. The Auditor sees it and must not see reasoning.
6. **Payment label: "Demo PayPal"** everywhere. No card numbers on any row.
7. **Scenario B** defined below.
8. **`image_evidence_ref`** lives on the action/receipt record, P1, not in the grant. No check uses it.

Additions: `shopper_ref`, `agent_id`, `agent_verified` (simulated); `shipping_method` and `shipping_max_cost` stored as not specified; `delivery_by` stored as an exact date and `expires_at` as an exact timestamp; `data_sharing_limits` moved to system metadata ("not checked (P1)"); a structured **proposal record**; VI names internal only; screen labels.

## 4. Grant fields (v0.2)

| Field | Check type | Hero 12322 | Scenario B 13422 |
|---|---|---|---|
| shopper_ref | who | demo shopper (Jemaih Soresky) | demo shopper (Ivan Dijkstra) |
| agent_id | who | meta-muse-j0376672 | instinct-kk14680 |
| agent_verified | who | true (SIMULATED) | true (SIMULATED) |
| merchant | allowlist | Northwind Outfitters only | Northwind Outfitters only |
| amount_max (`payment.amount.max`) | budget | $500 USD | $500 USD |
| budget_cap (`payment.budget.limit`) | budget | $500 USD, this delegation | $500 USD, this delegation |
| product_scope | line items | Snowboard | Snowboard |
| size range | extension | 150–165 cm | 150–165 cm |
| colour_preference | extension | Blue | Black/Red |
| delivery_by | extension | 2026-10-30 (Friday) | 2026-10-30 (Friday) |
| return_policy_required | extension | true | true |
| shipping_method | not specified, no check | null | null |
| shipping_max_cost | not specified, no check | null | null |
| payment_method_ref | payee/reference | Demo PayPal | Demo PayPal |
| confirmed_at / expires_at | validity | exact timestamps; expires 24h after confirmation | same |
| private_chat_hash | seal | SHA-256 of private chat | same |

System metadata (not customer-authorised, not sealed in the grant, not checked): `data_sharing_limits` = "grant fields only, this purchase only" (P1).

VI identifiers (`payment.amount` style) are an **internal mapping only** until verified against the VI spec repo. UI and pitch use plain names (amount_max, budget_cap).

## 5. Auditor rules

- Input: grant fields + merchant terms snapshot + action record (including `agent_believed_terms`) + proposal record. Never chat text, never reasoning.
- **Deduplication:** `amount_max` and `budget_cap` collapse into one Budget check citing both fields.
- Output rows follow FR-MIS-08: `{field, grant, merchant_terms, actual, result, cause, next_action_who}` with result in match / mismatch / unspecified. Evidence is a field value plus the compared source and value, not a quote.
- Recommendation: any material mismatch → concede; zero mismatches and no missing components → represent; missing record component → review. Advisory only; the merchant decides.
- Screen line: "AgentReceipt shows mismatch facts only; it does not decide liability and no network rule moves liability on this screen."

## 6. Hero 12322 (receipt AR-2026-0042)

**Proposal record** (stored in the receipt, separate from the chat and from the grant): item price shown $459; returns summary shown "Easy returns"; delivery shown Friday; **not shown: the $519 total and final sale**; timestamp and confirmation ref. "Blue looks cool. Order it." confirms the proposal as shown. It does not ratify the total or the terms.

**Action:** Ridgeline Freestyle Snowboard 155cm Blue, $459 + $60 expedited = $519, delivery by Friday, formal terms final sale, Demo PayPal. `agent_believed_terms`: "Easy returns".

**Result (exactly 2 problems):** (1) Budget $500 vs $519 — cause: agent treated the cap as item-only; (2) Returns: grant returnable vs formal terms final sale — cause: agent summary "Easy returns" misrepresented the terms. Met: size 155 in range, delivery by Friday, colour blue, merchant allowlist, payment method. Shipping method/max cost: not specified, no check.

## 7. Scenario B 13422 (Powderline, merchant represents and wins)

- Grant: as table above (black/red, $500, Friday, returnable true, Demo PayPal).
- Action: Powderline All-Mountain 162cm Black/Red, **$489 total**, no expedited charge (in this store data standard delivery meets Friday), formal terms "Free returns (30-day)". `agent_believed_terms`: "Free returns (30-day)".
- Proposal record: shows $489 total, "Free returns", Friday. The customer's confirmation was informed and the summary matched the terms.
- Result: 0 problems, recommendation represent, merchant wins. Customer's dispute reason (DRAFT, to confirm): "Not what I wanted."

## 8. Gap row 14522

"Unverified agent, no AgentReceipt session opened, no receipt (gap recorded)." Blocked, if at all, by the merchant's existing fraud controls, not by AgentReceipt. No "stolen card declined (DRS 501)" language.

## 9. Labels and claims

- Screens showing hash-sealed grants: "VI-aligned demo representation". Not a bank-issued SD-JWT credential, not VI-compliant.
- Verified-agent badge: "Simulated verified-agent signal".
- Dispute claim: "VI doesn't provide mismatch detection, dispute workflow or evidence packs." Do NOT say VI explicitly leaves dispute resolution out of scope.
- Disclosure of a further excerpt with fresh consent: text only, not built.

## 10. Deviations from v0.1 (logged, per the build rules)

1. **Demo reset vs append-only.** FR-RCP-02 forbids any delete path; FR-ADM-01 requires a reset under 30 seconds. Resolution: append-only is enforced by database triggers, and the only exception is a server-side `demo_reset()` function callable by the service role only. Production deployments must drop it.
2. **Grant hash = chain `entry_hash`.** No separate grant hash column. `private_chat_hash` is the separate chat fingerprint.
3. **Catalog is 7 products, not ~10** (dashboard spec).
4. **Scenario A is the snowboard hero** (blue jacket under $50 retired).
5. **Hash computation lives in the edge function** (Day 5), not in SQL, so canonical sorted-key JSON is reproducible by a third party.

## 11. Open items

- **Demo clock.** "Friday Oct 30, 2026" only works if the demo runs on or near Mon 26 Oct. Recommendation: the store shows a fixed "Demo date: Mon 26 Oct 2026" and stores delivery as day offsets; decide before seeding products.
- **Addendum A3 text** (Muse Image ID + hash): not in the files I can see. `image_evidence_ref` is a nullable jsonb until I see it.
- **VI identifier names:** verify at verifiableintent.dev before any appear in UI or pitch.
- **Receipt AR-2026-0041** (tamper demo, $459.00 → $45.90) must be created through the real hash-chain code, not hand-typed.
- **Scenario B dispute reason** wording to confirm.
- Trap data (standard delivery misses Friday; "Easy returns" blurb vs final-sale terms) goes in the store seed; measure about 10 hero runs, and if unreliable change the store, not the agent.
