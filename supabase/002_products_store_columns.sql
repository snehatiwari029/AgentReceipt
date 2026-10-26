-- =====================================================================
-- 002: store + catalog columns on products (add-only, plus one relaxation)
-- Run AFTER 001_schema_v0.2.sql. Safe to re-run.
--
-- Added for the Northwind catalog CSV:
--   brand, gender, style, details   straight from the CSV
--   mrp_cents, discount_pct         list price and discount as given in the CSV
--                                   (price_cents stays the SALE price the shopper pays)
--   featured, sort_order            badge and fixed display order in the store
--   image_file                      the PNG filename from the CSV (match key for uploads)
--   image_id, image_hash            set by the image import: storage path and SHA-256 of the file
--
-- Relaxed: colour is now optional because the CSV has no colour column.
-- =====================================================================
alter table products
  alter column colour drop not null,
  add column if not exists brand text,
  add column if not exists gender text,
  add column if not exists style text,
  add column if not exists details text,
  add column if not exists mrp_cents int check (mrp_cents > 0),
  add column if not exists discount_pct int check (discount_pct between 0 and 100),
  add column if not exists featured boolean not null default false,
  add column if not exists sort_order int not null default 0,
  add column if not exists image_file text unique,
  add column if not exists image_id text,
  add column if not exists image_hash sha256_hash;
