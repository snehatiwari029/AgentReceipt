# AgentReceipt

Merchant-side product that binds user intent, a structured grant, and the agent's action into a hash-chained receipt, then checks the action against the grant and the merchant's terms. Built for the Meta Global AI Developer Hackathon (submission 4 Nov 2026, 9pm ET). Simulated checkout only.

Source of truth: the PRD v0.1 plus `PRD-Amendment-1.md` (grant fields, not a chat sentence).

## What exists so far

- **Store view** (this build): the Northwind Outfitters demo store, light retail theme. It reads the `products` table from Supabase. There is no fallback data: an empty table shows an empty state, a failed read shows the database error.
- Dashboard (dark theme), customer phone chat, agent loop, receipts: not built yet. They will be separate views reached from a demo entry page, never from the store header.

## Run it

1. In Supabase (project AgentReceipt) > SQL Editor, run in order, once each:
   1. `supabase/001_schema_v0.2.sql`
   2. `supabase/002_products_store_columns.sql`
   3. `supabase/003_seed_products.sql` (the 9 CSV products; read its header for what I assumed)
   4. `supabase/004_product_images_bucket.sql` (public read bucket for photos)
2. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key. Never put a service_role key or the Meta API key in a `VITE_` variable.
3. `npm install`, then `npm run dev`.

## Checks

- `npm test` runs render tests against a stubbed Supabase client (loading, empty, error, 7 products in order, cart, details dialog, light theme, no links out of the store).
- `npm run build` typechecks and builds.

## Product photos (one-time import)

The 9 PNGs live in a Google Drive folder. `supabase/functions/import-product-images` copies them into the
`product-images` Storage bucket and sets `image_url`, `image_id` (storage path) and `image_hash`
(`sha256:` of the PNG bytes) on each product. The Drive link is never stored as an image URL.
It runs inside Supabase with a one-time `IMPORT_SECRET` you choose; no service key is ever pasted anywhere.
