# Amendment 9: three decisions, auditor privacy boundary, wider Spark use (Oct 26, 2026)

Approved by Sneha. Supersedes the decision names in Amendment 8.

- **Decisions:** only Pass / Review Required / Hold for Suspicion. Old names HOLD, REVIEW, "recommend review", represent and concede are no longer decisions. Represent / concede remain only as post-dispute outcomes on a separate disputed order.
- **Swap vs Amendment 8:** a field mismatch used to be HOLD and a missing/tampered record used to be REVIEW. Now a mismatch is Review Required and a missing/tampered record is Hold for Suspicion. An expired grant moved from mismatch to Hold for Suspicion. An unverified agent (including the 14522 gap) is Hold for Suspicion.
- **Hero:** $509.95 order is Review Required only, no dispute, no Disputes row. This **changes PRD Scenario A** ("merchant concedes"): Scenario A is now "detected and held before shipping". The only dispute in the seed is the separate Orca order 13422 (Scenario B).
- **Privacy:** the auditor reads structured fields only (agent_summary_returns, agent_summary_delivery, agent_believed_terms), never chat or proposal free text. Spark call 3 compares structured returns fields to formal terms and returns `returns_summary_matches_terms` + reason. Call 4 turns the agent's delivery phrase into an exact date, only when code cannot read it. Code does all matching and arithmetic.
- **New check:** the arrival the agent told the customer must equal the real arrival (a mismatch is a Delivery problem).
- **Scope:** Spark calls 5-7 (evidence narrative, listing optimizer, dispute classification) are documented as planned in the README, not built.
- **Deviation noted:** seeded hero 12322 now mirrors the live 2-day prompt (Burton + expedited, arrives Wed Oct 28, no colour), not the earlier Friday prompt. The Orca remains the Friday Scenario B order. Expedited is 2 days in the seed terms.
- **Database:** migration 009 (decision values, guards, `orders_requiring_attention` view includes unverified-agent gaps). Requires `demo_reset()` and a re-seed (all previous test orders cleared).
- **Not done yet:** live Tamper page does not recompute hashes from stored records (the auditor does, on new orders); the tamper acceptance case is covered by an automated test, not a live screen.
