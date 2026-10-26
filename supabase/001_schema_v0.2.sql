-- =====================================================================
-- AgentReceipt: Supabase schema, PRD v0.2 / Amendment 1 (26 Oct 2026)
-- Run ONCE on a fresh project: Supabase > SQL Editor > paste > Run.
-- Hashes are computed by the edge function (Day 5), not in SQL.
-- =====================================================================

-- A SHA-256 hash is stored as 'sha256:' + 64 lowercase hex characters.
create domain sha256_hash as text
  check (value ~ '^sha256:[0-9a-f]{64}$');

-- One counter that orders every chained entry (grant, proposal, action, receipt, dispute event).
create sequence chain_seq_gen;

-- ---------------------------------------------------------------------
-- merchants
-- ---------------------------------------------------------------------
create table merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text not null default 'demo' check (platform in ('shopify', 'demo')),
  created_at timestamptz not null default now()
);

insert into merchants (name) values ('Northwind Outfitters');

-- ---------------------------------------------------------------------
-- products (+ merchant terms). Seeded in the NEXT step.
-- marketing_blurb is what the product page says; formal_terms_text is what the
-- terms actually say. They are allowed to differ: that is the semantic trap.
-- Delivery is stored as day offsets from the demo date.
-- ---------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  name text not null,
  category text not null check (category in ('snowboard', 'ski')),
  size_cm int not null check (size_cm > 0),
  colour text not null,
  price_cents int not null check (price_cents > 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  image_url text,
  marketing_blurb text,
  formal_returns text not null check (formal_returns in ('free', 'fee', 'final_sale')),
  formal_terms_text text not null,
  terms_version text not null default 'v1',
  standard_shipping_cents int not null default 0 check (standard_shipping_cents >= 0),
  standard_delivery_days int not null check (standard_delivery_days >= 0),
  expedited_shipping_cents int check (expedited_shipping_cents >= 0),
  expedited_delivery_days int check (expedited_delivery_days >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- sessions (detection beat). Simulated Door 1 only in the hackathon.
-- A gap (e.g. order 14522) is a session row with detection_source 'none'
-- plus a gap_note, or simply no row; both are allowed.
-- ---------------------------------------------------------------------
create table sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  detection_source text not null
    check (detection_source in ('self_declared_simulated', 'tap', 'vi', 'detected', 'none')),
  agent_id text,
  agent_verified boolean not null default false,
  agent_verified_simulated boolean not null default true,
  gap_note text,
  opened_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- grants: the confirmed, hash-sealed authorisation (FIELDS, not a sentence).
-- NULL in any checkable column means "not specified, no check".
-- The grant seal is entry_hash. private_chat_hash is a SEPARATE fingerprint of
-- the private chat; the chat text itself is never stored here.
-- ---------------------------------------------------------------------
create table grants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  version int not null default 1 check (version >= 1),
  supersedes_grant_id uuid references grants(id),

  -- who
  shopper_ref text not null,
  agent_id text not null,
  agent_verified boolean not null,

  -- what
  merchant_id uuid references merchants(id),
  product_scope text,
  size_min_cm int check (size_min_cm > 0),
  size_max_cm int check (size_max_cm > 0),
  colour_preference text,

  -- money
  currency text not null default 'USD' check (char_length(currency) = 3),
  amount_max_cents int check (amount_max_cents > 0),
  budget_limit_cents int check (budget_limit_cents > 0),
  payment_method_ref text,

  -- shipping, delivery, returns
  shipping_method text,
  shipping_max_cost_cents int check (shipping_max_cost_cents >= 0),
  delivery_by date,
  return_policy_required boolean,

  -- validity (exact timestamps, never "24 hours")
  confirmed_at timestamptz not null,
  expires_at timestamptz not null,

  -- seals
  private_chat_hash sha256_hash not null,
  grant_json jsonb not null,
  system_metadata jsonb not null default
    '{"data_sharing_limits": "grant fields only, this purchase only", "checked": false, "priority": "P1"}',
  schema_label text not null default 'VI-aligned demo representation',
  created_at timestamptz not null default now(),

  -- hash chain
  chain_seq bigint not null unique default nextval('chain_seq_gen'),
  prev_hash sha256_hash not null,
  entry_hash sha256_hash not null unique,

  check (expires_at > confirmed_at),
  check (size_min_cm is null or size_max_cm is null or size_min_cm <= size_max_cm)
);

comment on column grants.amount_max_cents is 'Internal VI mapping: payment.amount (max). UI name: amount_max.';
comment on column grants.budget_limit_cents is 'Internal VI mapping: payment.budget (limit). UI name: budget_cap.';
comment on column grants.merchant_id is 'Internal VI mapping: mandate.checkout.allowed_merchant.';
comment on column grants.payment_method_ref is 'Internal VI mapping: payment.allowed_payee / payment.reference. Demo value: Demo PayPal.';
comment on column grants.grant_json is 'Canonical (sorted-key) JSON of the sealed customer-authorised fields. Built by the edge function from the columns above. Excludes system_metadata.';

-- ---------------------------------------------------------------------
-- proposals: what the customer was SHOWN when they confirmed the purchase.
-- Not the chat, not the grant. A null shown_total_cents means the card did
-- not show a total (hero 12322 showed only the $459 item price).
-- ---------------------------------------------------------------------
create table proposals (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references grants(id),
  product_id uuid references products(id),
  shown_item_price_cents int not null check (shown_item_price_cents >= 0),
  shown_total_cents int check (shown_total_cents >= 0),
  shown_returns_summary text not null,
  shown_delivery text not null,
  shown_at timestamptz not null,
  confirmation_ref text not null,
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),

  chain_seq bigint not null unique default nextval('chain_seq_gen'),
  prev_hash sha256_hash not null,
  entry_hash sha256_hash not null unique
);

