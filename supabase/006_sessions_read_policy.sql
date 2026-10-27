-- =====================================================================
-- 006: read-only access to sessions for the merchant dashboard (demo).
-- The Agent orders page lists sessions where no receipt exists (the "gap" rows).
-- Same terms as 005: demo only, no real sign-in, no writes from the browser. Safe to re-run.
-- =====================================================================
drop policy if exists "demo read sessions" on sessions;
create policy "demo read sessions" on sessions for select to anon, authenticated using (true);
