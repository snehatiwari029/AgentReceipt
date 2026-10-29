import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NINE } from './fixtures'
import { fakeClient, mock, type Result } from './mockSupabase'
import { buildSeed } from '../../scripts/seed-dashboard-demo'

vi.mock('../shared/supabase', () => ({ supabase: fakeClient }))

import AppRoutes from '../app/AppRoutes'
import { runScan } from '../../supabase/functions/optimizer/run'
import { BURTON, NW, world } from './optimizerFixtures'
import type { Receipt } from '../shared/schemas'

// Test only: the rows the seed script generates are served by the fake database,
// exactly as they would come back from the real tables.
let SEEDED: Record<string, Result> = {}
beforeAll(async () => {
  const { records } = await buildSeed()
  const by = (t: string) => ({ data: records.filter((r) => r.table === t).map((r) => r.row), error: null })
  SEEDED = {
    sessions: by('sessions'), grants: by('grants'), proposals: by('proposals'), actions: by('actions'),
    receipts: by('receipts'), disputes: by('disputes'), dispute_events: by('dispute_events'), products: { data: NINE, error: null },
  }
})

const open = (path: string) => {
  sessionStorage.setItem('agentreceipt-demo-merchant', 'yes')
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mock.hang = false
  mock.next = { data: [], error: null }
  mock.tables = {}
})

describe('Dashboard pages: empty and error states', () => {
  it.each([
    ['/dashboard/orders', /no agent orders yet/i],
    ['/dashboard/disputes', /no disputes yet/i],
    ['/dashboard/tamper', /the chain is empty/i],
  ])('%s shows a proper empty state, not fake rows or a placeholder', async (path, text) => {
    open(path)
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByText(/not built yet/i)).not.toBeInTheDocument()
  })

  it('shows the database error instead of fallback data', async () => {
    mock.next = { data: null, error: { message: 'permission denied for table receipts' } }
    open('/dashboard/orders')
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied for table receipts')
  })
})

