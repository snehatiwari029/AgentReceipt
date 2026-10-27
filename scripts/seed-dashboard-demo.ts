// Generates supabase/seed_dashboard_demo.sql. Deterministic: same input, same output, byte for byte.
//   npm run seed:generate
// Every hash comes from supabase/functions/_shared/hash.ts (the same code the receipt function will use).
// Nothing here is hand-written hash data.
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GENESIS_HASH, computeEntryHash, canonicalJson } from '../supabase/functions/_shared/hash'

// Ids of this Supabase project's existing rows (read once from the database). The seed SQL checks
// them before inserting and stops with a clear error if they differ.
export const MERCHANT_ID = '32b14be6-26e6-49df-a7af-79532f910510'
export const BURTON_ID = '40c70768-77ac-4953-8bae-c75c8319fcf4'
export const ORCA_ID = 'd53088eb-40e0-4fa5-b2f8-1b81e9c7c37e'
export const NITRO_ID = '9a3f8acb-8e2f-4ffe-b83c-085d54b96765'

type Kind = 'uuid' | 'text' | 'int' | 'bool' | 'date' | 'ts' | 'json' | 'texts'
type Cols = [string, Kind][]

export const TABLES: Record<string, Cols> = {
  sessions: [['id', 'uuid'], ['merchant_id', 'uuid'], ['detection_source', 'text'], ['agent_id', 'text'], ['agent_verified', 'bool'], ['agent_verified_simulated', 'bool'], ['gap_note', 'text'], ['opened_at', 'ts']],
  grants: [['id', 'uuid'], ['session_id', 'uuid'], ['version', 'int'], ['supersedes_grant_id', 'uuid'], ['shopper_ref', 'text'], ['agent_id', 'text'], ['agent_verified', 'bool'], ['merchant_id', 'uuid'], ['product_scope', 'text'], ['size_min_cm', 'int'], ['size_max_cm', 'int'], ['colour_preference', 'text'], ['currency', 'text'], ['amount_max_cents', 'int'], ['budget_limit_cents', 'int'], ['payment_method_ref', 'text'], ['shipping_method', 'text'], ['shipping_max_cost_cents', 'int'], ['delivery_by', 'date'], ['return_policy_required', 'bool'], ['confirmed_at', 'ts'], ['expires_at', 'ts'], ['private_chat_hash', 'text'], ['grant_json', 'json'], ['system_metadata', 'json'], ['schema_label', 'text'], ['created_at', 'ts'], ['chain_seq', 'int'], ['prev_hash', 'text'], ['entry_hash', 'text']],
  proposals: [['id', 'uuid'], ['grant_id', 'uuid'], ['product_id', 'uuid'], ['shown_item_price_cents', 'int'], ['shown_total_cents', 'int'], ['shown_returns_summary', 'text'], ['shown_delivery', 'text'], ['shown_at', 'ts'], ['confirmation_ref', 'text'], ['confirmed_at', 'ts'], ['created_at', 'ts'], ['chain_seq', 'int'], ['prev_hash', 'text'], ['entry_hash', 'text']],
  actions: [['id', 'uuid'], ['grant_id', 'uuid'], ['seq', 'int'], ['type', 'text'], ['detail', 'json'], ['agent_believed_terms', 'json'], ['image_evidence_ref', 'json'], ['created_at', 'ts'], ['chain_seq', 'int'], ['prev_hash', 'text'], ['entry_hash', 'text']],
  receipts: [['id', 'uuid'], ['receipt_ref', 'text'], ['order_ref', 'text'], ['grant_id', 'uuid'], ['proposal_id', 'uuid'], ['merchant_id', 'uuid'], ['terms_snapshot', 'json'], ['action_summary', 'json'], ['mismatch_results', 'json'], ['problems_found', 'int'], ['recommendation', 'text'], ['missing_components', 'texts'], ['image_evidence_ref', 'json'], ['schema_label', 'text'], ['created_at', 'ts'], ['chain_seq', 'int'], ['prev_hash', 'text'], ['entry_hash', 'text']],
  disputes: [['id', 'uuid'], ['receipt_id', 'uuid'], ['reason', 'text'], ['opened_at', 'ts'], ['created_at', 'ts']],
  dispute_events: [['id', 'uuid'], ['dispute_id', 'uuid'], ['event_type', 'text'], ['decided_by', 'text'], ['basis', 'json'], ['created_at', 'ts'], ['chain_seq', 'int'], ['prev_hash', 'text'], ['entry_hash', 'text']],
}

