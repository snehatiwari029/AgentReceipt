-- 010: "Reach out for pilot" form on the public site. Additive: touches no demo table, demo_reset() does not clear it.
-- Visitors (anon) can INSERT one row and nothing else: no read, update or delete from the browser.
-- Read the entries in Supabase > Table Editor (service role / dashboard only).
create table if not exists pilot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  work_email text not null check (char_length(work_email) between 3 and 200 and work_email like '%_@_%._%'),
  company text not null check (char_length(company) between 1 and 160),
  store_url text check (store_url is null or char_length(store_url) <= 300),
  interest text not null check (char_length(interest) between 1 and 80),
  message text check (message is null or char_length(message) <= 2000)
);

alter table pilot_requests enable row level security;
revoke all on pilot_requests from anon, authenticated;
grant insert on pilot_requests to anon, authenticated;
drop policy if exists "visitors can submit a pilot request" on pilot_requests;
create policy "visitors can submit a pilot request" on pilot_requests for insert to anon, authenticated with check (true);
