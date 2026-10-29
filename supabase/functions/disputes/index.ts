// Supabase edge function: disputes (Dispute Agent / Evidence pack, Muse Spark Product Feature 3).
// The one write path for dispute entry, merchant review records (Layer 2), merchant decisions / outcomes and pack
// generation records. Actions are listed in run.ts. Writes with the service role only; the browser never writes.
// Deployed with verify_jwt = false: the demo dashboard calls it with the publishable key (not a JWT), like optimizer.
// Secret: MODEL_API_KEY (Spark; without it every pack text is the template text, labelled rules-fallback).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ROUTES } from './run.ts'
import { createDisputesDb } from './store.ts'
import { createSparkTextWriter } from './spark.ts'

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
    if (text.length > 20_000) return json({ type: 'error', message: 'Request too large.' }, 413)
    let body: Record<string, unknown>
    try { body = JSON.parse(text) } catch { return json({ type: 'error', message: 'Bad request' }, 400) }
    const run = typeof body.action === 'string' ? ROUTES[body.action] : undefined
    if (!run) return json({ type: 'error', message: `action must be one of: ${Object.keys(ROUTES).join(', ')}.` }, 400)
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ type: 'error', message: 'Server is missing its Supabase settings.' }, 500)
    const reply = await run(body, {
      db: createDisputesDb(createClient(url, serviceKey, { auth: { persistSession: false } })),
      writer: createSparkTextWriter(Deno.env.get('MODEL_API_KEY')),
      now: () => new Date(),
      newId: () => crypto.randomUUID(),
    })
    return json(reply, reply.type === 'error' ? 400 : 200)
  } catch (e) {
    console.error('disputes failure', e instanceof Error ? e.message : e)
    return json({ type: 'error', message: 'The dispute function could not finish. Please try again.' }, 500)
  }
})
