import { formatMoney } from '../shared/format'
import type { OfferCardData, OrderData, RuleLine } from './types'

export function Bubble({ side, children }: { side: 'me' | 'muse'; children: string }) {
  const me = side === 'me'
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-snug ${me ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-neutral-100 text-neutral-900'}`}>
        {children}
      </p>
    </div>
  )
}

export function StatusLine({ children }: { children: string }) {
  return <p className="px-1 text-xs italic text-neutral-500">{children}</p>
}

export function RulesCard({ view, state, onConfirm, onChange, disabled }: {
  view: RuleLine[]; state: 'open' | 'confirmed' | 'changed'; onConfirm: () => void; onChange: () => void; disabled: boolean
}) {
  return (
    <section aria-label="Your order rules" className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <h2 className="text-sm font-bold text-neutral-900">Your order rules</h2>
      <dl className="mt-2 divide-y divide-neutral-100 text-sm">
        {view.map((l) => (
          <div key={l.label} className="flex justify-between gap-3 py-1.5">
            <dt className="text-neutral-500">{l.label}</dt>
            <dd className="text-right font-medium text-neutral-900">{l.value}</dd>
          </div>
        ))}
      </dl>
      {state === 'open' ? (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={disabled} onClick={onConfirm} className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Looks right
          </button>
          <button type="button" disabled={disabled} onClick={onChange} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50">
            Change
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-neutral-500">{state === 'confirmed' ? 'Confirmed. Muse will shop inside these rules.' : 'Changing these.'}</p>
      )}
    </section>
  )
}

export function OfferCard({ offer, onOrder, disabled }: { offer: OfferCardData; onOrder: () => void; disabled: boolean }) {
  return (
    <section aria-label={offer.name} className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{offer.brand}</p>
      <h2 className="text-sm font-bold text-neutral-900">{offer.name}</h2>
      <p className="mt-0.5 text-xs text-neutral-600">{offer.size_cm} cm{offer.colour ? ` · ${offer.colour}` : ''}</p>
      <p className="mt-2 text-lg font-extrabold text-neutral-900">{formatMoney(offer.price_cents)}</p>
      <p className="text-sm text-neutral-800">{offer.summary}</p>
      <p className="text-sm text-neutral-600">Arrives {offer.delivery_label}</p>
      <button type="button" disabled={disabled} onClick={onOrder} className="mt-3 w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
        Order it
      </button>
    </section>
  )
}

export function OrderCard({ order }: { order: OrderData }) {
  const rows: [string, string][] = [
    ['Item', formatMoney(order.item_price_cents)],
    [order.shipping_label, order.shipping_cents === 0 ? 'Free' : formatMoney(order.shipping_cents)],
  ]
  return (
    <section aria-label="Order confirmation" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5">
      <h2 className="text-sm font-bold text-emerald-900">Order placed</h2>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{order.brand ? `${order.brand} ` : ''}{order.product_name}</p>
      <p className="text-xs text-neutral-600">{order.size_cm} cm{order.colour ? ` · ${order.colour}` : ''}</p>
      <dl className="mt-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5"><dt className="text-neutral-600">{k}</dt><dd className="text-neutral-900">{v}</dd></div>
        ))}
        <div className="flex justify-between border-t border-emerald-200 py-1 font-bold"><dt>Total</dt><dd>{formatMoney(order.total_cents)}</dd></div>
      </dl>
      <p className="text-sm text-neutral-700">Arrives {order.delivery_label}</p>
      <p className="text-xs text-neutral-500">Paid with {order.payment_label}. Simulated, no real payment.</p>
    </section>
  )
}
