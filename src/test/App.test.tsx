import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../types'

// The Supabase client is replaced by a stub that returns whatever each test sets.
// These rows are TEST fixtures only; the app itself contains no product data.
type Result = { data: unknown; error: { message: string } | null }
let nextResult: Result = { data: [], error: null }
let hang = false

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          then: (ok: (r: Result) => void) => {
            if (!hang) ok(nextResult)
          },
        }),
      }),
    }),
  },
}))

import App from '../App'

function row(over: Partial<Product>): Product {
  return {
    id: crypto.randomUUID(),
    merchant_id: 'm1',
    name: 'X',
    brand: 'BRAND',
    category: 'snowboard',
    size_cm: 150,
    colour: 'Blue',
    price_cents: 10000,
    currency: 'USD',
    image_url: null,
    marketing_blurb: null,
    formal_returns: 'free',
    formal_terms_text: 'Free returns (30-day).',
    terms_version: 'v1',
    standard_shipping_cents: 0,
    standard_delivery_days: 3,
    expedited_shipping_cents: 5000,
    expedited_delivery_days: 1,
    featured: false,
    sort_order: 0,
    ...over,
  }
}

const SEVEN: Product[] = [
  row({ name: 'Ridgeline Freestyle Snowboard', brand: 'NORTHRIDGE', size_cm: 155, colour: 'Blue', price_cents: 45900, formal_returns: 'final_sale', formal_terms_text: 'Final sale. No returns.', marketing_blurb: 'Easy returns. Park board.', featured: true, sort_order: 1 }),
  row({ name: 'Powderline All-Mountain Snowboard', brand: 'HALDEN', size_cm: 162, colour: 'Black/Red', price_cents: 48900, sort_order: 2 }),
  row({ name: 'Glacier Cruiser Snowboard', brand: 'COLDWATER', size_cm: 148, colour: 'Grey', price_cents: 42900, sort_order: 3 }),
  row({ name: 'Summit Powder Snowboard', brand: 'PEAKFORGE', size_cm: 165, colour: 'White', price_cents: 54900, formal_returns: 'final_sale', formal_terms_text: 'Final sale. No returns.', sort_order: 4 }),
  row({ name: 'Alpine Pro Skis', brand: 'ARCLINE', category: 'ski', size_cm: 170, colour: 'Red', price_cents: 64900, sort_order: 5 }),
  row({ name: 'Trailblazer Skis', brand: 'KESTREL', category: 'ski', size_cm: 160, colour: 'Blue', price_cents: 59900, formal_returns: 'final_sale', formal_terms_text: 'Final sale. No returns.', sort_order: 6 }),
  row({ name: 'Backcountry Skis', brand: 'WILDERNEST', category: 'ski', size_cm: 178, colour: 'Black', price_cents: 72900, sort_order: 7 }),
]

beforeEach(() => {
  hang = false
  nextResult = { data: [], error: null }
})

