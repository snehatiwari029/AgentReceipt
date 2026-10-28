import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, mock } from './mockSupabase'

vi.mock('../shared/supabase', () => ({ supabase: fakeClient }))

import SitePage from '../site/SitePage'
import { DEMO_PROMPT } from '../site/PhoneDemo'

// jsdom has no <dialog> methods.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', '') }
  sessionStorage.clear()
  mock.inserted = []
  mock.insertError = null
  mock.tables = Object.fromEntries(['receipts', 'grants', 'disputes', 'dispute_events', 'sessions'].map((t) => [t, { data: [], error: null }]))
})

const site = () => render(<MemoryRouter><SitePage /></MemoryRouter>)

describe('B2B site', () => {
  it('has the hero copy, both actions and the demo note', () => {
    site()
    expect(screen.getByRole('heading', { level: 1, name: 'Trust layer for agentic shopping' })).toBeInTheDocument()
    expect(screen.getByText(/AgentReceipt proves what the agent was authorized to do/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See how it works' })).toHaveAttribute('href', '#how-it-works')
    expect(screen.getAllByText('Demo data only. No real payment, no real auth in this demo.').length).toBeGreaterThan(0)
  })

  it('has every section, in order', () => {
    const { container } = site()
    const ids = [...container.querySelectorAll('main section[id], main section[aria-labelledby]')].map((s) => s.id || s.getAttribute('aria-labelledby'))
    expect(ids).toEqual(['top', 'problem-title', 'how-it-works', 'detect', 'prevent', 'faq', 'pilot'])
    expect(container.querySelectorAll('details.qa')).toHaveLength(11)
  })

  it('the verdict table has the seven columns and the Review Required decision', () => {
    site()
    const table = screen.getByRole('table', { name: /verdict table for hero order 12322/i })
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual(['Field', 'Grant', 'Merchant terms', 'Actual', 'Match', 'Cause', 'Next action / Who acts'])
    expect(screen.getByText('Review Required — Do not ship yet. Merchant review needed before fulfillment.')).toBeInTheDocument()
  })

  it('Login for demo opens the phone with the prompt filled in and not sent', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    site()
    await user.click(screen.getAllByRole('button', { name: 'Login for demo' })[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Muse' })).toBeInTheDocument()
    expect(within(dialog).getByText("Customer's personal agent (simulated in demo)")).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox')).toHaveValue(DEMO_PROMPT)
    expect(within(dialog).getByText(/Press Enter to send this prompt/)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('the pilot form refuses a bad email and writes nothing', async () => {
    const user = userEvent.setup()
    site()
    await user.type(screen.getByLabelText('Name'), 'Ana')
    await user.type(screen.getByLabelText('Work email'), 'not-an-email')
    await user.type(screen.getByLabelText('Company / Store name'), 'Example Store')
    await user.click(screen.getByLabelText('Join a pilot'))
    await user.click(screen.getByRole('button', { name: 'Request pilot' }))
    expect(screen.getByText(/Enter an email address/)).toBeInTheDocument()
    expect(mock.inserted).toHaveLength(0)
  })

  it('the pilot form inserts one row and thanks only after the insert succeeds', async () => {
    const user = userEvent.setup()
    site()
    await user.type(screen.getByLabelText('Name'), 'Ana')
    await user.type(screen.getByLabelText('Work email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Company / Store name'), 'Example Store')
    await user.type(screen.getByLabelText(/Store URL/), 'example.com')
    await user.click(screen.getByLabelText('Stay in the loop'))
    await user.click(screen.getByRole('button', { name: 'Stay in the loop' }))
    await waitFor(() => expect(mock.inserted).toHaveLength(1))
    expect(mock.inserted[0]).toEqual({
      table: 'pilot_signups',
      row: { name: 'Ana', work_email: 'ana@example.com', company: 'Example Store', store_url: 'https://example.com/', interest: 'stay_in_loop', message: null, source: 'b2b_site' },
    })
    expect(await screen.findByText(/we've recorded your request/)).toBeInTheDocument()
  })

  it('a failed insert shows the error and no thanks', async () => {
    const user = userEvent.setup()
    mock.insertError = { message: 'permission denied' }
    site()
    await user.type(screen.getByLabelText('Name'), 'Ana')
    await user.type(screen.getByLabelText('Work email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Company / Store name'), 'Example Store')
    await user.click(screen.getByLabelText('Join a pilot'))
    await user.click(screen.getByRole('button', { name: 'Request pilot' }))
    expect(await screen.findByText(/Something went wrong saving your request/)).toBeInTheDocument()
    expect(screen.queryByText(/we've recorded your request/)).not.toBeInTheDocument()
  })
})
