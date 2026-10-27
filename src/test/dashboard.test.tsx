import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NINE } from './fixtures'
import { fakeClient, mock } from './mockSupabase'

vi.mock('../shared/supabase', () => ({ supabase: fakeClient }))

import AppRoutes from '../app/AppRoutes'

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )

beforeEach(() => {
  sessionStorage.clear()
  mock.hang = false
  mock.next = { data: NINE, error: null }
})

describe('Dashboard and routing', () => {
  it('/dashboard asks for the demo sign-in first, then shows the dark dashboard with all five sections', async () => {
    const user = userEvent.setup()
    at('/dashboard')
    expect(screen.getByRole('heading', { name: 'Merchant sign-in' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /sign in as demo merchant/i }))

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(await screen.findByText(/products in the store/)).toHaveTextContent('products in the store')
    const nav = screen.getByRole('navigation', { name: 'Dashboard' })
    expect(nav).toHaveTextContent('Dashboard')
    for (const label of ['Agent orders', 'Disputes', 'Optimization', 'Tamper']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('"View Store" is an internal link to /shop and opens the shop in the same app', async () => {
    const user = userEvent.setup()
    at('/dashboard')
    await user.click(screen.getByRole('button', { name: /sign in as demo merchant/i }))
    const link = screen.getByRole('link', { name: 'View Store' })
    expect(link).toHaveAttribute('href', '/shop')
    expect(link).not.toHaveAttribute('target')
    await user.click(link)
    expect(await screen.findByRole('heading', { name: 'Snowboard and Ski Gear' })).toBeInTheDocument()
    expect(await screen.findAllByTestId('product-card')).toHaveLength(9)
  })

  it('the shop has no link back to the dashboard', async () => {
    at('/shop')
    await screen.findAllByTestId('product-card')
    for (const a of screen.getAllByRole('link')) expect(a.getAttribute('href')).toMatch(/^#/)
  })

  it('unknown paths fall back to the entry page', () => {
    at('/nowhere')
    expect(screen.getByRole('heading', { name: 'AgentReceipt demo' })).toBeInTheDocument()
  })
})
