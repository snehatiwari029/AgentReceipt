import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NINE } from './fixtures'
import { fakeClient, mock } from './mockSupabase'

vi.mock('../shared/supabase', () => ({ supabase: fakeClient }))

import ShopApp from '../shop/ShopApp'

beforeEach(() => {
  mock.hang = false
  mock.next = { data: [], error: null }
})

describe('Shop', () => {
  it('shows a loading state, not products, while the read is pending', () => {
    mock.hang = true
    render(<ShopApp />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    expect(screen.queryAllByTestId('product-card')).toHaveLength(0)
  })

  it('shows an empty state and invents nothing when the table is empty', async () => {
    render(<ShopApp />)
    expect(await screen.findByText(/no products in the store yet/i)).toBeInTheDocument()
    expect(screen.queryAllByTestId('product-card')).toHaveLength(0)
  })

  it('shows the database error and no fallback products when the read fails', async () => {
    mock.next = { data: null, error: { message: "Could not find the table 'public.products'" } }
    render(<ShopApp />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not find the table 'public.products'")
    expect(screen.queryAllByTestId('product-card')).toHaveLength(0)
  })

  it('renders the header, headings, 6 snowboards then 3 skis, Burton Spellbinder first and Featured', async () => {
    mock.next = { data: NINE, error: null }
    render(<ShopApp />)
    await screen.findAllByTestId('product-card')

    expect(screen.getByText('Northwind Outfitters')).toBeInTheDocument()
    expect(screen.getByText('Soar new heights')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ski' })).toHaveAttribute('href', '#ski')
    expect(screen.getByRole('link', { name: 'Snowboard' })).toHaveAttribute('href', '#snowboard')
    expect(screen.getByTestId('cart-indicator')).toHaveTextContent('Cart 0 items')
    // brand, tagline, Ski, Snowboard: those are the only links in the shop
    expect(screen.getAllByRole('link')).toHaveLength(2)

    const headings = screen.getAllByRole('heading', { level: 1 }).concat(screen.getAllByRole('heading', { level: 2 }))
    expect(headings.map((h) => h.textContent)).toEqual(['Snowboard and Ski Gear', 'Snowboard', 'Ski'])

    const cards = screen.getAllByTestId('product-card')
    expect(cards).toHaveLength(9)
    const boards = within(screen.getByRole('heading', { level: 2, name: 'Snowboard' }).closest('section')!).getAllByTestId('product-card')
    const skis = within(screen.getByRole('heading', { level: 2, name: 'Ski' }).closest('section')!).getAllByTestId('product-card')
    expect(boards).toHaveLength(6)
    expect(skis).toHaveLength(3)

    const first = within(cards[0])
    expect(first.getByRole('heading', { level: 3 })).toHaveTextContent('Spellbinder Snowboard 2026/2027')
    expect(first.getByText('Burton')).toBeInTheDocument()
    expect(first.getByText('Featured')).toBeInTheDocument()
    expect(first.getByText('$449.95')).toBeInTheDocument()
    expect(first.getByText('Final sale')).toBeInTheDocument()
    expect(first.getByRole('img')).toHaveAttribute('src', expect.stringContaining('/product-images/'))
    expect(screen.getAllByText('Featured')).toHaveLength(1)
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('shows no colour text for products without a colour', async () => {
    mock.next = { data: NINE, error: null }
    render(<ShopApp />)
    const cards = await screen.findAllByTestId('product-card')
    expect(within(cards[0]).getByText('156cm · Blue/Black')).toBeInTheDocument()
    expect(within(cards[1]).getByText('156cm')).toBeInTheDocument()
    expect(screen.queryByText(/null/)).not.toBeInTheDocument()
  })

  it('counts cart additions and opens an accessible details dialog', async () => {
    mock.next = { data: NINE, error: null }
    const user = userEvent.setup()
    render(<ShopApp />)
    const cards = await screen.findAllByTestId('product-card')

    await user.click(within(cards[0]).getByRole('button', { name: /add .* to cart/i }))
    expect(screen.getByTestId('cart-indicator')).toHaveTextContent('Cart 1 item')
    await user.click(within(cards[1]).getByRole('button', { name: /add .* to cart/i }))
    expect(screen.getByTestId('cart-indicator')).toHaveTextContent('Cart 2 items')

    await user.click(within(cards[0]).getByRole('button', { name: /view details/i }))
    const dialog = screen.getByRole('dialog', { name: 'Spellbinder Snowboard 2026/2027' })
    expect(within(dialog).getByText(/Standard: Free, 5 days/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Expedited: \$60, 2 days/)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
