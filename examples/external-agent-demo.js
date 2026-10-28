#!/usr/bin/env node
// External agent demo for the public AgentReceipt API (docs/API.md).
// Runs from a terminal only: no UI, no shopper chat, no seeded data. Node 18+ (built-in fetch), no dependencies.
//
//   AGENTRECEIPT_API_URL   API base, e.g. https://<project-ref>.supabase.co/functions/v1/api   (required)
//   AGENTRECEIPT_API_KEY   a demo key from POST /api/agents/register                            (optional: registers a new agent if unset)
//   AGENTRECEIPT_APP_URL   the deployed app, used only to print the dashboard link                (optional)
//
// The verdict printed below is whatever the API's auditor returns. Nothing here decides or fakes it.

const BASE = (process.env.AGENTRECEIPT_API_URL || '').replace(/\/+$/, '')
const APP = (process.env.AGENTRECEIPT_APP_URL || '').replace(/\/+$/, '')
if (!BASE) {
  console.error('Set AGENTRECEIPT_API_URL, e.g. https://<project-ref>.supabase.co/functions/v1/api')
  process.exit(1)
}

async function call(method, path, body, key) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(key ? { 'x-agent-key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({ error: `non-JSON reply (HTTP ${res.status})` }))
  if (!res.ok) {
    console.error(`${method} ${path} -> HTTP ${res.status}`)
    console.error(JSON.stringify(json, null, 2))
    process.exit(1)
  }
  return json
}

const step = (n, text) => console.log(`\n[${n}] ${text}`)

async function main() {
  // 1. Agent key: from the environment, or register a fresh demo agent.
  let key = process.env.AGENTRECEIPT_API_KEY
  if (key) step(1, 'Using demo API key from AGENTRECEIPT_API_KEY')
  else {
    const reg = await call('POST', '/agents/register', { agent_name: 'External demo agent' })
    key = reg.api_key
    step(1, `Registered agent ${reg.agent_id} (${reg.note})`)
    console.log('    Key printed once so you can reuse it: export AGENTRECEIPT_API_KEY=' + key)
  }

  // 2. Session at the demo merchant.
  const session = await call('POST', '/sessions', { merchant: 'Northwind Outfitters' }, key)
  step(2, `Session opened: ${session.session_id}`)

  // 3. Grant: what the customer authorised. Fields only. colour is a real JSON null (unspecified, no check).
  const expiry = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const grant = await call('POST', '/grants', {
    session_id: session.session_id,
    merchant: 'Northwind Outfitters',
    budget_total_max: 500,
    product_scope: 'snowboard',
    size_range: '150-165 cm',
    colour: null,
    delivery_by: '2026-10-28',
    return_policy_required: true,
    payment_method_ref: 'Demo Checkout',
    expiry,
  }, key)
  step(3, `Grant registered: ${grant.grant_id}`)
  console.log(`    grant_hash ${grant.grant_hash}`)

  // 4. Action: what the agent actually did.
  const action = await call('POST', '/actions', {
    session_id: session.session_id,
    product_name: 'Burton Spellbinder Snowboard 2026/2027',
    product_scope: 'snowboard',
    size: 156,
    colour: null,
    item_price: 449.95,
    shipping_price: 60,
    total_price: 509.95,
    delivery_date: '2026-10-28',
    formal_terms: 'Final Sale',
    agent_summary_returns: 'Easy returns',
    agent_summary_delivery: 'Wed Oct 28',
    agent_believed_terms: { returns: 'Easy returns' },
    payment_method: 'Demo Checkout',
  }, key)
  step(4, `Action logged: ${action.action_id} -> order ${action.order_id}, receipt ${action.receipt_id}`)

  // 5. Verdict, straight from the API.
  const v = await call('GET', `/verdicts/${action.order_id}`)
  step(5, 'Auditor verdict')
  console.log(`    order_id     ${v.order_id}`)
  console.log(`    receipt_id   ${v.receipt_id}`)
  console.log(`    decision     ${v.decision}`)
  console.log(`    problems     ${v.problems.length}`)
  for (const p of v.problems) {
    console.log(`      - ${p.field} | grant: ${p.grant ?? '-'} | merchant terms: ${p.merchant_terms ?? '-'} | actual: ${p.actual ?? '-'} | ${p.match} | ${p.cause ?? '-'}`)
  }
  if (v.missing_components.length) console.log(`    missing      ${v.missing_components.join(', ')}`)
  console.log(`    receipt_hash ${v.receipt_hash}`)
  console.log(`    hash chain   ${v.hash_verification.verified ? 'verified' : 'NOT verified'} (${v.hash_chain.map((c) => `${c.type}:${c.content_ok && c.link_ok ? 'ok' : 'fail'}`).join(', ')})`)

  // 6. Where to see the same order in the merchant dashboard.
  step(6, 'See the same order in the dashboard')
  console.log(`    ${APP ? APP : '<your app URL>'}${v.dashboard_path}  (order ${v.order_id}, ${v.receipt_id})`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