-- ---------------------------------------------------------------------
-- actions: every agent step. agent_believed_terms is what the agent told the
-- customer the terms were (structured, e.g. {"returns": "Easy returns"}).
-- It is NOT reasoning or chain-of-thought.
-- ---------------------------------------------------------------------
create table actions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references grants(id),
  seq int not null check (seq > 0),
  type text not null
    check (type in ('view', 'terms_read', 'select', 'shipping', 'checkout', 'data_share')),
  detail jsonb not null default '{}',
  agent_believed_terms jsonb,
  image_evidence_ref jsonb,  -- P1, no check uses it; shape pending addendum A3
  created_at timestamptz not null default now(),

  chain_seq bigint not null unique default nextval('chain_seq_gen'),
  prev_hash sha256_hash not null,
  entry_hash sha256_hash not null unique,

  unique (grant_id, seq)
);

-- ---------------------------------------------------------------------
-- receipts: one per purchase. mismatch_results rows follow FR-MIS-08:
-- {field, grant, merchant_terms, actual, result (match|mismatch|unspecified),
--  cause, next_action_who, cited_fields}
-- ---------------------------------------------------------------------
create table receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_ref text not null unique,   -- e.g. AR-2026-0042
  order_ref text unique,              -- e.g. 12322
  grant_id uuid not null references grants(id),
  proposal_id uuid references proposals(id),
  merchant_id uuid not null references merchants(id),

  terms_snapshot jsonb not null,
  action_summary jsonb not null,
  mismatch_results jsonb not null default '[]',
  problems_found int not null default 0 check (problems_found >= 0),
  recommendation text not null check (recommendation in ('represent', 'concede', 'review')),
  missing_components text[] not null default '{}',
  image_evidence_ref jsonb,           -- P1
  schema_label text not null default 'VI-aligned demo representation',
  created_at timestamptz not null default now(),

  chain_seq bigint not null unique default nextval('chain_seq_gen'),
  prev_hash sha256_hash not null,
  entry_hash sha256_hash not null unique,

  -- Verdict rules from Amendment 1, enforced in the database:
  check (recommendation <> 'represent'
         or (problems_found = 0 and cardinality(missing_components) = 0)),
  check (recommendation <> 'concede' or problems_found > 0)
);

-- ---------------------------------------------------------------------
-- disputes + dispute_events (decisions are NEW chained entries, never edits)
-- ---------------------------------------------------------------------
create table disputes (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique references receipts(id),
  reason text not null,
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id),
  event_type text not null
    check (event_type in ('opened', 'recommendation', 'conceded', 'represented',
                          'pack_generated', 'outcome_won', 'outcome_lost')),
  decided_by text,
  basis jsonb not null default '{}',
  created_at timestamptz not null default now(),

  chain_seq bigint not null unique default nextval('chain_seq_gen'),
  prev_hash sha256_hash not null,
  entry_hash sha256_hash not null unique
);

-- ---------------------------------------------------------------------
-- One view that lists every chained entry in order (powers the visual chain
-- and verification).
-- ---------------------------------------------------------------------
create view chain_entries with (security_invoker = true) as
  select chain_seq, 'grant'::text as entry_type, id as entry_id, prev_hash, entry_hash, created_at from grants
  union all
  select chain_seq, 'proposal', id, prev_hash, entry_hash, created_at from proposals
  union all
  select chain_seq, 'action', id, prev_hash, entry_hash, created_at from actions
  union all
  select chain_seq, 'receipt', id, prev_hash, entry_hash, created_at from receipts
  union all
  select chain_seq, 'dispute_event', id, prev_hash, entry_hash, created_at from dispute_events;

-- ---------------------------------------------------------------------
-- APPEND-ONLY enforcement (FR-RCP-02). No UPDATE, DELETE or TRUNCATE on
-- stored records. The only exception is the demo reset flag set inside
-- demo_reset() below.
-- ---------------------------------------------------------------------
create or replace function block_record_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.demo_reset', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    elsif tg_op = 'TRUNCATE' then
      return null;
    end if;
  end if;
  raise exception 'AgentReceipt: % on % is not allowed (append-only records)', tg_op, tg_table_name;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['grants', 'proposals', 'actions', 'receipts', 'disputes', 'dispute_events']
  loop
    execute format(
      'create trigger %I before update or delete on %I for each row execute function block_record_mutation()',
      t || '_no_change', t);
    execute format(
      'create trigger %I before truncate on %I for each statement execute function block_record_mutation()',
      t || '_no_truncate', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- DEMO ONLY: reset between rehearsals (FR-ADM-01). Clears grants, receipts,
-- disputes, sessions and restarts the chain counter. Leaves merchants and
-- products alone. Service role only. Drop this function for anything
-- beyond the demo.
-- ---------------------------------------------------------------------
create or replace function demo_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.demo_reset', 'on', true);
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

-- ---------------------------------------------------------------------
-- Security: row-level security on every table. Browsers (anon / logged-in)
-- can only READ merchants and products. Everything else goes through edge
-- functions using the service role. Nothing can write from the browser.
-- ---------------------------------------------------------------------
alter table merchants enable row level security;
alter table products enable row level security;
alter table sessions enable row level security;
alter table grants enable row level security;
alter table proposals enable row level security;
alter table actions enable row level security;
alter table receipts enable row level security;
alter table disputes enable row level security;
alter table dispute_events enable row level security;

create policy "public read merchants" on merchants for select to anon, authenticated using (true);
create policy "public read products" on products for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on
  merchants, products, sessions, grants, proposals, actions, receipts, disputes, dispute_events
  from anon, authenticated;
