-- 012: Listing Optimizer (Optimization for Agents). Run ONCE after 011. Additive only: touches no existing table.
-- Written only by the `optimizer` edge function (service role). The browser can read, never write: the dashboard's
-- Approve / Reject / Approve All / Scan Now buttons call the function, which records the decision.
-- Nothing here changes a listing. A suggestion's merchant_values are what the merchant typed into a "To be filled by
-- merchant" field; they are merchant data, never model output, and are not copied into products.
-- Demo read access is open, like 005 (fictional, non-public demo). Replace with real merchant auth before anything else.

create table if not exists optimizer_scans (
  id uuid primary key,
  merchant_id uuid not null references merchants(id),
  scanned_at timestamptz not null,
  listings_scanned int not null check (listings_scanned >= 0),
  catalogue_source text not null,
  markup jsonb not null,                       -- what the Schema.org check fetched: url, HTTP status, bytes, what was found
  spark jsonb not null,                        -- listings per semantic source, e.g. {"muse-spark": 9} or {"rules-fallback": 9}
  aggregate_mismatch_counts jsonb not null,    -- this merchant's Order check mismatches by field, counted live at scan time
  results jsonb not null,                      -- per listing: pillar 1-5 results with evidence, semantic source, order history
  created_at timestamptz not null default now()
);
create index if not exists optimizer_scans_merchant on optimizer_scans (merchant_id, scanned_at desc);

create table if not exists optimizer_suggestions (
  id uuid primary key,
  merchant_id uuid not null references merchants(id),
  product_id uuid not null references products(id),
  flag_key text not null,                      -- stable per listing, e.g. p2.returns; re-scans match on it
  pillar int not null check (pillar between 1 and 5),
  flag_type text not null check (flag_type in ('missing', 'contradiction')),
  subtype text not null,
  category int not null check (category between 1 and 5),   -- Section 8 priority category
  severity text not null check (severity in ('violation', 'attention', 'lower')),
  title text not null,
  evidence jsonb not null,
  impact text not null,
  suggested_fix text not null,
  merchant_fix_text text,                      -- the merchant's edit of the suggested fix, if any
  value_fields text[] not null default '{}',   -- "To be filled by merchant" fields
  merchant_values jsonb not null default '{}', -- what the merchant typed; never filled by the model
  mismatch_fields text[] not null default '{}',
  caused_mismatch_count int not null default 0 check (caused_mismatch_count >= 0),
  source text not null check (source in ('deterministic', 'muse-spark', 'rules-fallback')),
  status text not null check (status in ('pending', 'approved', 'rejected', 'resolved', 'still_flagged')),
  decided_by text,
  decided_at timestamptz,
  first_scan_id uuid not null references optimizer_scans(id),
  last_scan_id uuid not null references optimizer_scans(id),
  rescan_result text,
  rescan_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, product_id, flag_key),
  check (status <> 'approved' or (decided_by is not null and decided_at is not null))
);
create index if not exists optimizer_suggestions_merchant on optimizer_suggestions (merchant_id);

alter table optimizer_scans enable row level security;
alter table optimizer_suggestions enable row level security;
revoke all on optimizer_scans, optimizer_suggestions from anon, authenticated;
grant select on optimizer_scans, optimizer_suggestions to anon, authenticated;
drop policy if exists "demo read optimizer_scans" on optimizer_scans;
create policy "demo read optimizer_scans" on optimizer_scans for select to anon, authenticated using (true);
drop policy if exists "demo read optimizer_suggestions" on optimizer_suggestions;
create policy "demo read optimizer_suggestions" on optimizer_suggestions for select to anon, authenticated using (true);
