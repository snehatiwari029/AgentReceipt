import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NINE } from './fixtures'
import { fakeClient, mock, type Result } from './mockSupabase'
import { buildSeed } from '../../scripts/seed-dashboard-demo'

vi.mock('../shared/supabase', () => ({ supabase: fakeClient }))

import AppRoutes from '../app/AppRoutes'
import { causeCounts, contradictingProducts } from '../dashboard/pages/Optimization'
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

describe('Optimization', () => {
  it('flags a product page that mentions returns while the terms say final sale, from live products', async () => {
    mock.tables = { products: { data: NINE, error: null } }
    open('/dashboard/optimization')
    expect(await screen.findByText(/Burton Spellbinder/)).toBeInTheDocument()
    expect(screen.getByText('Easy returns.')).toBeInTheDocument()
    expect(contradictingProducts(NINE)).toHaveLength(1)
  })

  it('counts mismatch causes only for mismatches', () => {
    const r = { mismatch_results: [
      { field: 'Budget', result: 'mismatch', cause: 'Cap read as item-only' },
      { field: 'Colour', result: 'unspecified', cause: null },
    ] } as unknown as Receipt
    expect(causeCounts([r, r])).toEqual([{ field: 'Budget', cause: 'Cap read as item-only', count: 2 }])
  })
})
