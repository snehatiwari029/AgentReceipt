-- 008: pre-fulfillment decision (PASS / HOLD / REVIEW) on receipts. Run ONCE in Supabase > SQL Editor, after 007.
-- Adds columns to receipts only. Existing rows keep working; run the new seed_dashboard_demo.sql afterwards
-- (select demo_reset(); first) so the seeded receipts carry the decision.
--
--   decision      pre-fulfillment: pass | hold | review   (separate from the post-dispute `recommendation`)
--   audit         the auditor's structured JSON (checks, problems, missing components, flag, footer)
--   sealed_at     exact timestamp the receipt was sealed (part of the hashed record)
--   fulfillment   proceed | held | shipped_override  (shipped_override = merchant shipped despite a HOLD, e.g. Auto-approve)
--
-- `recommendation` (represent / concede / review) is the POST-dispute verdict. It stays null until a dispute exists.

alter table receipts add column if not exists sealed_at timestamptz;
alter table receipts add column if not exists decision text check (decision in ('pass', 'hold', 'review'));
alter table receipts add column if not exists audit jsonb;
alter table receipts add column if not exists fulfillment text check (fulfillment in ('proceed', 'held', 'shipped_override'));
alter table receipts alter column recommendation drop not null;

-- Decision guards (same rules as the engine, enforced in the database too).
alter table receipts add constraint receipts_pass_guard
  check (decision is distinct from 'pass' or (problems_found = 0 and cardinality(missing_components) = 0));
alter table receipts add constraint receipts_hold_guard
  check (decision is distinct from 'hold' or (problems_found >= 1 and cardinality(missing_components) = 0));
alter table receipts add constraint receipts_review_guard
  check (decision is distinct from 'review' or cardinality(missing_components) > 0 or (audit ->> 'tamper_failed') = 'true');

-- Orders requiring attention = HOLD or REVIEW. No dispute needed. An order that was received but has no receipt
-- at all (the auditor did not run) also counts as REVIEW: we cannot trust the check yet.
create or replace view orders_requiring_attention with (security_invoker = true) as
  select r.id as receipt_id, r.receipt_ref, r.order_ref, r.decision, r.problems_found, r.missing_components,
         r.fulfillment, r.sealed_at as flagged_at
  from receipts r
  where r.decision in ('hold', 'review')
  union all
  select null::uuid, null::text, null::text, 'review'::text, 0, array['receipt record']::text[], null::text, e.created_at
  from session_events e
  where e.step = 'order_received'
    and not exists (select 1 from grants g join receipts rc on rc.grant_id = g.id where g.session_id = e.session_id);

grant select on orders_requiring_attention to anon, authenticated;
