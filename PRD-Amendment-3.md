# AgentReceipt PRD Amendment 3 (26 Oct 2026)

Amends PRD v0.2 + Amendments 1 and 2. Covers the shopper agent build. Where this and earlier documents disagree, this one wins for the shopper agent.

## 1. What was built
- Edge function `shopper-agent` (the brain) and the `/chat` phone screen (the face), plus a three-button entry page.
- Model: Muse Spark `muse-spark-1.3` via `https://api.meta.ai/v1/chat/completions` (endpoint verified from dev.meta.ai docs).
- Tools the model calls: `capture_order_rules`, `search_products`, `get_product`, `propose_products`, `place_order`. Each carries a short `why` shown to the customer as a "Muse is checking: ..." line. These lines are display only and are not stored.

## 2. Decisions and deviations (please review)
1. **New table `session_events`** (migration 007), append-only, holds the session log in the required order. Applied to the live database.
2. **Session, grant and the first five log steps are written when the customer taps "Looks right".** Nothing is stored for a draft the customer never confirms. The draft travels between phone and function in the request; the function re-validates it.
3. **"Receipt issued" is not written yet.** It belongs to the separate receipt function (decided with Sneha).
4. **Real clock.** "Today" is the America/Los_Angeles date (optional `DEMO_DATE` secret). The trap needs expedited (4 days) to land on Fri 30 Oct and standard (5 days) to miss it, which is true only if the demo is run on **Mon 26 Oct 2026**. On any later day neither option meets Friday. Before recording the video, set `DEMO_DATE=2026-10-26` or change the shipping days in the store data.
5. **Store data changed to shape the trap (not the agent prompt):** Orca `marketing_blurb` now starts "Free returns."; Burton colour is "Serpent"; Burton and Nitro expedited delivery is 4 days. (The last two are also in `seed_dashboard_demo.sql`; applied live already.)
6. **`verify_jwt` is off** for `shopper-agent` because the browser holds only the publishable key. Risk: anyone who finds the URL can call a paid model. Mitigations built in: 40 messages, 1000 characters each, 30 KB body, 6 model turns per request. No per-user rate limit yet.
7. **Server does not enforce the budget.** Total is computed deterministically (price + shipping) and stored. This is what lets the receipt catch an overstep.
8. **Unmentioned rule = null.** The return flag is `true` or null, never false. Payment is fixed to "Demo PayPal" and merchant to Northwind by the server, not the model.
9. **Offers are echoed by the phone screen** (product, shipping method, summary, shown time) so the order step can write the proposal record. The function re-reads price, shipping and delivery from the database; only the summary text and shipping choice come from the echo.
10. **Known limit:** appending to the hash chain reads the latest hash then inserts, so two sessions at the same instant could fork the chain. Fine for one presenter; not for production.
11. **Seeded rows** (`seed_dashboard_demo.sql`, not yet run) use filler for AR-2026-0041 and AR-2026-0043 customers/agents that I invented.

## 3. Not verified
The function has not been run against the real model (no key in this environment). The hero test on Vercel is the acceptance check.
