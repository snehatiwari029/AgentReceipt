import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NINE } from './fixtures'
import { fakeClient, mock } from './mockSupabase'
import { CHAIN } from './chain.test'

vi.mock('../shared/supabase', () => ({ supabase: fakeClient }))

import AppRoutes from '../app/AppRoutes'
import { causeCounts, contradictingProducts } from '../dashboard/pages/Optimization'
import type { Receipt } from '../shared/schemas'

const h = (c: string) => `sha256:${c.repeat(64)}` as const

// TEST fixture only. The app contains no receipt data: it reads the receipts table.
const RECEIPT = {
  id: 'r1',
  receipt_ref: 'TEST-0001',
  order_ref: '1',
  grant_id: 'g1',
  proposal_id: null,
  merchant_id: 'm1',
  terms_snapshot: {},
  action_summary: { product_name: 'Test Board', total_cents: 50995 },
  mismatch_results: [
    { field: 'Budget', grant: '$500.00', merchant_terms: '–', actual: '$509.95', result: 'mismatch', cause: 'Cap read as item-only', next_action_who: 'Merchant concedes', cited_fields: [] },
    { field: 'Colour', grant: null, merchant_terms: null, actual: 'Blue/Black', result: 'unspecified', cause: null, next_action_who: null, cited_fields: [] },
  ],
  problems_found: 1,
  recommendation: 'concede',
  missing_components: [],
  image_evidence_ref: null,
  schema_label: 'VI-aligned demo representation',
  chain_seq: 4,
  prev_hash: h('c'),
  entry_hash: h('d'),
} as unknown as Receipt

const open = async (path: string) => {
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

describe('Dashboard pages read live data and show empty states', () => {
  it.each([
    ['/dashboard/orders', /no agent orders yet/i],
    ['/dashboard/disputes', /no disputes yet/i],
    ['/dashboard/tamper', /the chain is empty/i],
  ])('%s shows an empty state, not fake rows or a placeholder', async (path, text) => {
    await open(path)
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByText(/not built yet/i)).not.toBeInTheDocument()
  })

  it('shows the database error instead of fallback data', async () => {
    mock.next = { data: null, error: { message: 'permission denied for table receipts' } }
    await open('/dashboard/orders')
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied for table receipts')
  })

  it('Agent orders lists a receipt and opens its line-by-line check', async () => {
    mock.tables = { receipts: { data: [RECEIPT], error: null } }
    const user = userEvent.setup()
    await open('/dashboard/orders')
    expect(await screen.findByText('TEST-0001')).toBeInTheDocument()
    expect(screen.getByText('$509.95')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /show check/i }))
    expect(screen.getByRole('columnheader', { name: 'Next action / Who acts' })).toBeInTheDocument()
    expect(screen.getByText('✕ Mismatch')).toBeInTheDocument()
    expect(screen.getByText('– Not specified')).toBeInTheDocument()
    expect(screen.getByText(/does not decide liability/i)).toBeInTheDocument()
  })

  it('Optimization flags a product page that mentions returns while terms say final sale, from live products', async () => {
    mock.tables = { products: { data: NINE, error: null } }
    await open('/dashboard/optimization')
    const item = await screen.findByText(/Burton Spellbinder/)
    expect(item).toBeInTheDocument()
    expect(screen.getByText('Easy returns.')).toBeInTheDocument()
    expect(contradictingProducts(NINE)).toHaveLength(1)
  })

  it('counts mismatch causes only for mismatches', () => {
    expect(causeCounts([RECEIPT, RECEIPT])).toEqual([{ field: 'Budget', cause: 'Cap read as item-only', count: 2 }])
  })

  it('Tamper: verifies an intact chain, then fails visibly after the tamper button', async () => {
    mock.tables = { chain_entries: { data: CHAIN, error: null } }
    const user = userEvent.setup()
    await open('/dashboard/tamper')
    await user.click(await screen.findByRole('button', { name: 'Verify chain' }))
    expect(screen.getByText(/chain intact: 4 entries/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tamper with this entry' }))
    expect(screen.getByText(/not verified yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Verify chain' }))
    expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('✕ Broken')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Verify chain' }))
    expect(screen.getByText(/chain intact/i)).toBeInTheDocument()
  })
})
