// Supabase edge function: shopper-agent (the brain). Muse Spark runs here; the key lives only in the
// Supabase secret MODEL_API_KEY. Deployed with verify_jwt = false because the phone screen calls it with the
// publishable key (which is not a JWT). Abuse limits live in agent.ts (message count, length, model turns).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle } from './agent.ts'
import { createStore } from './store.ts'
import { MISSING_KEY_MESSAGE, ModelCallError, ModelKeyMissingError, createMetaClient } from './model.ts'

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
    if (text.length > 30_000) return json({ type: 'error', message: 'Request too large.' }, 413)
    let body: unknown
    try { body = JSON.parse(text) } catch { return json({ type: 'error', message: 'Bad request' }, 400) }

    const model = createMetaClient(Deno.env.get('MODEL_API_KEY')) // throws a clear error if the secret is missing
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ type: 'error', message: 'Server is missing its Supabase settings.' }, 500)
    const db = createClient(url, serviceKey, { auth: { persistSession: false } })

    const reply = await handle(body, {
      model, store: createStore(db), now: () => new Date(), demoDate: Deno.env.get('DEMO_DATE') ?? null,
      newId: () => crypto.randomUUID(),
      // Tell the order system an order arrived (session id only). The reply is never read.
      onOrderReceived: async (sessionId) => {
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), 20_000)
        try {
          await fetch(`${url}/functions/v1/auditor`, {
            method: 'POST', signal: ctl.signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          })
        } finally { clearTimeout(timer) }
      },
    })
    return json(reply, reply.type === 'error' ? 400 : 200)
  } catch (e) {
    if (e instanceof ModelKeyMissingError) return json({ type: 'error', message: MISSING_KEY_MESSAGE }, 500)
    if (e instanceof ModelCallError) {
      console.error('model error', e.status, e.message)
      return json({ type: 'error', message: 'Muse could not answer just now. Please try again.' }, 502)
    }
    console.error('shopper-agent failure', e instanceof Error ? e.message : e)
    return json({ type: 'error', message: 'Something went wrong. Please try again.' }, 500)
  }
})
