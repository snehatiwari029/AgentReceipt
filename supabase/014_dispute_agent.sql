-- =====================================================================
-- 014: Dispute Agent (Evidence pack). Run ONCE in Supabase > SQL Editor, after 013, BEFORE deploying the
-- `disputes` edge function and before seed_dashboard_demo.sql. Additive only: no existing row, column,
-- receipt, grant, action, verdict or hash is changed. receipts.recommendation and its constraints are untouched.
--
--  1. disputes: the Layer 3 fields as filed by the processor (processor, channel, claim type, reason code /
--     condition as filed, dispute date, amount, processor reference). Nullable: a field that was not filed stays null,
--     and the pack lists it as missing. The reason code is stored as filed; no code selects or corrects it.
--  2. shipments: Layer 1 shipment / delivery record, one per order, chained. Carrier, tracking and delivery proof are
--     nullable: missing stays missing, it is never filled in.
--  3. merchant_reviews: Layer 2, what the merchant did after a Review Required / Hold for Suspicion flag. Chained,
--     append-only, one row per recorded action. recorded_at is set by the server, never by the merchant.
--  4. dispute_events: merchant tracking events (pack downloaded, investigating, outcome pending / conceded, dispute-time
--     merchant note). 'represented' is shown as "Fought (submitted to acquirer)". The old 'recommendation' value stays
--     allowed only so existing rows remain valid; nothing writes it any more.
--  5. chain_entries view and demo_reset() include the two new chained tables.
-- Browser access stays read-only (demo read policies); every write goes through the `disputes` edge function.
-- =====================================================================
begin;

alter table disputes add column if not exists merchant_id uuid references merchants(id);
alter table disputes add column if not exists processor text check (processor in ('visa', 'mastercard'));
alter table disputes add column if not exists channel text;
alter table disputes add column if not exists claim_type text
  check (claim_type in ('agent_outside_grant', 'not_authorised', 'not_as_described', 'misrepresentation', 'other'));
alter table disputes add column if not exists reason_code text;
alter table disputes add column if not exists dispute_date date;
alter table disputes add column if not exists dispute_amount_cents integer check (dispute_amount_cents is null or dispute_amount_cents >= 0);
alter table disputes add column if not exists processor_reference text;

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique references receipts(id),
  merchant_id uuid not null references merchants(id),
  shipped_on date not null,
  delivered_on date,
  carrier text,
  tracking_ref text,
  delivery_proof_ref text,
  source text not null,
  created_at timestamptz not null default now(),

  chain_seq bigint not null unique default nextval('chain_seq_gen'),
  prev_hash sha256_hash not null,
  entry_hash sha256_hash not null unique
);

create table if not exists merchant_reviews (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id),
  merchant_id uuid not null references merchants(id),
  action_taken text not null check (action_taken in (
    'called_confirmed', 'emailed_confirmed', 'investigated_cleared', 'override_documented', 'kept_on_hold', 'cancelled')),
  method text not null check (method in ('phone', 'email', 'chat', 'in_person', 'other')),
  notes text not null,
  confirmed_total text,
  confirmed_terms text,
  release_decision text not null check (release_decision in ('released', 'not_released')),
  recorded_by text not null,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),

  chain_seq bigint not null unique default nextval('chain_seq_gen'),
  prev_hash sha256_hash not null,
  entry_hash sha256_hash not null unique
);
create index if not exists merchant_reviews_receipt on merchant_reviews (receipt_id);

alter table dispute_events drop constraint if exists dispute_events_event_type_check;
alter table dispute_events add constraint dispute_events_event_type_check check (event_type in (
  'opened', 'recommendation', 'conceded', 'represented', 'pack_generated', 'outcome_won', 'outcome_lost',
  'pack_downloaded', 'investigating', 'outcome_pending', 'outcome_conceded', 'merchant_note'));

create or replace view chain_entries with (security_invoker = true) as
  select chain_seq, 'grant'::text as entry_type, id as entry_id, prev_hash, entry_hash, created_at from grants
  union all
  select chain_seq, 'proposal', id, prev_hash, entry_hash, created_at from proposals
  union all
  select chain_seq, 'action', id, prev_hash, entry_hash, created_at from actions
  union all
  select chain_seq, 'receipt', id, prev_hash, entry_hash, created_at from receipts
  union all
  select chain_seq, 'dispute_event', id, prev_hash, entry_hash, created_at from dispute_events
  union all
  select chain_seq, 'shipment', id, prev_hash, entry_hash, created_at from shipments
  union all
  select chain_seq, 'merchant_review', id, prev_hash, entry_hash, created_at from merchant_reviews;
revoke insert, update, delete, truncate on chain_entries from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['shipments', 'merchant_reviews']
  loop
    execute format('drop trigger if exists %I on %I', t || '_no_change', t);
    execute format('create trigger %I before update or delete on %I for each row execute function block_record_mutation()', t || '_no_change', t);
    execute format('drop trigger if exists %I on %I', t || '_no_truncate', t);
    execute format('create trigger %I before truncate on %I for each statement execute function block_record_mutation()', t || '_no_truncate', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'demo read ' || t, t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', 'demo read ' || t, t);
    execute format('revoke insert, update, delete, truncate on %I from anon, authenticated', t);
  end loop;
end;
$$;

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
  delete from merchant_reviews where true;
  delete from shipments where true;
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

commit;
