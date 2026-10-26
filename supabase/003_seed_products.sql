-- =====================================================================
-- 003: seed the 7 Northwind Outfitters products (demo fixture, not the product).
-- Run AFTER 001 and 002. Run ONCE: running it twice would insert duplicates.
--
-- Values that come from your spec: names, sizes, colours, prices, returns terms,
-- Ridgeline = featured + NORTHRIDGE, the display order.
--
-- Values I chose as PLACEHOLDERS (change them before relying on them):
--   * the 6 other brand names (invented, not real brands)
--   * shipping costs and delivery days, assuming a fixed demo date of Mon 26 Oct 2026
--     (so "Friday" = 4 days away): Ridgeline standard = 5 days, so Friday forces the
--     $60 expedited option (2 days). Powderline standard = 3 days, so it meets Friday.
--   * the Ridgeline marketing blurb says "Easy returns" while its formal terms say
--     final sale. That is the hero's semantic trap from Amendment 1. Delete the
--     "Easy returns." words if you do not want the trap visible yet.
--   * image_url is left empty until Muse Image product photos exist.
-- =====================================================================
insert into products (
  merchant_id, name, brand, category, size_cm, colour, price_cents,
  formal_returns, formal_terms_text, marketing_blurb,
  standard_shipping_cents, standard_delivery_days,
  expedited_shipping_cents, expedited_delivery_days,
  featured, sort_order
)
select m.id, v.name, v.brand, v.category, v.size_cm, v.colour, v.price_cents,
       v.formal_returns, v.formal_terms_text, v.marketing_blurb,
       v.standard_shipping_cents, v.standard_delivery_days,
       v.expedited_shipping_cents, v.expedited_delivery_days,
       v.featured, v.sort_order
from merchants m
cross join (values
  ('Ridgeline Freestyle Snowboard', 'NORTHRIDGE', 'snowboard', 155, 'Blue', 45900,
   'final_sale', 'Final sale. This item cannot be returned or exchanged.',
   'Easy returns. A playful, forgiving twin-tip board built for the park.',
   0, 5, 6000, 2, true, 1),
  ('Powderline All-Mountain Snowboard', 'HALDEN', 'snowboard', 162, 'Black/Red', 48900,
   'free', 'Free returns (30-day): return within 30 days of delivery for a full refund. Return shipping is on us.',
   'A stable all-mountain board that handles groomers and fresh snow alike.',
   0, 3, 4500, 1, false, 2),
  ('Glacier Cruiser Snowboard', 'COLDWATER', 'snowboard', 148, 'Grey', 42900,
   'free', 'Free returns (30-day): return within 30 days of delivery for a full refund. Return shipping is on us.',
   'A short, easy-turning cruiser for relaxed carving days.',
   1500, 4, 4000, 2, false, 3),
  ('Summit Powder Snowboard', 'PEAKFORGE', 'snowboard', 165, 'White', 54900,
   'final_sale', 'Final sale. This item cannot be returned or exchanged.',
   'A wide, floaty board designed for deep powder days.',
   0, 6, 5500, 3, false, 4),
  ('Alpine Pro Skis', 'ARCLINE', 'ski', 170, 'Red', 64900,
   'free', 'Free returns (30-day): return within 30 days of delivery for a full refund. Return shipping is on us.',
   'Precise, lively all-mountain skis for confident intermediate and advanced skiers.',
   0, 5, 7000, 2, false, 5),
  ('Trailblazer Skis', 'KESTREL', 'ski', 160, 'Blue', 59900,
   'final_sale', 'Final sale. This item cannot be returned or exchanged.',
   'Versatile all-day skis with a smooth, damp feel on firm snow.',
   0, 7, 6500, 3, false, 6),
  ('Backcountry Skis', 'WILDERNEST', 'ski', 178, 'Black', 72900,
   'free', 'Free returns (30-day): return within 30 days of delivery for a full refund. Return shipping is on us.',
   'Lightweight touring skis for long climbs and open descents.',
   0, 5, 8000, 2, false, 7)
) as v(name, brand, category, size_cm, colour, price_cents,
       formal_returns, formal_terms_text, marketing_blurb,
       standard_shipping_cents, standard_delivery_days,
       expedited_shipping_cents, expedited_delivery_days,
       featured, sort_order)
where m.name = 'Northwind Outfitters';
