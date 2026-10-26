-- =====================================================================
-- 002: store display columns on products (add-only, per PRD rule "add, never subtract")
-- Run AFTER 001_schema_v0.2.sql. Safe to re-run.
--   brand       text shown on the product card
--   featured    true for the hero product (Ridgeline)
--   sort_order  fixed display order inside the store
-- =====================================================================
alter table products
  add column if not exists brand text,
  add column if not exists featured boolean not null default false,
  add column if not exists sort_order int not null default 0;
