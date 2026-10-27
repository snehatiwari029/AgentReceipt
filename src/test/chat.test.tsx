import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ChatApp from '../chat/ChatApp'
import EntryPage from '../app/EntryPage'

const HERO = "Help me place an order for a snowboard for this weekend trip with my friends. Budget under $500."
const view = [{ label: 'Store', value: 'Northwind Outfitters' }, { label: 'Budget', value: 'Under $500.00' }, { label: 'Colour', value: 'Not specified' }]
const offers = [
  { product_id: 'p1', name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Serpent', price_cents: 44995, summary: 'Easy returns', delivery_label: 'Fri Oct 30', delivery_date: '2026-10-30', shipping_method: 'expedited', shown_at: '2026-10-26T18:00:00.000Z' },
  { product_id: 'p2', name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech', size_cm: 156, colour: null, price_cents: 48983, summary: 'Free returns', delivery_label: 'Thu Oct 29', delivery_date: '2026-10-29', shipping_method: 'standard', shown_at: '2026-10-26T18:00:00.000Z' },
]

let calls: { url: string; headers: Record<string, string>; body: any }[]
let replies: unknown[]

beforeEach(() => {
  calls = []
  replies = []
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) })
    return new Response(JSON.stringify(replies.shift()), { status: 200 })
  }))
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('/chat phone screen', () => {
  it('is a phone frame with the Muse header inside it', () => {
    render(<ChatApp />)
    const frame = screen.getByTestId('phone-frame')
    expect(frame).toContainElement(screen.getByRole('heading', { name: 'Muse' }))
    expect(frame).toContainElement(screen.getByLabelText('Message Muse'))
  })

  it('runs the whole hero conversation by calling only the shopper-agent function', async () => {
    const user = userEvent.setup()
    replies = [
      { type: 'confirm_rules', text: "Here's what I understood.", draft: { budget_max_cents: 50000 }, view, steps: ['Muse is checking: Reading your request'] },
      { type: 'proposals', session_id: 's-1', text: 'Two good options.', offers, steps: ['Muse is checking: Looking at snowboards'] },
      { type: 'ordered', session_id: 's-1', text: 'Your order is placed.', order: { product_name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Serpent', item_price_cents: 44995, shipping_label: 'Expedited shipping', shipping_cents: 6000, total_cents: 50995, delivery_label: 'Fri Oct 30', payment_label: 'Demo PayPal' } },
    ]
    render(<ChatApp />)
    await user.type(screen.getByLabelText('Message Muse'), HERO)
    await user.click(screen.getByRole('button', { name: 'Send' }))

    // confirmation screen with "your order rules", status line, then Looks right
    expect(await screen.findByLabelText('Your order rules')).toBeInTheDocument()
    expect(screen.getByText('Muse is checking: Reading your request')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Looks right' }))

    // proposal cards: price, summary, delivery day. No total.
    const burton = await screen.findByLabelText('Spellbinder Snowboard 2026/2027')
    expect(burton).toHaveTextContent('$449.95')
    expect(burton).toHaveTextContent('Easy returns')
    expect(burton).toHaveTextContent('Arrives Fri Oct 30')
    expect(burton).not.toHaveTextContent(/509|total|final/i)

    await user.click(burton.querySelector('button')!)
    const order = await screen.findByLabelText('Order confirmation')
    expect(order).toHaveTextContent('$509.95')
    expect(order).toHaveTextContent('Demo PayPal')
    expect(screen.getByLabelText('Message Muse')).toBeDisabled()

    // every call went to the one function, with the publishable key only
    expect(calls.map((c) => c.url)).toEqual(Array(3).fill('https://example.supabase.co/functions/v1/shopper-agent'))
    expect(calls[0].headers.apikey).toBe('sb_publishable_test')
    expect(calls[0].body.messages.at(-1)).toEqual({ role: 'user', text: HERO })
    expect(calls[1].body).toMatchObject({ confirm: true, draft: { budget_max_cents: 50000 } })
    // the order message carries the session and the full offers back, unchanged
    expect(calls[2].body.session_id).toBe('s-1')
    expect(calls[2].body.offers).toEqual(offers)
    expect(calls[2].body.messages.at(-1).text).toMatch(/^Order it: the Burton Spellbinder/)
    // status lines are display only: never sent back as chat
    expect(JSON.stringify(calls[2].body.messages)).not.toContain('Muse is checking')

    // nothing on the phone talks about the merchant side
    expect(screen.getByTestId('phone-frame').textContent).not.toMatch(/dashboard|grant|receipt|tamper|dispute|verdict/i)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('shows a plain message when Muse answers with an error', async () => {
    const user = userEvent.setup()
    replies = [{ type: 'error', message: 'MODEL_API_KEY not set in Supabase secrets' }]
    render(<ChatApp />)
    await user.type(screen.getByLabelText('Message Muse'), 'hi')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('MODEL_API_KEY not set in Supabase secrets'))
  })
})

describe('Entry page', () => {
  it('has three separate doors, one per audience', () => {
    render(<MemoryRouter><EntryPage /></MemoryRouter>)
    const link = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href')
    expect(link(/Customer phone/)).toBe('/chat')
    expect(link(/Northwind store/)).toBe('/shop')
    expect(link(/Merchant dashboard/)).toBe('/dashboard')
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})
