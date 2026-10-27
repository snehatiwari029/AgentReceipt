# PRD Amendment 7: payment terminology and options (Oct 26)
- Visa and Mastercard are card networks, not checkout methods. "Visa checkout" / "Mastercard checkout" appear nowhere.
- Stored: `payment_method_ref = "Demo Checkout"` (grants column), `payment_method_detail` = exact choice, `payment_simulated = true`.
  Detail and flag are sealed in `grant_json` and in the checkout action's `detail`. NO new grants columns: the dashboard reads rows with `select *`, so a new column would change the recomputed hash of every existing record and break verification.
- Order card: "Paid with Demo Checkout — <choice>. Simulated, no real payment."
- Phone: Muse asks once ("Which payment should I use for this demo checkout? No real charge will be made."), with buttons in order: Demo Visa card ••4242 (Suggested), Mastercard, Stripe Checkout, PayPal, plus free text. Never asked again once told. Nothing is ever rejected.
- Deviation: text with 5 or more digits (a pasted card number) is accepted but recorded only as "Card (number not stored)". The number is never kept.
- Seed regenerated with Demo Checkout — PayPal. Re-run `supabase/seed_dashboard_demo.sql` to pick it up (this wipes the live test session).
- Auditor (receipt function, next): payment check = "payment method present and recorded as demo checkout". It never fails on which payment, and never changes Budget or Returns results.