describe('Store view', () => {
  it('shows a loading state, not products, while the read is pending', () => {
    hang = true
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    expect(screen.queryAllByTestId('product-card')).toHaveLength(0)
  })

  it('shows an empty state and invents nothing when the table is empty', async () => {
    nextResult = { data: [], error: null }
    render(<App />)
    expect(await screen.findByText(/no products in the store yet/i)).toBeInTheDocument()
    expect(screen.queryAllByTestId('product-card')).toHaveLength(0)
  })

  it('shows the database error and no fallback products when the read fails', async () => {
    nextResult = { data: null, error: { message: "Could not find the table 'public.products'" } }
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not find the table 'public.products'")
    expect(screen.queryAllByTestId('product-card')).toHaveLength(0)
  })

  it('renders header, headings and exactly the 7 products in order', async () => {
    nextResult = { data: SEVEN, error: null }
    render(<App />)
    await screen.findAllByTestId('product-card')

    expect(screen.getByText('Northwind Outfitters')).toBeInTheDocument()
    expect(screen.getByText('Soar new heights')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ski' })).toHaveAttribute('href', '#ski')
    expect(screen.getByRole('link', { name: 'Snowboard' })).toHaveAttribute('href', '#snowboard')
    expect(screen.getByTestId('cart-indicator')).toHaveTextContent('Cart 0 items')

    const headings = screen.getAllByRole('heading', { level: 1 }).concat(screen.getAllByRole('heading', { level: 2 }))
    expect(headings.map((h) => h.textContent)).toEqual(['Snowboard and Ski Gear', 'Snowboard', 'Ski'])

    const cards = screen.getAllByTestId('product-card')
    expect(cards).toHaveLength(7)
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Ridgeline Freestyle Snowboard',
      'Powderline All-Mountain Snowboard',
      'Glacier Cruiser Snowboard',
      'Summit Powder Snowboard',
      'Alpine Pro Skis',
      'Trailblazer Skis',
      'Backcountry Skis',
    ])

    const first = within(cards[0])
    expect(first.getByText('NORTHRIDGE')).toBeInTheDocument()
    expect(first.getByText('Featured')).toBeInTheDocument()
    expect(first.getByText('155cm · Blue')).toBeInTheDocument()
    expect(first.getByText('$459')).toBeInTheDocument()
    expect(first.getByText('Final sale')).toBeInTheDocument()
    expect(first.getByRole('button', { name: /view details/i })).toBeInTheDocument()
    expect(first.getByRole('button', { name: /add .* to cart/i })).toBeInTheDocument()

    expect(within(cards[1]).getByText('Free returns')).toBeInTheDocument()
    expect(within(cards[1]).getByText('162cm · Black/Red')).toBeInTheDocument()
    expect(screen.getAllByText('Featured')).toHaveLength(1)
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('counts cart additions and opens an accessible details dialog', async () => {
    nextResult = { data: SEVEN, error: null }
    const user = userEvent.setup()
    render(<App />)
    const cards = await screen.findAllByTestId('product-card')

    await user.click(within(cards[0]).getByRole('button', { name: /add .* to cart/i }))
    expect(screen.getByTestId('cart-indicator')).toHaveTextContent('Cart 1 item')
    await user.click(within(cards[1]).getByRole('button', { name: /add .* to cart/i }))
    expect(screen.getByTestId('cart-indicator')).toHaveTextContent('Cart 2 items')

    await user.click(within(cards[0]).getByRole('button', { name: /view details/i }))
    const dialog = screen.getByRole('dialog', { name: 'Ridgeline Freestyle Snowboard' })
    expect(within(dialog).getByText('Final sale. No returns.')).toBeInTheDocument()
    expect(within(dialog).getByText(/Standard: Free, 3 days/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Expedited: \$50, 1 day/)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses the light retail theme: no dashboard colour tokens or navy/teal values in the store source', () => {
    const dir = join(__dirname, '..', 'components')
    const dashboardLook = /dash-|teal|card-raised|bg-card|border-edge|text-ink|text-body|text-label|#0a1128|#0b0f1a|#16233a|#1e2a44|#26365e|#2dd4bf/i
    const files = readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const)
    files.push(['App.tsx', readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')])
    for (const [name, text] of files) {
      expect(text, name).not.toMatch(dashboardLook)
    }
    expect(readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8')).toMatch(/color-scheme" content="light"/)
    expect(readFileSync(join(__dirname, '..', 'index.css'), 'utf8')).toMatch(/body\s*{[^}]*background:\s*#ffffff/)
  })

  it('has no links out of the store, and its source never mentions other views', () => {
    const dir = join(__dirname, '..', 'components')
    const forbidden = /dashboard|grant|receipt|tamper|dispute|verdict|\/admin/i
    for (const file of readdirSync(dir)) {
      const text = readFileSync(join(dir, file), 'utf8')
      expect(text, file).not.toMatch(forbidden)
    }
    const app = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')
    // App.tsx may only mention the other views inside the one explanatory comment.
    const withoutComments = app.replace(/\/\/.*$/gm, '')
    expect(withoutComments).not.toMatch(forbidden)
  })
})
