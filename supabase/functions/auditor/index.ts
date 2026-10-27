// Supabase edge function: auditor. One AgentReceipt auditor, the same rules for every order, a fresh isolated run per order.
// Separate from shopper-agent (it never imports shopper code). Writes with the service role only.
// Deployed with verify_jwt = false (called server-to-server by the order system; it is idempotent per order, so a repeat
// call returns the verdict already on record and can never change it).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { runAuditor } from './run.ts'
import { createAuditorDb } from './store.ts'
import { createSparkReader } from './spark.ts'

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
    if (text.length > 2_000) return json({ type: 'error', message: 'Request too large.' }, 413)
    let body: unknown
    try { body = JSON.parse(text) } catch { return json({ type: 'error', message: 'Bad request' }, 400) }
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ type: 'error', message: 'Server is missing its Supabase settings.' }, 500)
    const db = createClient(url, serviceKey, { auth: { persistSession: false } })
    const reply = await runAuditor(body, {
      db: createAuditorDb(db), reader: createSparkReader(Deno.env.get('MODEL_API_KEY')),
      now: () => new Date(), newId: () => crypto.randomUUID(),
    })
    return json(reply, reply.type === 'error' ? 400 : 200)
  } catch (e) {
    console.error('auditor failure', e instanceof Error ? e.message : e)
    return json({ type: 'error', message: 'The auditor could not finish. Please try again.' }, 500)
  }
})