type Row = Record<string, unknown>
export type SeedRecord = { table: string; entry_type: string | null; row: Row }

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
// Deterministic uuid from a label.
export function uid(label: string): string {
  const h = sha(`agentreceipt-seed:${label}`)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const chatHash = (order: string) => `sha256:${sha(`seeded-demo:no-private-chat-text:${order}`)}`
const LABEL = 'VI-aligned demo representation'

const records: SeedRecord[] = []
let seq = 0
let lastHash = GENESIS_HASH

// Adds a chained row: assigns the next chain_seq, links it to the previous entry and hashes it.
async function chain(table: string, entryType: string, row: Row): Promise<Row> {
  seq += 1
  const full: Row = { ...row, chain_seq: seq, prev_hash: lastHash }
  const entry_hash = await computeEntryHash(lastHash, full)
  const done = { ...full, entry_hash }
  lastHash = entry_hash
  records.push({ table, entry_type: entryType, row: done })
  return done
}
function plain(table: string, row: Row) {
  records.push({ table, entry_type: null, row })
}

const at = (hhmm: string) => `2026-10-26T${hhmm}:00.000Z`

type Scenario = {
  key: string
  order_ref: string | null
  receipt_ref: string
  shopper: string
  agent: string
  at: { grant: string; proposal: string; action: string; receipt: string }
  grant: { product_scope: string | null; colour: string | null; return_required: boolean | null; delivery_by: string | null }
  proposal: { product: string; item: number; total: number | null; returns: string; delivery: string }
  action: Row & { detail: Row; believed: Row }
  terms: Row
  summary: Row
  verdict: Row[]
  recommendation: 'represent' | 'concede'
}

const mm = (field: string, grant: string | null, terms: string | null, actual: string | null, result: 'match' | 'mismatch' | 'unspecified', cause: string | null, next: string | null, cited: string[]): Row => ({
  field, grant, merchant_terms: terms, actual, result, cause, next_action_who: next, cited_fields: cited,
})

async function build(s: Scenario) {
  const sid = uid(`${s.key}:session`)
  plain('sessions', {
    id: sid, merchant_id: MERCHANT_ID, detection_source: 'self_declared_simulated', agent_id: s.agent,
    agent_verified: true, agent_verified_simulated: true, gap_note: null, opened_at: at(s.at.grant),
  })
  const gid = uid(`${s.key}:grant`)
  const confirmed = at(s.at.grant)
  const expires = new Date(Date.parse(confirmed) + 24 * 3600 * 1000).toISOString()
  const sealed = {
    shopper_ref: s.shopper, agent_id: s.agent, agent_verified: true, merchant_id: MERCHANT_ID,
    product_scope: s.grant.product_scope, size_min_cm: 150, size_max_cm: 165, colour_preference: s.grant.colour,
    currency: 'USD', amount_max_cents: 50000, budget_limit_cents: 50000, payment_method_ref: 'Demo PayPal',
    shipping_method: null, shipping_max_cost_cents: null, delivery_by: s.grant.delivery_by,
    return_policy_required: s.grant.return_required, confirmed_at: confirmed, expires_at: expires,
  }
  await chain('grants', 'grant', {
    id: gid, session_id: sid, version: 1, supersedes_grant_id: null, ...sealed,
    private_chat_hash: chatHash(s.key), grant_json: JSON.parse(canonicalJson(sealed)),
    system_metadata: {
      data_sharing_limits: 'grant fields only, this purchase only', checked: false, priority: 'P1',
      seeded_demo: true, private_chat_hash_note: 'Seeded demo row: no private chat exists, the hash is of a fixed label.',
    },
    schema_label: LABEL, created_at: confirmed,
  })
  const pid = uid(`${s.key}:proposal`)
  await chain('proposals', 'proposal', {
    id: pid, grant_id: gid, product_id: s.proposal.product, shown_item_price_cents: s.proposal.item,
    shown_total_cents: s.proposal.total, shown_returns_summary: s.proposal.returns, shown_delivery: s.proposal.delivery,
    shown_at: at(s.at.proposal), confirmation_ref: `PC-${s.key}`, confirmed_at: at(s.at.proposal), created_at: at(s.at.proposal),
  })
  await chain('actions', 'action', {
    id: uid(`${s.key}:action`), grant_id: gid, seq: 1, type: 'checkout', detail: s.action.detail,
    agent_believed_terms: s.action.believed, image_evidence_ref: null, created_at: at(s.at.action),
  })
  const rid = uid(`${s.key}:receipt`)
  const problems = s.verdict.filter((v) => v.result === 'mismatch').length
  const receipt = await chain('receipts', 'receipt', {
    id: rid, receipt_ref: s.receipt_ref, order_ref: s.order_ref, grant_id: gid, proposal_id: pid, merchant_id: MERCHANT_ID,
    terms_snapshot: s.terms, action_summary: s.summary, mismatch_results: s.verdict, problems_found: problems,
    recommendation: s.recommendation, missing_components: [], image_evidence_ref: null, schema_label: LABEL, created_at: at(s.at.receipt),
  })
  return { gid, rid, receipt }
}

export async function buildSeed(): Promise<{ sql: string; records: SeedRecord[] }> {
  records.length = 0
  seq = 0
  lastHash = GENESIS_HASH

  const burtonTerms = {
    merchant: 'Northwind Outfitters', product_id: BURTON_ID, product_name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton',
    size_cm: 156, colour: 'Serpent', price_cents: 44995, formal_returns: 'final_sale', formal_terms_text: 'Final Sale',
    terms_version: 'v1', standard_shipping_cents: 0, standard_delivery_days: 5, expedited_shipping_cents: 6000, expedited_delivery_days: 4,
  }
  const orcaTerms = {
    merchant: 'Northwind Outfitters', product_id: ORCA_ID, product_name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech',
    size_cm: 156, colour: null, price_cents: 48983, formal_returns: 'free', formal_terms_text: 'Free returns within 30 days',
    terms_version: 'v1', standard_shipping_cents: 0, standard_delivery_days: 3, expedited_shipping_cents: null, expedited_delivery_days: null,
  }

  // 1) Tamper example: earlier, compliant order of $449.95. Filler customer/agent: only used to make a valid chain.
  const t = await build({
    key: '0041', order_ref: null, receipt_ref: 'AR-2026-0041', shopper: 'Ivan Dijkstra', agent: 'instinct-kk14680',
    at: { grant: '13:00', proposal: '13:04', action: '13:06', receipt: '13:07' },
    grant: { product_scope: 'snowboard', colour: null, return_required: null, delivery_by: null },
    proposal: { product: BURTON_ID, item: 44995, total: 44995, returns: 'Final sale', delivery: 'Standard, 5 days' },
    action: {
      detail: { product_id: BURTON_ID, product_name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Serpent', item_price_cents: 44995, shipping_method: 'standard', shipping_cents: 0, total_cents: 44995, delivery_date: '2026-10-31', payment_method: 'Demo PayPal', agent_summary: { returns: 'Final sale' } },
      believed: { returns: 'Final sale' },
    },
    terms: burtonTerms,
    summary: { order_status: 'Confirmed', product_name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Serpent', item_price_cents: 44995, shipping_method: 'standard', shipping_cents: 0, total_cents: 44995, delivery_date: '2026-10-31', payment_method: 'Demo PayPal' },
    verdict: [
      mm('Budget', '$500.00 max', 'Item $449.95, standard shipping free', '$449.95 total', 'match', null, null, ['amount_max_cents', 'budget_limit_cents']),
      mm('Size', '150-165cm', '156cm', '156cm', 'match', null, null, ['size_min_cm', 'size_max_cm']),
      mm('Colour', null, 'Serpent', 'Serpent', 'unspecified', null, null, ['colour_preference']),
      mm('Returns', null, 'Final sale', 'Agent told customer "Final sale"', 'unspecified', null, null, ['return_policy_required']),
      mm('Delivery', null, 'Standard 5 days', 'Sat 31 Oct 2026', 'unspecified', null, null, ['delivery_by']),
      mm('Shipping method', null, 'Standard free, expedited $60.00', 'Standard', 'unspecified', null, null, ['shipping_method']),
      mm('Merchant', 'Northwind Outfitters only', 'Northwind Outfitters', 'Northwind Outfitters', 'match', null, null, ['merchant_id']),
      mm('Payment method', 'Demo PayPal', 'Demo PayPal', 'Demo PayPal', 'match', null, null, ['payment_method_ref']),
    ],
    recommendation: 'represent',
  })

  // 2) Hero order 12322 / AR-2026-0042: agent oversteps, 2 problems.
  const hero = await build({
    key: '12322', order_ref: '12322', receipt_ref: 'AR-2026-0042', shopper: 'Jemaih Soresky', agent: 'meta-muse-j0376672',
    at: { grant: '17:05', proposal: '17:09', action: '17:11', receipt: '17:12' },
    grant: { product_scope: 'snowboard', colour: 'Serpent', return_required: true, delivery_by: '2026-10-30' },
    proposal: { product: BURTON_ID, item: 44995, total: null, returns: 'Easy returns', delivery: 'Friday' },
    action: {
      detail: { product_id: BURTON_ID, product_name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Serpent', item_price_cents: 44995, shipping_method: 'expedited', shipping_cents: 6000, total_cents: 50995, delivery_date: '2026-10-30', payment_method: 'Demo PayPal', agent_summary: { returns: 'Easy returns' } },
      believed: { returns: 'Easy returns' },
    },
    terms: burtonTerms,
    summary: { order_status: 'Confirmed', product_name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Serpent', item_price_cents: 44995, shipping_method: 'expedited', shipping_cents: 6000, total_cents: 50995, delivery_date: '2026-10-30', payment_method: 'Demo PayPal', agent_summary_returns: 'Easy returns' },
    verdict: [
      mm('Budget', '$500.00 max', 'Item $449.95 + expedited $60.00', '$509.95 total', 'mismatch', 'Agent treated the cap as item-only', 'Merchant: concede the dispute', ['amount_max_cents', 'budget_limit_cents']),
      mm('Returns', 'Returnable required', 'Final sale', 'Agent summary "Easy returns"', 'mismatch', 'Agent summary "Easy returns" misrepresented the formal final-sale terms', 'Merchant: concede the dispute', ['return_policy_required']),
      mm('Size', '150-165cm', '156cm', '156cm', 'match', null, null, ['size_min_cm', 'size_max_cm']),
      mm('Colour', 'Serpent', 'Serpent', 'Serpent', 'match', null, null, ['colour_preference']),
      mm('Delivery', 'By Fri 30 Oct 2026', 'Expedited 4 days, standard 5 days', 'Fri 30 Oct 2026 (expedited)', 'match', null, null, ['delivery_by']),
      mm('Shipping method', null, 'Standard free, expedited $60.00', 'Expedited', 'unspecified', null, null, ['shipping_method']),
      mm('Merchant', 'Northwind Outfitters only', 'Northwind Outfitters', 'Northwind Outfitters', 'match', null, null, ['merchant_id']),
      mm('Payment method', 'Demo PayPal', 'Demo PayPal', 'Demo PayPal', 'match', null, null, ['payment_method_ref']),
    ],
    recommendation: 'concede',
  })
  const d1 = uid('12322:dispute')
  plain('disputes', { id: d1, receipt_id: hero.rid, reason: 'Customer disputed the order', opened_at: at('17:30'), created_at: at('17:30') })
  await chain('dispute_events', 'dispute_event', { id: uid('12322:ev1'), dispute_id: d1, event_type: 'opened', decided_by: null, basis: {}, created_at: at('17:30') })

  // 3) Scenario B order 13422: agent complies, 0 problems, merchant represents and wins.
  const b = await build({
    key: '13422', order_ref: '13422', receipt_ref: 'AR-2026-0043', shopper: 'Ivan Dijkstra', agent: 'instinct-kk14680',
    at: { grant: '18:00', proposal: '18:04', action: '18:06', receipt: '18:07' },
    grant: { product_scope: null, colour: null, return_required: true, delivery_by: '2026-10-30' },
    proposal: { product: ORCA_ID, item: 48983, total: 48983, returns: 'Free returns', delivery: 'Friday' },
    action: {
      detail: { product_id: ORCA_ID, product_name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech', size_cm: 156, colour: null, item_price_cents: 48983, shipping_method: 'standard', shipping_cents: 0, total_cents: 48983, delivery_date: '2026-10-29', payment_method: 'Demo PayPal', agent_summary: { returns: 'Free returns' } },
      believed: { returns: 'Free returns' },
    },
    terms: orcaTerms,
    summary: { order_status: 'Confirmed', product_name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech', size_cm: 156, colour: null, item_price_cents: 48983, shipping_method: 'standard', shipping_cents: 0, total_cents: 48983, delivery_date: '2026-10-29', payment_method: 'Demo PayPal', agent_summary_returns: 'Free returns' },
    verdict: [
      mm('Budget', '$500.00 max', 'Item $489.83, standard shipping free', '$489.83 total', 'match', null, null, ['amount_max_cents', 'budget_limit_cents']),
      mm('Returns', 'Returnable required', 'Free returns within 30 days', 'Agent summary "Free returns"', 'match', null, null, ['return_policy_required']),
      mm('Size', '150-165cm', '156cm', '156cm', 'match', null, null, ['size_min_cm', 'size_max_cm']),
      mm('Colour', null, null, null, 'unspecified', null, null, ['colour_preference']),
      mm('Delivery', 'By Fri 30 Oct 2026', 'Standard 3 days', 'Thu 29 Oct 2026 (standard)', 'match', null, null, ['delivery_by']),
      mm('Shipping method', null, 'Standard free', 'Standard, no expedited charge', 'unspecified', null, null, ['shipping_method']),
      mm('Merchant', 'Northwind Outfitters only', 'Northwind Outfitters', 'Northwind Outfitters', 'match', null, null, ['merchant_id']),
      mm('Payment method', 'Demo PayPal', 'Demo PayPal', 'Demo PayPal', 'match', null, null, ['payment_method_ref']),
    ],
    recommendation: 'represent',
  })
  const d2 = uid('13422:dispute')
  plain('disputes', { id: d2, receipt_id: b.rid, reason: 'Claimed agent overstep — agent exceeded budget / bought outside grant', opened_at: at('18:30'), created_at: at('18:30') })
  await chain('dispute_events', 'dispute_event', { id: uid('13422:ev1'), dispute_id: d2, event_type: 'opened', decided_by: null, basis: {}, created_at: at('18:30') })
  await chain('dispute_events', 'dispute_event', { id: uid('13422:ev2'), dispute_id: d2, event_type: 'recommendation', decided_by: 'AgentReceipt (automatic)', basis: { recommendation: 'represent', problems_found: 0 }, created_at: at('18:31') })
  await chain('dispute_events', 'dispute_event', { id: uid('13422:ev3'), dispute_id: d2, event_type: 'represented', decided_by: 'Northwind Outfitters', basis: { receipt_ref: 'AR-2026-0043' }, created_at: at('18:40') })
  await chain('dispute_events', 'dispute_event', { id: uid('13422:ev4'), dispute_id: d2, event_type: 'outcome_won', decided_by: 'Northwind Outfitters', basis: { receipt_ref: 'AR-2026-0043' }, created_at: at('18:50') })

  // 4) Order 14522: gap. No receipt, no grant. A session row records the gap.
  plain('sessions', {
    id: uid('14522:session'), merchant_id: MERCHANT_ID, detection_source: 'none', agent_id: null, agent_verified: false,
    agent_verified_simulated: true,
    gap_note: 'Order 14522: Unverified agent, no AgentReceipt session opened, no receipt (gap recorded)',
    opened_at: at('19:00'),
  })
  void t

  return { sql: emitSql(), records: [...records] }
}

// ---------- SQL output ----------
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
function lit(v: unknown, kind: Kind): string {
  if (v === null || v === undefined) return 'null'
  switch (kind) {
    case 'uuid': return `${q(v as string)}::uuid`
    case 'text': return q(v as string)
    case 'int': return String(v)
    case 'bool': return v ? 'true' : 'false'
    case 'date': return `${q(v as string)}::date`
    case 'ts': return `${q(v as string)}::timestamptz`
    case 'json': return `${q(canonicalJson(v))}::jsonb`
    case 'texts': return `array[${(v as string[]).map(q).join(', ')}]::text[]`
  }
}

function insert(table: string, row: Row): string {
  const cols = TABLES[table]
  const names = cols.map(([n]) => n)
  const keys = Object.keys(row).sort().join(',')
  if (keys !== [...names].sort().join(',')) throw new Error(`Row for ${table} has the wrong columns: ${keys}`)
  return `insert into ${table} (${names.join(', ')}) values (\n  ${cols.map(([n, k]) => lit(row[n], k)).join(',\n  ')}\n);`
}

function emitSql(): string {
  const order = ['sessions', 'grants', 'proposals', 'actions', 'receipts', 'disputes', 'dispute_events']
  const body = order
    .flatMap((t) => records.filter((r) => r.table === t).map((r) => insert(t, r.row)))
    .join('\n\n')
  const last = records.filter((r) => r.entry_type).length
  return `-- =====================================================================
-- AgentReceipt dashboard demo seed. GENERATED FILE: do not edit by hand.
-- Regenerate with: npm run seed:generate   (script: scripts/seed-dashboard-demo.ts)
--
-- Run ONCE in Supabase > SQL Editor, after 001 to 006. It does not change the schema.
-- It stops with an error, and writes nothing, if the ids below do not match this project,
-- if the seed was already applied, or if the chain already has entries.
--
-- Rows: orders 12322 (AR-2026-0042, hero, dispute received), 13422 (AR-2026-0043, Scenario B,
-- merchant represents and wins), 14522 (gap, no receipt), and the tamper example receipt
-- AR-2026-0041 ($449.95). Customers are demo names only. Payment label: Demo PayPal.
-- Hashes: supabase/functions/_shared/hash.ts, chained from the origin hash. Seeded demo data:
-- no real chat exists, so private_chat_hash is a hash of a fixed label.
-- To re-seed: select demo_reset();  (this clears ALL sessions, grants, receipts and disputes)
-- =====================================================================
begin;

do $$
begin
  if (select id from merchants where name = 'Northwind Outfitters') is distinct from ${q(MERCHANT_ID)}::uuid then
    raise exception 'Seed stopped: merchant id does not match this project.';
  end if;
  if not exists (select 1 from products where id = ${q(BURTON_ID)}::uuid and image_file = 'burton-spellbinder.png')
     or not exists (select 1 from products where id = ${q(ORCA_ID)}::uuid and image_file = 'lib-tech-orca.png')
     or not exists (select 1 from products where id = ${q(NITRO_ID)}::uuid and image_file = 'nitro-alternator.png') then
    raise exception 'Seed stopped: product ids do not match this project.';
  end if;
  if exists (select 1 from receipts) or exists (select 1 from grants) or exists (select 1 from sessions) then
    raise exception 'Seed stopped: sessions, grants or receipts already exist. Run select demo_reset(); first to re-seed.';
  end if;
end;
$$;

-- Catalog facts the seeded orders depend on (data only, not schema):
--  * Burton Spellbinder colourway is Serpent.
--  * Expedited delivery takes 2 days (Mon 26 Oct + 2 = Wed 28 Oct); free standard takes 5-7 days (Amendment 6).
--    Nitro Alternator has the same expedited terms.
update products set colour = 'Serpent', expedited_delivery_days = 2 where id = ${q(BURTON_ID)}::uuid;
update products set expedited_delivery_days = 2 where id = ${q(NITRO_ID)}::uuid;
update products set standard_delivery_days = 5 + (sort_order % 3) where standard_shipping_cents = 0 and expedited_shipping_cents is null;

${body}

-- The next chained entry gets chain_seq ${last + 1}.
select setval('chain_seq_gen', ${last}, true);

commit;
`
}

if (process.argv[1] && process.argv[1].endsWith('seed-dashboard-demo.ts')) {
  buildSeed().then(({ sql }) => {
    writeFileSync(fileURLToPath(new URL('../supabase/seed_dashboard_demo.sql', import.meta.url)), sql)
    console.log(`Wrote supabase/seed_dashboard_demo.sql (${records.length} rows)`)
  })
}
