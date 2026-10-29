-- 013: Listing Optimizer correction. Run ONCE after 012, BEFORE deploying the corrected optimizer function.
-- Touches only the optimizer's own two tables. No product, order, receipt or grant is read or changed.
--
-- 1. The optimizer is a five-pillar guideline only. It no longer links a flag to Order check mismatches or orders,
--    so the columns that stored that linkage are dropped, and the order history kept inside past scan results is removed.
-- 2. The title check now checks the title as the store displays it (brand line, then name), not the name column alone.
--    Every earlier p2.title suggestion came from the wrong check, not from a listing problem, so it is deleted. Leaving it
--    would make the next re-scan mark it "Resolved on re-scan", which would falsely say the merchant fixed something.
--    Only pending suggestions are deleted: a title suggestion the merchant already decided on is kept.

alter table optimizer_suggestions drop column if exists caused_mismatch_count;
alter table optimizer_suggestions drop column if exists mismatch_fields;
alter table optimizer_scans drop column if exists aggregate_mismatch_counts;

update optimizer_scans
set results = (select coalesce(jsonb_agg(x - 'order_history'), '[]'::jsonb) from jsonb_array_elements(results) x)
where exists (select 1 from jsonb_array_elements(results) x where x ? 'order_history');

delete from optimizer_suggestions where flag_key = 'p2.title' and status = 'pending';
