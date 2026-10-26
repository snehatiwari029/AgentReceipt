# AgentReceipt PRD Amendment 2 (26 Oct 2026)

Amends PRD v0.2 + Amendment 1. Where this document and Amendment 1 disagree, this one wins. Everything in Amendment 1 not mentioned here is unchanged.

## 1. What changed and why

| # | Change | Why |
|---|---|---|
| 1 | Demo store catalog is now **9 products** (from the CSV `northwind-catalog-demo-store_1.csv`), replacing the earlier 7 (Ridgeline, Powderline, etc.). | Sneha supplied real catalog data and product photos. |
| 2 | **Hero (Scenario A) product is Burton Spellbinder Snowboard 2026/2027**, 156cm, Blue/Black, $449.95, Final Sale. | Replaces Ridgeline. |
| 3 | **Scenario B product is Lib Tech T. Rice Orca Snowboard 2025/2026**, 156cm, $489.83, Free returns within 30 days. | Replaces Powderline. |
| 4 | Build **without Lovable**: standalone React + Tailwind app, Supabase backend, Supabase edge functions. | Sneha's instruction. Replaces the "one Lovable app" line in the project brief. |
| 5 | Product photos are stored in Supabase Storage with `image_id` (storage path) and `image_hash` (SHA-256 of the file). | See section 5. |

## 2. Scenario A (hero): agent oversteps

**Customer instruction (plain words):** a blue snowboard under $500, returnable, delivered by Friday. (Shipping method is not a grant field here, so it is not checked; see below.)

**Grant (fields):** budget cap $500 (single Budget check; `amount_max` and `budget_cap` still collapse into one), size 150-165cm, colour preference blue, delivery by Friday 30 Oct 2026, returnable = true, Demo PayPal, merchant Northwind Outfitters. Shipping method / max cost: not specified, no check.

**Proposal record** (what the customer was shown, stored separately from chat and grant): item price **$449.95**, returns summary **"Easy returns"**, delivery **Friday**. Not shown: the $509.95 total and final sale.

**Action:** Burton Spellbinder 156cm Blue/Black, $449.95 + $60.00 expedited = **$509.95**, expedited delivery (Wed 28 Oct), formal terms **Final Sale**, Demo PayPal. `agent_believed_terms`: "Easy returns".

**Result: exactly 2 problems.**
1. Budget: cap $500.00 vs actual $509.95, **over by $9.95**. Cause: agent treated the cap as item-only. The $9.95 overage is deliberate and must not be "fixed" by raising the cap.
2. Returns: grant requires returnable vs formal terms Final Sale. Cause: agent summary "Easy returns" misrepresented the formal terms.

Met: size 156 in range, colour (Blue/Black contains blue), delivery by Friday (expedited arrives Wed 28 Oct), merchant allowlist, payment method. Not checked: shipping method / max cost (not specified).

Merchant outcome: concede. `recommendation = concede`, `problems_found = 2`.

**Store seed data needed for the trap (Amendment 1 section "Trap data" still applies):**
- Burton standard delivery is 5 days (Sat 31 Oct, misses Friday); expedited is $60 and 2 days (Wed 28 Oct). This is why a goal-driven agent picks expedited.
- Burton product page blurb says "Easy returns" while the formal terms say Final Sale. (Seed change applied with this amendment, see section 6.)

## 3. Scenario B: agent complies, customer disputes anyway

**Grant (fields):** budget cap $500, size 150-165cm, delivery by Friday 30 Oct 2026, returnable = true, Demo PayPal, merchant Northwind Outfitters, **colour preference not specified (null)**.

**Proposal record:** total **$489.83**, returns "Free returns (30-day)", delivery by Friday.

**Action:** Lib Tech T. Rice Orca 156cm, **$489.83 total**, standard shipping (free), no expedited, standard delivery 3 days (Thu 29 Oct) meets Friday, formal terms "Free returns within 30 days". `agent_believed_terms`: "Free returns (30-day)".

**Result: 0 problems.** Budget pass ($489.83 vs $500), size pass, delivery pass, returnability pass, merchant and payment pass. **Colour: "not specified, no check"** (grey, not pass or fail, and it does not block "represent"; only a missing record component can force "review").

**Dispute:** reason "Claimed agent overstep" (wording still open for Sneha to confirm) is disproved by the receipt. Merchant represents and wins. `recommendation = represent`, `problems_found = 0`.

## 4. Catalog (Supabase `products`, sort order = CSV order)

