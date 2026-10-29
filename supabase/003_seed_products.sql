-- =====================================================================
-- 003: seed the 9 Northwind Outfitters products from northwind-catalog-demo-store_1.csv
-- Run AFTER 001 and 002. Run ONCE: running it twice would insert duplicates.
--
-- Copied from the CSV exactly: brand, product name, size, gender, style, details,
-- MRP, discount %, sale price, returns wording, image filename, CSV row order.
--
-- Mapped / ASSUMED by me (change before relying on them).
-- Confirmed by you: the two final-sale boards (Burton, Nitro) have Standard 5 days, Expedited $60 available.
-- Still assumed: expedited delivery = 2 days; standard price = free; 3 days on the free-shipping rows.
-- Mapped / ASSUMED:
--   * category: "Snowboard" in the name -> snowboard, "Skis" -> ski.
--   * returns: "Final Sale" -> final_sale; "Free returns within 30 days" -> free.
--     formal_terms_text keeps the CSV wording verbatim.
--   * standard_shipping_cents = 0 on every row. The CSV says "Standard 5 days" with no
--     price on the two final-sale boards; I assumed free.
--   * delivery days: Burton and Nitro = 5 days (CSV). The seven "Free standard shipping"
--     rows have no day count, so I assumed 3 days.
--   * expedited: Burton and Nitro = $60 (CSV) with an ASSUMED 2-day delivery. Other rows: none.
--   * featured: Burton Spellbinder (proposed hero). It only drives the "Featured" badge.
--   * colour: Burton Spellbinder = 'Serpent' (confirmed live colour; the first draft of this file said 'Blue/Black', which
--     seed_dashboard_demo.sql:38 overwrote). The other 8 are empty: not in the CSV.
--   * image_url / image_id / image_hash stay empty until the image import runs.
-- =====================================================================
insert into products (
  merchant_id, name, brand, category, size_cm, colour, gender, style, details,
  mrp_cents, discount_pct, price_cents,
  formal_returns, formal_terms_text,
  standard_shipping_cents, standard_delivery_days,
  expedited_shipping_cents, expedited_delivery_days,
  image_file, featured, sort_order
)
select m.id, v.name, v.brand, v.category, v.size_cm, v.colour, v.gender, v.style, v.details,
       v.mrp_cents, v.discount_pct, v.price_cents,
       v.formal_returns, v.formal_terms_text,
       v.standard_shipping_cents, v.standard_delivery_days,
       v.expedited_shipping_cents, v.expedited_delivery_days,
       v.image_file, v.featured, v.sort_order
from merchants m
cross join (values
  ('Spellbinder Snowboard 2026/2027', 'Burton', 'snowboard', 156, 'Serpent', 'Unisex', 'All-mountain / Freestyle',
   'Directional Twin, PurePop Camber, Soft flex, Super Fly 800G Core, The Channel',
   44995, 0, 44995, 'final_sale', 'Final Sale', 0, 5, 6000, 2, 'burton-spellbinder.png', true, 1),
  ('T. Rice Orca Snowboard 2025/2026', 'Lib Tech', 'snowboard', 156, null, 'Unisex', 'All-mountain',
   'Directional, Camber/Rocker, Stiff flex, Magne-Traction, Horsepower Construction',
   70000, 30, 48983, 'free', 'Free returns within 30 days', 0, 3, null, null, 'lib-tech-orca.png', false, 2),
  ('Outerspace Living Snowboard 2025/2026', 'Capita', 'snowboard', 156, null, 'Unisex', 'Freestyle / All-mountain',
   'True Twin, Resort V3 Profile, Camber/Rocker, Medium flex, Multizone Dual Core',
   52995, 30, 37083, 'free', 'Free returns within 30 days', 0, 3, null, null, 'capita-outerspace-living.png', false, 3),
  ('Assassin Snowboard 2025/2026', 'Salomon', 'snowboard', 156, null, 'Unisex', 'All-mountain / Freestyle',
   'Directional Twin, Rock Out Camber, Medium flex, Popster Eco Booster',
   64995, 30, 45483, 'free', 'Free returns within 30 days', 0, 3, null, null, 'salomon-assassin.png', false, 4),
  ('Airheart 2.0 Snowboard Women''s 2025/2026', 'Jones', 'snowboard', 152, null, 'Women''s', 'All-mountain',
   'Directional Twin, Camber, Stiff flex, 3D Contour Base, Bio-Resin',
   62995, 30, 44083, 'free', 'Free returns within 30 days', 0, 3, null, null, 'jones-airheart.png', false, 5),
  ('Alternator Snowboard 2026/2027', 'Nitro', 'snowboard', 159, null, 'Unisex', 'All-mountain / Freestyle',
   'Directional, Trüe Camber, Stiff flex, Mid-Wide, Reflex Core Profile, Sintered Speed Formula II base',
   59995, 0, 59995, 'final_sale', 'Final Sale', 0, 5, 6000, 2, 'nitro-alternator.png', false, 6),
  ('Bent 85 Skis with Bindings 2026/2027', 'Atomic', 'ski', 170, null, 'Unisex', 'All-mountain',
   '85mm waist, All Mountain Rocker, Includes M 10 GW bindings',
   59995, 0, 59995, 'free', 'Free returns within 30 days', 0, 3, null, null, 'atomic-bent-85.png', false, 7),
  ('QST 92 Skis with Bindings 2025/2026', 'Salomon', 'ski', 152, null, 'Unisex', 'All-mountain',
   '92mm waist, Tip and Tail Rocker, Includes M11 GW bindings, Iceberg Green/Dark Grey',
   71995, 0, 71995, 'free', 'Free returns within 30 days', 0, 3, null, null, 'salomon-qst-92.png', false, 8),
  ('Sender Soul 92 Skis with Bindings 2025/2026', 'Rossignol', 'ski', 166, null, 'Unisex', 'All-mountain',
   '92mm waist, Tip Rocker, Full sidewall, Includes Look X11 bindings',
   74995, 0, 74995, 'free', 'Free returns within 30 days', 0, 3, null, null, 'rossignol-sender-soul-92.png', false, 9)
) as v(name, brand, category, size_cm, colour, gender, style, details,
       mrp_cents, discount_pct, price_cents,
       formal_returns, formal_terms_text,
       standard_shipping_cents, standard_delivery_days,
       expedited_shipping_cents, expedited_delivery_days,
       image_file, featured, sort_order)
where m.name = 'Northwind Outfitters';

-- Added after the first run (applied directly in Supabase, Amendment 2 section 6.6):
-- update products set marketing_blurb = 'Easy returns. Directional twin all-mountain and freestyle board with a soft flex.' where image_file = 'burton-spellbinder.png';
