-- =====================================================================
-- 007: session log for the shopper agent (Amendment 3, proposed).
-- One row per step, in the order written. The seven steps are the ones in the shopper-agent spec:
--   Verified agent detected, Session started, Intent captured, Intent hash recorded,
--   Grant captured, Order received, Receipt issued.
-- 'detail' holds fields only (never chat text). 'simulated' marks the verified-agent step.
-- Append-only like the other records. Writes come only from edge functions using the service role.
-- Dashboard may read it (demo read policy, same terms as 005). Safe to re-run.
-- =====================================================================
create table if not exists session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  seq bigint generated always as identity,
  step text not null check (step in (
    'verified_agent_detected', 'session_started', 'intent_captured', 'intent_hash_recorded',
    'grant_captured', 'order_received', 'receipt_issued')),
  detail jsonb not null default '{}',
  simulated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists session_events_session_idx on session_events (session_id, seq);

drop trigger if exists session_events_no_change on session_events;
create trigger session_events_no_change before update or delete on session_events
  for each row execute function block_record_mutation();
drop trigger if exists session_events_no_truncate on session_events;
create trigger session_events_no_truncate before truncate on session_events
  for each statement execute function block_record_mutation();

alter table session_events enable row level security;
drop policy if exists "demo read session_events" on session_events;
create policy "demo read session_events" on session_events for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on session_events from anon, authenticated;

-- demo_reset must also clear the log, before the sessions it points at.
create or replace function demo_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.demo_reset', 'on', true);
  delete from session_events where true;
  delete from dispute_events where true;
  delete from disputes where true;
  delete from receipts where true;
  delete from actions where true;
  delete from proposals where true;
  delete from grants where true;
  delete from sessions where true;
  perform setval('chain_seq_gen', 1, false);
  perform set_config('app.demo_reset', 'off', true);
end;
$$;

revoke all on function demo_reset() from public, anon, authenticated;
grant execute on function demo_reset() to service_role;
