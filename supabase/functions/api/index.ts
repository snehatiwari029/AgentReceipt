// Supabase edge function: api. The public AgentReceipt API for third-party agents (docs/API.md).
// Deployed with verify_jwt = false: callers are external agents with no Supabase JWT. Every POST except
// /api/agents/register checks a demo-issued X-Agent-Key (stored hashed in api_agents). Writes use the service role.
// The verdict comes from the existing auditor function, called server-to-server exactly as the shopper calls it.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleApi, type AuditorAnswer } from './handler.ts'
import { createApiDb } from './store.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { ...cors, 'content-type': 'application/json' } })

// "/api/agents/register", "/functions/v1/api/agents/register" and "/api/api/agents/register" all route the same.
function routePath(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'functions' && parts[1] === 'v1') parts.splice(0, 2)
  if (parts[0] === 'api') parts.shift()
  if (parts[0] === 'api') parts.shift()
  return parts
}

const newKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `ark_demo_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'Server is missing its Supabase settings.' }, 500)
    const db = createClient(url, serviceKey, { auth: { persistSession: false } })
    const auditor = async (sessionId: string): Promise<AuditorAnswer> => {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 30_000)
      try {
        const res = await fetch(`${url}/functions/v1/auditor`, {
          method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }),
        })
        return (await res.json()) as AuditorAnswer
      } finally { clearTimeout(timer) }
    }
    const body = req.method === 'POST' ? await req.text() : ''
    const out = await handleApi(
      { method: req.method, path: routePath(new URL(req.url).pathname), header: (n) => req.headers.get(n), body },
      { db: createApiDb(db), auditor, now: () => new Date(), newId: () => crypto.randomUUID(), newKey },
    )
    return json(out.body, out.status)
  } catch (e) {
    console.error('api failure', e instanceof Error ? e.message : e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
