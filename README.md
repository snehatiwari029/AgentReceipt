# AgentReceipt

Merchant-side product that binds a shopper's intent, a structured grant (VI-aligned demo representation), and the agent's action into a SHA-256 hash-chained receipt, then checks the action against the grant and the merchant's terms. Built for the Meta Global AI Developer Hackathon (submission 4 Nov 2026, 9pm ET). Checkout is simulated. No real payments.

Source of truth: PRD v0.2 plus `PRD-Amendment-1.md` and `PRD-Amendment-2.md`.

## One app, two routes

One React app, one deployment. The routes are:

| Route | What it is | Theme |
|---|---|---|
| `/` | Demo entry page. The only page that points at both views. | light |
| `/shop` | Northwind Outfitters demo store, as a shopper or an agent sees it. 9 products read live from Supabase. | light retail |
| `/dashboard` | AgentReceipt merchant dashboard. Demo sign-in, then Dashboard, Agent orders, Disputes, Optimization, Tamper. | dark |

## Folders (`src/`)

| Folder | What lives there |
|---|---|
| `shop/` | The store only. Header is brand, tagline, Ski / Snowboard anchors, cart. No link to the dashboard. |
| `dashboard/` | The merchant dashboard only. Its "View Store" link is an internal route to `/shop`. |
| `shared/` | Supabase client, row types, grant / receipt / dispute schemas, formatting helpers, the products hook. |
| `app/` | The router and the demo entry page. |
| `test/` | Render tests and the separation tests. |

Rules, enforced by tests (`src/test/separation.test.ts`):
- `shop` and `dashboard` never import each other. Anything both need goes through `shared`.
- `shop` source never mentions dashboard, grant, receipt, tamper or dispute.
- The shop uses no dashboard colours.
- No Lovable code and no external repo links in app source.

## Status

- Built: shop (9 products, photos from Supabase Storage), dashboard shell with demo sign-in and navigation, database schema.
- Not built yet: agent loop, receipts and hash chain, tamper demo, mismatch detection, dispute screens, evidence pack, detection beat. The dashboard sections say "Not built yet" until then.

## Supabase

Project `AgentReceipt` (Postgres, Storage, edge functions). SQL, in order:
1. `supabase/001_schema_v0.2.sql`
2. `supabase/002_products_store_columns.sql`
3. `supabase/003_seed_products.sql` (the 9 products from the catalog CSV; header lists what was assumed)
4. `supabase/004_product_images_bucket.sql`

Product photos are stored in the `product-images` bucket. Each product has `image_id` (storage path) and `image_hash` (SHA-256 of the file). They are real retailer photos, not Muse Image generations (see Amendment 2, section 5).

## Run it

1. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key. Never put a service_role key or the Meta API key in a `VITE_` variable.
2. `npm install`, then `npm run dev`. Open `/`, `/shop` or `/dashboard`.
3. `npm test` runs the render and separation tests. `npm run build` typechecks and builds.

## Deploy

Any static host works, as long as every path serves `index.html` (single-page-app fallback) so `/shop` and `/dashboard` load directly:
- Vercel: `vercel.json` already has the rewrite.
- Netlify / Cloudflare Pages: `public/_redirects` is copied into the build.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as build environment variables on the host.

- Deployment trigger
