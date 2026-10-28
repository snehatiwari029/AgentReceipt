import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
vi.mock('../shared/supabase', () => ({ supabase: { from: (t: string) => ({ insert: (row: unknown) => insert(t, row) }) } }))

import LandingPage from '../site/LandingPage'
import { content } from '../site/content'

const show = () => render(<MemoryRouter><LandingPage /></MemoryRouter>)

beforeEach(() => { insert.mockReset(); insert.mockResolvedValue({ error: null }) })

describe('Public page', () => {
  it('shows the hero, the sample receipt and a Login for demo button that goes to the dashboard', () => {
    show()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Trust layer for\s*agentic\s*shopping/)
    for (const a of screen.getAllByRole('link', { name: /Login for demo/ })) expect(a).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('img', { name: /Sample receipt/ })).toHaveTextContent('Review required')
    expect(screen.getByRole('img', { name: /Sample receipt/ })).toHaveTextContent('Mismatch facts · not a liability decision')
  })

  it('the nav jumps to How it works, Products, FAQ and Pilot, and each target exists', () => {
    show()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const [label, id] of [['How it works', 'how-it-works'], ['Products', 'products'], ['FAQ', 'faq'], ['Pilot', 'pilot']]) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', `#${id}`)
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it('shows the three decisions and the three demo doors', () => {
    show()
    expect(screen.getByText(/Pass \/ Review Required \/ Hold for Suspicion/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Customer phone/ })).toHaveAttribute('href', '/chat')
    expect(screen.getByRole('link', { name: /Northwind store/ })).toHaveAttribute('href', '/shop')
  })

  it('FAQ opens one answer at a time', async () => {
    const user = userEvent.setup()
    show()
    expect(screen.getByText(/Agents misread marketing summaries/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /How does AgentReceipt fit/ }))
    expect(screen.queryByText(/Agents misread marketing summaries/)).not.toBeInTheDocument()
    expect(screen.getByText(/Your order system holds or releases shipment/)).toBeInTheDocument()
  })

  it('the pilot form saves one row to pilot_requests and says thanks', async () => {
    const user = userEvent.setup()
    show()
    await user.type(screen.getByLabelText('Name'), 'Test Person')
    await user.type(screen.getByLabelText('Work email'), 'test@example.com')
    await user.type(screen.getByLabelText('Company / Store name'), 'Example Store')
    await user.click(screen.getByRole('button', { name: /Submit/ }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(content.pilot.success))
    expect(insert).toHaveBeenCalledWith('pilot_requests', {
      name: 'Test Person', work_email: 'test@example.com', company: 'Example Store', store_url: null, interest: 'Join a pilot', message: null,
    })
  })

  it('shows an error, not a thank-you, when saving fails; and ignores the hidden trap field', async () => {
    const user = userEvent.setup()
    insert.mockResolvedValue({ error: { message: 'nope' } })
    show()
    await user.type(screen.getByLabelText('Name'), 'A')
    await user.type(screen.getByLabelText('Work email'), 'a@b.co')
    await user.type(screen.getByLabelText('Company / Store name'), 'C')
    await user.click(screen.getByRole('button', { name: /Submit/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(content.pilot.error)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    insert.mockClear()
    await user.type(screen.getByLabelText(/Leave this empty/), 'spam')
    await user.click(screen.getByRole('button', { name: /Submit/ }))
    expect(insert).not.toHaveBeenCalled()
  })

  it('page copy stays inside the positioning rules', () => {
    const all = JSON.stringify(content)
    expect(all).not.toMatch(/blockchain|ledger|crypto|(?<!no )real payment|nobody records|immutable|concede|represent(?!s|ed)|chargeback fee/i)
  })
})
