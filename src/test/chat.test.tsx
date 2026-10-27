import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ChatApp from '../chat/ChatApp'
import EntryPage from '../app/EntryPage'

const HERO = "Help me place an order for a snowboard for this weekend trip with my friends. Budget under $500."
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

  it('fills the box with the demo request when the chip is tapped', async () => {
    const user = userEvent.setup()
    render(<ChatApp />)
    await user.click(screen.getByRole('button', { name: 'Try the demo request' }))
    expect((screen.getByLabelText('Message Muse') as HTMLInputElement).value).toMatch(/^Help me place an order for a snowboard/)
  })

  it('runs the hero conversation as chat: sentence, two cards, payment question, then the order', async () => {
    const user = userEvent.setup()
    const rules = { budget_max_cents: 50000, delivery_by: '2026-10-30' }
    replies = [
      { type: 'proposals', text: 'Looking for snowboards under $500 that will arrive by Friday and that you can return. Here are two options from Northwind:', follow_up: 'Pick one, and tell me which payment to charge.', offers, draft: rules, steps: ['Muse is checking: Looking at snowboards'] },
      { type: 'ordered', session_id: 's-1', text: 'Your order is placed.', order: { product_name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Serpent', item_price_cents: 44995, shipping_label: 'Expedited shipping', shipping_cents: 6000, total_cents: 50995, delivery_label: 'Fri Oct 30', payment_label: 'Demo PayPal' } },
    ]
    render(<ChatApp />)
    await user.type(screen.getByLabelText('Message Muse'), HERO)
    await user.click(screen.getByRole('button', { name: 'Send' }))

    // no form card anywhere; a sentence, two cards, then the payment question
    const burton = await screen.findByLabelText('Spellbinder Snowboard 2026/2027')
    expect(screen.queryByLabelText('Your order rules')).toBeNull()
    expect(screen.queryByRole('button', { name: /Looks right|Change/ })).toBeNull()
    expect(screen.getByText(/Looking for snowboards under \$500/)).toBeInTheDocument()
    expect(burton).toHaveTextContent('$449.95')
    expect(burton).toHaveTextContent('Easy returns')
    expect(burton).toHaveTextContent('Arrives Fri Oct 30')
    expect(burton).not.toHaveTextContent(/509|total|final/i)
    const text = screen.getByTestId('phone-frame').textContent ?? ''
    expect(text.indexOf('Here are two options')).toBeLessThan(text.indexOf('Spellbinder'))
    expect(text.indexOf('Orca')).toBeLessThan(text.indexOf('Pick one, and tell me which payment to charge.'))
    expect(text).not.toMatch(/null|not specified|Store|Looks right/i)

    // the typed reply is the confirmation
    await user.type(screen.getByLabelText('Message Muse'), 'Serpent looks cool. Order it. Use my PayPal account for checkout.')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    const order = await screen.findByLabelText('Order confirmation')
    expect(order).toHaveTextContent('$449.95')
    expect(order).toHaveTextContent('Expedited shipping')
    expect(order).toHaveTextContent('$60')
    expect(order).toHaveTextContent('$509.95')
    expect(order).toHaveTextContent('Arrives Fri Oct 30')
    expect(order).toHaveTextContent('Paid with Demo PayPal')
    expect(screen.getByLabelText('Message Muse')).toBeDisabled()

    // only the shopper-agent function, publishable key only, no confirm step
    expect(calls.map((c) => c.url)).toEqual(Array(2).fill('https://example.supabase.co/functions/v1/shopper-agent'))
    expect(calls[0].headers.apikey).toBe('sb_publishable_test')
    expect(calls[0].body.confirm).toBeUndefined()
    expect(calls[0].body.messages.at(-1)).toEqual({ role: 'user', text: HERO })
    // the order message carries the rules and the full offers back, unchanged; status lines are never sent
    expect(calls[1].body.draft).toEqual(rules)
    expect(calls[1].body.offers).toEqual(offers)
    expect(calls[1].body.messages.map((m: { role: string }) => m.role)).toEqual(['assistant', 'user', 'assistant', 'assistant', 'user'])
    expect(JSON.stringify(calls[1].body.messages)).not.toContain('Muse is checking')

    expect(screen.getByTestId('phone-frame').textContent).not.toMatch(/dashboard|grant|receipt|tamper|dispute|verdict/i)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('sends a plain message when a card is picked', async () => {
    const user = userEvent.setup()
    replies = [
      { type: 'proposals', text: 'Here are two options:', follow_up: 'Pick one, and tell me which payment to charge.', offers, draft: {} },
      { type: 'message', text: 'Which payment should I charge?' },
    ]
    render(<ChatApp />)
    await user.type(screen.getByLabelText('Message Muse'), 'a board under 500')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.click((await screen.findByLabelText('Spellbinder Snowboard 2026/2027')).querySelector('button')!)
    expect(await screen.findByText('Which payment should I charge?')).toBeInTheDocument()
    expect(calls[1].body.messages.at(-1).text).toBe("I'll take the Burton Spellbinder Snowboard 2026/2027.")
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
