-- =====================================================================
-- 005: read-only access for the merchant dashboard (demo).
-- The dashboard sign-in is a demo button with no real account, so these tables are readable
-- by anyone who has the site URL. That is acceptable only because this is a fictional,
-- non-public demo. Writes stay blocked for the browser: INSERT / UPDATE / DELETE are still
-- revoked from anon and authenticated (001) and the append-only triggers still apply.
-- Replace with real merchant auth before anything beyond the demo.
-- Run after 001. Safe to re-run.
-- =====================================================================
do $$
declare
  t text;
begin
  foreach t in array array['grants', 'proposals', 'actions', 'receipts', 'disputes', 'dispute_events']
  loop
    execute format('drop policy if exists %I on %I', 'demo read ' || t, t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', 'demo read ' || t, t);
  end loop;
end;
$$;

-- The chain_entries view also had write privileges for anon; remove them.
revoke insert, update, delete, truncate on chain_entries from anon, authenticated;
