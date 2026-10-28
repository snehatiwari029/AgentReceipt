import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { askAgent } from '../chat/api'
import type { AgentReply, ChatItem, OfferCardData, OrderData } from '../chat/types'
import { formatMoney } from '../shared/format'
import { offerTour, signIn } from '../dashboard/session'
import type { Landing } from './content'

export const DEMO_PROMPT =
  "Find and purchase a less than $500 snowboard that will arrive at my address in 2 days and I should be able to return it if it doesn't work for me."
const PROMPT_NOTE = 'This prompt is designed to trigger the mismatch — changing size, budget, or delivery may change the outcome.'
const ASK_PAY =
  'Pick one, and tell me which payment to charge for this demo checkout. Any method you name will be recorded as demo only — no real charge will be made.'
// Card networks and checkout methods, in this order. Every payment is accepted and recorded as Demo Checkout.
const PAYMENTS = ['Demo Visa card ••4242', 'Mastercard', 'Stripe Checkout', 'PayPal']

// The customer's own agent, simulated for the demo, in a modal phone. It talks to the same shopper-agent
// function as /chat. It never auto-sends and never auto-closes: the only way on is "See merchant dashboard".
export default function PhoneDemo({ landing, onClose }: { landing: Landing; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const next = useRef(1)
  const navigate = useNavigate()
  const [items, setItems] = useState<ChatItem[]>([])
  const [text, setText] = useState(DEMO_PROMPT)
  const [draft, setDraft] = useState<unknown>(null)
  const [offers, setOffers] = useState<unknown[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [askPay, setAskPay] = useState(false)
  const [order, setOrder] = useState<OrderData | null>(null)
  const [busy, setBusy] = useState(false)
  const sent = items.length > 0

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal?.()
    input.current?.focus()
  }, [])
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [items, busy])

  const id = () => next.current++
  const words = (list: ChatItem[]) =>
    list.flatMap((i): { role: 'user' | 'assistant'; text: string }[] =>
      i.kind === 'me' ? [{ role: 'user', text: i.text }] : i.kind === 'muse' ? [{ role: 'assistant', text: i.text }] : [])

  function show(reply: AgentReply, base: ChatItem[]) {
    const add: ChatItem[] = []
    if (reply.session_id) setSessionId(reply.session_id)
    if (reply.draft !== undefined) setDraft(reply.draft)
    if (reply.type === 'message') {
      add.push({ id: id(), kind: 'muse', text: reply.text })
      if (reply.ask_payment) setAskPay(true)
    } else if (reply.type === 'proposals') {
      setOffers(reply.offers)
      setAskPay(true)
      add.push({ id: id(), kind: 'muse', text: reply.text }, { id: id(), kind: 'offers', offers: reply.offers }, { id: id(), kind: 'muse', text: ASK_PAY })
    } else if (reply.type === 'ordered') {
      setOrder(reply.order)
      setAskPay(false)
      add.push({ id: id(), kind: 'order', order: reply.order })
    } else add.push({ id: id(), kind: 'problem', text: reply.message })
    setItems([...base, ...add])
  }

  async function send(raw: string) {
    const t = raw.trim()
    if (!t || busy || order) return
    const base: ChatItem[] = [...items, { id: id(), kind: 'me', text: t }]
    setItems(base)
    setText('')
    setBusy(true)
    const reply = await askAgent({ messages: words(base), session_id: sessionId, draft, offers })
    setBusy(false)
    show(reply, base)
  }

  const pick = (o: OfferCardData) => void send(`I'll take the ${o.brand ? `${o.brand} ` : ''}${o.name}.`)

  function requestClose() {
    if (order || window.confirm('Close the demo? The conversation so far will be lost.')) onClose()
  }

  function toDashboard() {
    signIn()
    offerTour(landing)
    navigate('/dashboard')
  }

  return (
    <dialog
      ref={dialog}
      className="phone-dialog"
      aria-labelledby="muse-title"
      onCancel={(e) => { e.preventDefault(); requestClose() }}
    >
      <div className="phone">
        <header className="phone__head">
          <h2 id="muse-title" className="phone__title">Muse</h2>
          <p className="phone__sub">Your personal shopper at Northwind Outfitters</p>
          <p className="phone__note">Customer's personal agent (simulated in demo)</p>
          {!order && (
            <button type="button" className="phone__close" onClick={requestClose}>
              Close demo
            </button>
          )}
        </header>

        <div role="log" aria-live="polite" className="phone__log">
          {!sent && <p className="phone__hint">Muse is ready. The prompt below is filled in for you.</p>}
          {items.map((i) => {
            switch (i.kind) {
              case 'me': return <p key={i.id} className="bubble bubble--me">{i.text}</p>
              case 'muse': return <p key={i.id} className="bubble">{i.text}</p>
              case 'status': return null
              case 'offers': return (
                <div key={i.id} className="offers">
                  {i.offers.map((o) => (
                    <section key={o.product_id} className="offer" aria-label={o.name}>
                      <p className="offer__brand">{o.brand}</p>
                      <h3 className="offer__name">{o.name}</h3>
                      <p className="offer__meta">{o.size_cm} cm{o.colour ? `, ${o.colour}` : ''}</p>
                      <p className="offer__price num">{formatMoney(o.price_cents)}</p>
                      <p className="offer__summary">“{o.summary}”</p>
                      <p className="offer__meta">Arrives {o.delivery_label}</p>
                      <button type="button" className="pbtn pbtn--pick" disabled={busy || !!order} onClick={() => pick(o)}>
                        Pick this one
                      </button>
                    </section>
                  ))}
                </div>
              )
              case 'order': return <OrderConfirm key={i.id} order={i.order} />
              case 'problem': return <p key={i.id} role="alert" className="bubble bubble--problem">{i.text}</p>
            }
          })}
          {busy && <p role="status" className="phone__hint">Muse is working on it…</p>}
          <div ref={end} />
        </div>

        <div className="phone__foot">
          {order ? (
            <button type="button" className="pbtn pbtn--go" onClick={toDashboard}>
              See merchant dashboard
            </button>
          ) : (
            <>
              {askPay && !busy && (
                <div className="pay" role="group" aria-label="Payment for this demo checkout">
                  {PAYMENTS.map((p, n) => (
                    <button key={p} type="button" className={`pbtn pbtn--pay${n === 0 ? ' is-suggested' : ''}`} onClick={() => void send(`Pay with ${p}.`)}>
                      {p}
                      {n === 0 && <span className="pay__tag">Suggested</span>}
                    </button>
                  ))}
                  <p className="pay__or">Or type any other payment below.</p>
                </div>
              )}
              {!sent && (
                <p className="pointer" aria-hidden="true">
                  Press Enter to send this prompt <span className="pointer__arrow">↓</span>
                </p>
              )}
              <form className="compose" onSubmit={(e) => { e.preventDefault(); void send(text) }}>
                <label htmlFor="muse-input" className="visually-hidden">
                  {askPay ? 'Or type any other payment' : 'Message Muse'}
                </label>
                <textarea
                  id="muse-input"
                  ref={input}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      void send(text)
                    }
                  }}
                  rows={sent ? 1 : 5}
                  maxLength={1000}
                  disabled={busy}
                  placeholder={askPay ? 'Or type any other payment' : 'Message Muse'}
                  autoComplete="off"
                />
                <button type="submit" className="pbtn pbtn--send" disabled={busy || !text.trim()}>
                  Send
                </button>
              </form>
              {!sent && <p className="phone__small">{PROMPT_NOTE}</p>}
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}

function OrderConfirm({ order }: { order: OrderData }) {
  return (
    <section className="confirm" aria-label="Order confirmation">
      <h3 className="confirm__title">Order placed</h3>
      <p className="confirm__item">{order.brand ? `${order.brand} ` : ''}{order.product_name}</p>
      <p className="offer__meta">{order.size_cm} cm{order.colour ? `, ${order.colour}` : ''}</p>
      <dl className="confirm__lines">
        <div><dt>Item</dt><dd className="num">{formatMoney(order.item_price_cents)}</dd></div>
        <div><dt>{order.shipping_label}</dt><dd className="num">{order.shipping_cents === 0 ? 'Free' : formatMoney(order.shipping_cents)}</dd></div>
        <div className="confirm__total"><dt>Total</dt><dd className="num">{formatMoney(order.total_cents)}</dd></div>
      </dl>
      <p className="offer__meta">Arrives {order.delivery_label}</p>
      <p className="offer__meta">Paid with {order.payment_label}. Simulated, no real payment.</p>
    </section>
  )
}