describe('Dashboard pages with the seeded rows (read live from the tables)', () => {
  beforeEach(() => {
    mock.tables = SEEDED
  })

  it('Agent orders shows 12322, 13422 and 14522 with customer, verified-simulated agent, status and dispute', async () => {
    const user = userEvent.setup()
    open('/dashboard/orders')
    const hero = (await screen.findByText('12322')).closest('tr')!
    expect(within(hero).getByText('AR-2026-0042')).toBeInTheDocument()
    expect(within(hero).getByText('Jemaih Soresky')).toBeInTheDocument()
    expect(within(hero).getByText('meta-muse-j0376672 (verified, simulated)')).toBeInTheDocument()
    expect(within(hero).getByText('Confirmed')).toBeInTheDocument()
    // the hero is Review Required and NOT a dispute
    expect(within(hero).getByText('Review Required')).toBeInTheDocument()
    expect(within(hero).queryByText('Dispute received')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Orders requiring attention: 2')
    expect(within(hero).getByText('$509.95')).toBeInTheDocument()

    const b = screen.getByText('13422').closest('tr')!
    expect(within(b).getByText('Ivan Dijkstra')).toBeInTheDocument()
    expect(within(b).getByText('$489.83')).toBeInTheDocument()
    expect(within(b).getByText('Won')).toBeInTheDocument()

    const gap = screen.getByText('14522').closest('tr')!
    expect(within(gap).getByText('Unverified agent, no AgentReceipt session opened, no receipt (gap recorded)')).toBeInTheDocument()
    expect(within(gap).getByText('Hold for Suspicion')).toBeInTheDocument()
    expect(within(gap).queryByRole('button')).not.toBeInTheDocument()
    expect(within(b).getByText('Pass')).toBeInTheDocument()

    await user.click(within(hero).getByRole('button', { name: /show check/i }))
    const th = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(th).toEqual(expect.arrayContaining(['Field', 'Grant', 'Merchant terms', 'Actual', 'Match', 'Cause', 'Next action / Who acts']))
    expect(screen.queryByRole('columnheader', { name: /liab/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('✕ Mismatch')).toHaveLength(2)
    expect(screen.getByText(/does not decide liability and no network rule moves liability on this screen/i)).toBeInTheDocument()
    expect(screen.getByText(/VI-aligned demo representation/)).toBeInTheDocument()
  })

  it('Home shows the 4 stat cards in one row; Orders requiring attention is live (Review Required + Hold for Suspicion only) and links to the orders page', async () => {
    open('/dashboard')
    const card = await screen.findByTestId('stat-attention')
    expect(card).toHaveAttribute('href', '/dashboard/orders')
    // seed: 12322 Review Required + 14522 Hold for Suspicion. Pass orders 13422 and 0041 are not counted.
    await vi.waitFor(() => expect(card).toHaveTextContent(/^Orders requiring attention2/))
    expect(screen.getByTestId('stat-store-health')).toHaveTextContent('86/100')
    expect(screen.getByTestId('stat-profit')).toHaveTextContent('$18,400')
    expect(screen.getByTestId('stat-agent-profit')).toHaveTextContent('$7,920 (43%)')
    const row = screen.getByRole('region', { name: 'Store summary' })
    expect(row.children).toHaveLength(4)
    expect(row.className).toMatch(/lg:grid-cols-4/)
  })

  it('Home count follows the data: a second Review Required order makes it 3', async () => {
    const extra = (SEEDED.receipts.data as Receipt[]).find((r) => r.receipt_ref === 'AR-2026-0042')!
    mock.tables = { ...SEEDED, receipts: { data: [...(SEEDED.receipts.data as Receipt[]), { ...extra, id: 'extra-1', receipt_ref: 'AR-2026-0044', order_ref: '15001', chain_seq: 99 }], error: null } }
    open('/dashboard')
    await vi.waitFor(() => expect(screen.getByTestId('stat-attention')).toHaveTextContent(/^Orders requiring attention3/))
  })

  it('Agent orders: the Product row names the actual product with the scope in brackets (display only)', async () => {
    const user = userEvent.setup()
    open('/dashboard/orders')
    const hero = (await screen.findByText('12322')).closest('tr')!
    await user.click(within(hero).getByRole('button', { name: /show check/i }))
    expect(screen.getByText('Burton Spellbinder Snowboard 2026/2027 (snowboard)')).toBeInTheDocument()
    expect(within(hero).getByText('Review Required')).toBeInTheDocument()
    expect(screen.getByText('2 problems found', { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /hide check/i }))
    const orca = screen.getByText('13422').closest('tr')!
    await user.click(within(orca).getByRole('button', { name: /show check/i }))
    expect(screen.getByText('Lib Tech T. Rice Orca Snowboard 2025/2026 (snowboard)')).toBeInTheDocument()
    expect(within(orca).getByText('Pass')).toBeInTheDocument()
    expect(within(orca).getByText('$489.83')).toBeInTheDocument()
  })

  it('Disputes shows only the separate Orca order 13422 (won, clean receipt); the Review Required hero is not a dispute', async () => {
    open('/dashboard/disputes')
    expect(await screen.findByText('AR-2026-0043')).toBeInTheDocument()
    expect(screen.queryByText('AR-2026-0042')).not.toBeInTheDocument()
    expect(screen.getAllByText('Won').length).toBeGreaterThan(0)
    expect(screen.getByText(/Claimed agent overstep/)).toBeInTheDocument()
    expect(screen.getByText('0 problems found')).toBeInTheDocument()
    expect(screen.getAllByText('– Not specified').length).toBeGreaterThan(0)
  })

  it('Tamper: the original verifies, and the tampered copy of AR-2026-0041 ($449.95 to $44.99) visibly fails', async () => {
    const user = userEvent.setup()
    open('/dashboard/tamper')
    await user.click(await screen.findByRole('button', { name: 'Verify chain' }))
    expect(await screen.findByText(/original verified: 16 entries/i)).toBeInTheDocument()

    expect(screen.getByRole('option', { name: 'AR-2026-0041', selected: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tamper with the amount' }))
    expect(await screen.findByText(/tampered copy fails verification/i)).toBeInTheDocument()
    expect(screen.getByText(/AR-2026-0041: \$449\.95/)).toHaveTextContent('$44.99')
    expect(screen.getByText(/no longer matches its hash/i)).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('✕ Content changed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('No tampering yet.')).toBeInTheDocument()
  })
})

describe('Optimization for Agents', () => {
  const NORTHWIND = { data: [{ id: NW, name: 'Northwind Outfitters' }], error: null }
  // A real scan, run by the optimizer's own code over the test copy of the 9 Northwind rows, served as table rows.
  async function scanned() {
    const w = world()
    await runScan({ merchant_id: NW }, w.deps)
    mock.tables = {
      merchants: NORTHWIND,
      optimizer_scans: { data: w.tables.optimizer_scans, error: null },
      optimizer_suggestions: { data: w.tables.optimizer_suggestions, error: null },
      receipts: SEEDED.receipts,
    }
    return w
  }
  let calls: { url: string; body: Record<string, unknown> }[] = []
  beforeEach(() => {
    calls = []
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.test')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      calls.push({ url, body })
      const reply = body.action === 'approve_all' ? { type: 'approve_all', approved: 1, skipped_unfilled: 2, skipped_not_pending: 0 }
        : body.action === 'decide' ? { type: 'decision', suggestion_id: body.suggestion_id, status: 'approved' }
          : { type: 'scan', scan_id: 's', listings_scanned: 9, flags: 1, resolved: 0, still_flagged: 0, markup_status: 'fetched', spark: {} }
      return new Response(JSON.stringify(reply))
    }))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('before any scan shows Scan Now and an empty state, not seeded checklist text', async () => {
    mock.tables = { merchants: NORTHWIND }
    open('/dashboard/optimization')
    expect(await screen.findByRole('heading', { name: 'Optimization for Agents' })).toBeInTheDocument()
    expect(await screen.findByText('No scan yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan Now' })).toBeInTheDocument()
    expect(screen.queryByTestId('optimizer-listing')).not.toBeInTheDocument()
  })

  it('Scan Now calls the optimizer function with this merchant only', async () => {
    const user = userEvent.setup()
    mock.tables = { merchants: NORTHWIND }
    open('/dashboard/optimization')
    await user.click(await screen.findByRole('button', { name: 'Scan Now' }))
    expect(calls).toEqual([{ url: 'https://project.test/functions/v1/optimizer', body: { action: 'scan', merchant_id: NW } }])
    expect(await screen.findByText(/Scan finished: 9 listings/)).toBeInTheDocument()
  })

  it('shows the scan: header, summary, 9 listing rows, and the Spellbinder worked example open', async () => {
    await scanned()
    open('/dashboard/optimization')
    expect(await screen.findAllByTestId('optimizer-listing')).toHaveLength(9)
    const header = screen.getByRole('region', { name: 'Optimizer header' })
    expect(header).toHaveTextContent('Northwind Outfitters')
    expect(within(header).getByRole('link', { name: 'View Store' })).toHaveAttribute('href', '/shop')
    expect(screen.getByText('Listings scanned').nextSibling).toHaveTextContent('9')
    expect(screen.getByText('Top priority').nextSibling).toHaveTextContent(/^Contradictions first$/)
    expect(screen.getAllByText('Pillar 2: Contradiction — Marketing "Easy returns." vs formal terms "Final Sale"')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Hide checklist' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Show checklist and fixes' })).toHaveLength(8)
  })

  it('shows no Order check linkage: no order numbers, mismatch counts, "linked to" tags or caused-mismatch filter', async () => {
    const user = userEvent.setup()
    await scanned()
    open('/dashboard/optimization')
    await screen.findAllByTestId('optimizer-listing')
    for (const b of screen.getAllByRole('button', { name: 'Show checklist and fixes' })) await user.click(b) // open every listing
    expect(await screen.findAllByRole('button', { name: 'Hide checklist' })).toHaveLength(9)
    const text = screen.getByRole('main').textContent ?? '' // the page itself; the sidebar nav still links to Disputes
    for (const banned of ['12322', '13422', '14522', '15001', '15002', 'Budget mismatches', 'Returns mismatches', 'Open Agent orders']) expect(text).not.toContain(banned)
    expect(text).not.toMatch(/linked to|caused a real order mismatch|review required|chargeback|dispute/i)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('Approve All says it applies nothing, and sends only the pending suggestions shown', async () => {
    const user = userEvent.setup()
    const w = await scanned()
    open('/dashboard/optimization')
    await screen.findAllByTestId('optimizer-listing')
    expect(screen.getByText(/It does not apply them: no listing, price, term or page\s+changes/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Flag type'), 'contradiction')
    await user.click(screen.getByRole('button', { name: /^Approve All/ }))
    const sent = calls[0].body.suggestion_ids as string[]
    expect(calls[0].body.action).toBe('approve_all')
    expect(sent).toEqual([w.find(BURTON, 'p2.returns').id])
    expect(await screen.findByText(/2 left pending because a To-be-filled field is empty. Nothing in your store was changed./)).toBeInTheDocument()
  })

  it('Approve with an empty To-be-filled field sends nothing and outlines each empty field in red', async () => {
    const user = userEvent.setup()
    const w = await scanned()
    open('/dashboard/optimization')
    const spell = (await screen.findAllByTestId('optimizer-listing'))[0]
    const ids = within(spell).getAllByTestId('optimizer-suggestion').find((el) => el.textContent?.includes('Missing identifiers'))!
    const field = (f: string) => within(ids).getByLabelText(new RegExp(`^To be filled by merchant: ${f}`))
    expect(field('GTIN')).toHaveValue('')
    expect(field('GTIN')).toHaveAccessibleName('To be filled by merchant: GTIN (required to approve)')
    expect(field('GTIN')).not.toHaveAttribute('aria-invalid', 'true') // not red before the merchant tries

    await user.type(field('MPN'), 'M1')
    await user.click(within(ids).getByRole('button', { name: 'Approve' }))
    expect(calls).toHaveLength(0) // nothing sent
    expect(within(ids).getByRole('alert')).toHaveTextContent('Fill GTIN, SKU before approving. The optimizer never fills a missing value.')
    for (const f of ['GTIN', 'SKU']) {
      expect(field(f)).toHaveAttribute('aria-invalid', 'true')
      expect(field(f)).toHaveClass('border-dash-violation')
    }
    expect(field('MPN')).not.toHaveClass('border-dash-violation')
    expect(field('GTIN')).toHaveFocus()
    expect(within(ids).getAllByText('Required before approving.')).toHaveLength(2)

    await user.type(field('GTIN'), '0123')
    expect(field('GTIN')).not.toHaveClass('border-dash-violation') // red clears as soon as it is filled
    await user.type(field('SKU'), 'S1')
    await user.click(within(ids).getByRole('button', { name: 'Approve' }))
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toMatchObject({ action: 'decide', suggestion_id: w.find(BURTON, 'p1.identifiers').id, decision: 'approve', values: { GTIN: '0123', MPN: 'M1', SKU: 'S1' } })
  })

  it('Approve All counts only what it will approve; suggestions needing a value are counted separately and not sent', async () => {
    const user = userEvent.setup()
    const w = await scanned()
    open('/dashboard/optimization')
    await screen.findAllByTestId('optimizer-listing')
    const pending = w.tables.optimizer_suggestions
    const ready = pending.filter((s) => s.value_fields.length === 0)
    expect(screen.getByRole('button', { name: /^Approve All/ })).toHaveTextContent(`Approve All (${ready.length})`)
    expect(screen.getByTestId('approve-all-skipped')).toHaveTextContent(`${pending.length - ready.length} more pending suggestions shown need a To-be-filled value first and will stay pending.`)

    await user.selectOptions(screen.getByLabelText('Flag type'), 'missing') // the count follows the filter
    const readyMissing = ready.filter((s) => s.flag_type === 'missing')
    expect(screen.getByRole('button', { name: /^Approve All/ })).toHaveTextContent(`Approve All (${readyMissing.length})`)
    await user.click(screen.getByRole('button', { name: /^Approve All/ }))
    expect(new Set(calls[0].body.suggestion_ids as string[])).toEqual(new Set(readyMissing.map((s) => s.id)))
  })

  it('filters by pillar and flag type only', async () => {
    const user = userEvent.setup()
    await scanned()
    open('/dashboard/optimization')
    await screen.findAllByTestId('optimizer-listing')
    await user.selectOptions(screen.getByLabelText('Flag type'), 'contradiction')
    expect(screen.getAllByTestId('optimizer-listing')).toHaveLength(1)
    await user.selectOptions(screen.getByLabelText('Flag type'), 'all')
    await user.selectOptions(screen.getByLabelText('Pillar'), '1')
    expect(screen.getAllByTestId('optimizer-listing')).toHaveLength(9)
    await user.selectOptions(screen.getByLabelText('Flag type'), 'contradiction')
    expect(screen.getByText('No listings match these filters.')).toBeInTheDocument() // Pillar 1 has no contradiction here
    await user.selectOptions(screen.getByLabelText('Pillar'), '2')
    expect(screen.getAllByTestId('optimizer-listing')).toHaveLength(1)
    expect(within(screen.getByRole('group', { name: 'Filters' })).getAllByRole('combobox')).toHaveLength(2)
  })

})
