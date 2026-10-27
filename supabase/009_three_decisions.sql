-- 009: the three decisions. Run ONCE in Supabase > SQL Editor, after 008, on an EMPTY receipts table
-- (run `select demo_reset();` first, then this, then the new seed_dashboard_demo.sql).
--
--   pass              0 problems, hashes verify, all components present.        Merchant: proceed, ship.
--   review_required   >= 1 field mismatch, hashes verify, all components present. "I trust the record, I don't trust the match."
--   hold_suspicion    hash fails, a component is missing, grant expired before the action, or the agent is unverified.
--                     "I don't trust the record itself yet."
--
-- A Review Required order is NOT a dispute. Disputes are a separate, later thing.

alter table receipts drop constraint if exists receipts_decision_check;
alter table receipts drop constraint if exists receipts_pass_guard;
alter table receipts drop constraint if exists receipts_hold_guard;
alter table receipts drop constraint if exists receipts_review_guard;

alter table receipts add constraint receipts_decision_check check (decision in ('pass', 'review_required', 'hold_suspicion'));
alter table receipts add constraint receipts_pass_guard
  check (decision is distinct from 'pass' or (problems_found = 0 and cardinality(missing_components) = 0));
alter table receipts add constraint receipts_review_required_guard
  check (decision is distinct from 'review_required'
         or (problems_found >= 1 and cardinality(missing_components) = 0 and coalesce(audit ->> 'tamper_failed', 'false') = 'false'));
alter table receipts add constraint receipts_hold_suspicion_guard
  check (decision is distinct from 'hold_suspicion'
         or cardinality(missing_components) > 0 or (audit ->> 'tamper_failed') = 'true' or jsonb_array_length(audit -> 'suspicion_reasons') > 0);

-- Orders requiring attention = Review Required + Hold for Suspicion. No dispute needed.
-- Also counted, as Hold for Suspicion: an order that arrived but has no receipt (the auditor did not run),
-- and an unverified agent with no session record (a gap).
create or replace view orders_requiring_attention with (security_invoker = true) as
  select r.id as receipt_id, r.receipt_ref, r.order_ref, r.decision, r.problems_found, r.missing_components,
         r.fulfillment, r.sealed_at as flagged_at
  from receipts r
  where r.decision in ('review_required', 'hold_suspicion')
  union all
  select null::uuid, null::text, null::text, 'hold_suspicion'::text, 0, array['receipt record']::text[], null::text, e.created_at
  from session_events e
  where e.step = 'order_received'
    and not exists (select 1 from grants g join receipts rc on rc.grant_id = g.id where g.session_id = e.session_id)
  union all
  select null::uuid, null::text, null::text, 'hold_suspicion'::text, 0, array['unverified agent, no session record']::text[], null::text, s.opened_at
  from sessions s
  where s.agent_verified = false
    and not exists (select 1 from grants g where g.session_id = s.id);

grant select on orders_requiring_attention to anon, authenticated;
