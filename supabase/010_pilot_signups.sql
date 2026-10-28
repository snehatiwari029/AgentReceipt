-- 010: pilot / stay-in-the-loop requests from the B2B site (/). Already applied to the AgentReceipt project;
-- kept here so the repo matches the database. Safe to re-run.
-- The browser holds only the publishable key: anon may INSERT one row, and cannot SELECT, UPDATE or DELETE.

create table if not exists pilot_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  work_email text not null,
  company text not null,
  store_url text,
  interest text not null check (interest in ('pilot', 'stay_in_loop')),
  message text,
  source text not null default 'b2b_site',
  created_at timestamptz not null default now()
);

alter table pilot_signups enable row level security;

drop policy if exists "pilot_signups anon insert only" on pilot_signups;
create policy "pilot_signups anon insert only" on pilot_signups for insert to anon with check (true);
