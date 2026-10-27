# AgentReceipt PRD Amendment 4 (26 Oct 2026): PayPal Sandbox checkout (PLANNED, not built)

Amends PRD v0.2 + Amendments 1 to 3. Status: approved by Sneha in principle; build is scheduled AFTER the receipt function.

## 1. Scope change (deliberate)
- The brief says "payments simulated" and lists "real payments" as out of scope. This amendment adds **PayPal Sandbox** (PayPal's test environment, test money only) as a tool layer.
- Wording rule: UI, README and pitch say "PayPal Sandbox, test money". Never "real payment". No live PayPal credentials, ever.
- Muse Spark prompts and tools, the grant, and the auditor rules do not change. The only shopper-agent change is that its order step calls the new function.

## 2. Flow
1. Customer taps "Looks right" (grant written, unchanged).
2. Customer says "Order it". The server records the proposal and the checkout action with the total it computes itself (hero $509.95, Scenario B $489.83). Muse is not involved in the amount.
3. New edge function `paypal-checkout` creates a Sandbox order through the PayPal REST Orders API for that recorded total (amount read from the database, never from the browser) and returns the approve link.
4. The phone opens the approve link. The customer approves in Sandbox as a test buyer, and PayPal returns them to `/chat`.
5. `/chat` asks `paypal-checkout` to capture. The function stores PayPal order ID, transaction (capture) ID, status and a sandbox flag in a new append-only table `payment_events`.
6. The receipt function (built before this) shows those fields on the receipt. The dashboard receipt detail shows order ID, transaction ID, status and a "Sandbox" label.

## 3. Rules
- Secrets `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` exist only as Supabase edge-function secrets. Not in the frontend, `VITE_` variables, Vercel or the repo. A test will enforce it.
- No local MCP server (`@paypal/mcp`) and no OpenAI Agents SDK example code. Plain REST calls only.
- A successful capture never overrides a mismatch. The auditor still compares the captured total with the grant ($500 cap) and the returns terms.
- **Capture failure or cancel:** the order and receipt are still written, with payment status `failed` or `cancelled` and PayPal's error shown. There is no fallback to a simulated "Demo PayPal" success.

## 4. Decisions made with Sneha
1. Build order: receipt function first, PayPal after (the PayPal details live on the receipt).
2. Failed payment keeps the order and shows the failure on the receipt.
3. Seeded order 12322 stays as pre-built demo data with no PayPal IDs. The Sandbox IDs appear on the receipt created by the live hero run (new order number). The acceptance check "real PayPal transaction ID" therefore applies to that live receipt, not to the seeded 12322 row.

## 5. What Sneha needs to provide before the build
- A PayPal developer account with a Sandbox **REST app** (Client ID and Secret) and a Sandbox **personal (buyer)** test account to approve with.
- Both secrets entered by her in Supabase > Edge Functions > Secrets.

## 6. Known limits
- This environment cannot reach PayPal or Supabase, so Sandbox order IDs can only come from a live run on Vercel. Test results are reported only if actually seen.