| # | Brand | Product | Size | Sale price | Returns | Shipping |
|---|---|---|---|---|---|---|
| 1 | Burton | Spellbinder Snowboard 2026/2027 (Featured, hero) | 156cm | $449.95 | Final Sale | Standard 5 days, Expedited $60 |
| 2 | Lib Tech | T. Rice Orca Snowboard 2025/2026 (Scenario B) | 156cm | $489.83 | Free returns 30 days | Free standard |
| 3 | Capita | Outerspace Living Snowboard 2025/2026 | 156cm | $370.83 | Free returns 30 days | Free standard |
| 4 | Salomon | Assassin Snowboard 2025/2026 | 156cm | $454.83 | Free returns 30 days | Free standard |
| 5 | Jones | Airheart 2.0 Snowboard Women's 2025/2026 | 152cm | $440.83 | Free returns 30 days | Free standard |
| 6 | Nitro | Alternator Snowboard 2026/2027 | 159cm | $599.95 | Final Sale | Standard 5 days, Expedited $60 |
| 7 | Atomic | Bent 85 Skis with Bindings 2026/2027 | 170cm | $599.95 | Free returns 30 days | Free standard |
| 8 | Salomon | QST 92 Skis with Bindings 2025/2026 | 152cm | $719.95 | Free returns 30 days | Free standard |
| 9 | Rossignol | Sender Soul 92 Skis with Bindings 2025/2026 | 166cm | $749.95 | Free returns 30 days | Free standard |

Colour is stored only for Burton (Blue/Black). The other eight have no colour because the CSV has none; a colour check against them is "not specified" and never fails.

## 5. Product photo provenance (log this honestly)

- The 9 product photos are **genuine REI screenshots supplied by Sneha, NOT Muse Image generations.**
- They are stored in Supabase Storage bucket `product-images` at `products/<file>.png`. Each product row has `image_url` (Supabase Storage public URL), `image_id` (the storage path) and `image_hash` (`sha256:` of the exact PNG bytes). The Drive link is not stored anywhere in the database.
- Therefore **these photos do NOT satisfy Addendum A3** (Muse Image ID + hash as image evidence), and no UI, README or pitch text may claim a Muse Image ID or Muse Image generation for them.
- `image_id` here means "our storage path" for now. If A3 evidence is needed later, add a separate `muse_image_id` field as a **P1** item. Do not repurpose `image_id`.
- Sneha confirmed this is a fictional, non-public demo store and the hackathon rules impose no restriction on the photos. Open risk to remember: the judging criterion about Muse Image producing the store is not served by these photos.

## 6. Deviations from the PRD and decisions to log

1. **Catalog 7 to 9 products, hero Ridgeline to Burton, Scenario B Powderline to Orca.** (Sneha-approved.)
2. **No Lovable.** Standalone React app, Supabase project `uhuekreoflmvxnlutsai`. (Sneha-approved.)
3. **Schema additions (migration 002):** `colour` now nullable; added `brand`, `gender`, `style`, `details`, `mrp_cents`, `discount_pct`, `featured`, `sort_order`, `image_file`, `image_id`, `image_hash` on `products`.
4. **Append-only exception:** `demo_reset()` (service role only) is the sole exception to FR-RCP-02. (From Amendment 1, restated.)
5. **Seed assumptions still unconfirmed:** expedited delivery = 2 days; free-shipping rows = 3 days; standard shipping price = $0 on the two final-sale boards; the demo clock is Mon 26 Oct 2026 (needed for "Friday 30 Oct" and the delivery checks).
6. **Burton marketing blurb "Easy returns"** added to the products table so the product page contradicts the formal Final Sale terms. This is required by the approved hero trap and is the semantic-divergence source.
7. **Image import:** a temporary edge function with no password (Supabase paused secret storage) copied the files once; it has been replaced by a stub that refuses all requests (HTTP 410). Remove it from the Supabase dashboard when convenient.
8. **Old store-seed fixtures** (the 7-product test fixtures in `src/test/App.test.tsx`) are test-only and do not describe the real catalog.

## 7. Open items

- Scenario B dispute reason wording.
- Demo clock (fixed "Demo date: Mon 26 Oct 2026").
- Dark merchant dashboard spec and the earlier dashboard demo data (342 orders, 128 agent orders, 3-order queue, tamper AR-2026-0041) still reference the old 7 products and need to be rewritten against this catalog before the dashboard is built.
- Amendment 1 receipt/tamper numbers ($519, $459) are superseded by $509.95 / $449.95 wherever the hero appears.
