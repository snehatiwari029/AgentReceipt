// Supabase edge function: optimizer (Listing Optimizer, Muse Spark Product Feature 2).
// Actions: scan (also the re-scan behind Scan Now), decide (approve / reject one suggestion), approve_all.
// Writes with the service role, to optimizer_scans and optimizer_suggestions only. It never writes a listing.
// Deployed with verify_jwt = false: the demo dashboard calls it with the publishable key (not a JWT), like shopper-agent.
// Secrets: MODEL_API_KEY (Spark; without it every listing is labelled rules-fallback), STORE_PAGE_URL (the shop page
// whose HTML-as-served is checked for Schema.org markup; without it Pillar 3 shows "Not checked").
import { createClient } from 'npm:@supabase/supabase-js@2'
import { approveAll, decide, runScan } from './run.ts'
import { createOptimizerDb, fetchStoreMarkup } from './store.ts'
import { createSparkListingReader } from './spark.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ type: 'error', message: 'POST only' }, 405)
  try {
    const text = await req.text()
    if (text.length > 40_000) return json({ type: 'error', message: 'Request too large.' }, 413)
    let body: Record<string, unknown>
    try { body = JSON.parse(text) } catch { return json({ type: 'error', message: 'Bad request' }, 400) }
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ type: 'error', message: 'Server is missing its Supabase settings.' }, 500)
    const deps = {
      db: createOptimizerDb(createClient(url, serviceKey, { auth: { persistSession: false } })),
      reader: createSparkListingReader(Deno.env.get('MODEL_API_KEY')),
      fetchMarkup: () => fetchStoreMarkup(Deno.env.get('STORE_PAGE_URL')),
      now: () => new Date(),
      newId: () => crypto.randomUUID(),
    }
    const run = body.action === 'scan' ? runScan : body.action === 'decide' ? decide : body.action === 'approve_all' ? approveAll : null
    if (!run) return json({ type: 'error', message: 'action must be scan, decide or approve_all.' }, 400)
    const reply = await run(body, deps)
    return json(reply, reply.type === 'error' ? 400 : 200)
  } catch (e) {
    console.error('optimizer failure', e instanceof Error ? e.message : e)
    return json({ type: 'error', message: 'The optimizer could not finish. Please try again.' }, 500)
  }
})
