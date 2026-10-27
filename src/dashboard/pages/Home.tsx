import { Link } from 'react-router-dom'
import { useProducts } from '../../shared/useProducts'
import { needsAttention, useAgentOrders } from './AgentOrders'

const CARD = 'rounded-xl border border-dash-edge bg-dash-card p-5'
const LABEL = 'text-xs font-semibold uppercase tracking-widest text-dash-label'
const VALUE = 'mt-2 text-3xl font-bold text-dash-ink'

export default function Home() {
  const state = useProducts()
  const orders = useAgentOrders()
  const attention = orders.status === 'ready' ? orders.rows.filter(needsAttention).length : null
  return (
    <div>
      <h1 className="text-2xl font-bold text-dash-ink">Dashboard</h1>
      <p className="mt-2 text-sm text-dash-body">
        Merchant view for Northwind Outfitters. Open a section on the left.
      </p>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Store summary">
        <div className={CARD} data-testid="stat-store-health">
          <p className={LABEL}>Store Health</p>
          <p className={VALUE}>86<span className="text-base font-normal text-dash-body">/100</span></p>
        </div>
        <div className={CARD} data-testid="stat-profit">
          <p className={LABEL}>Profit</p>
          <p className={VALUE}>$18,400</p>
        </div>
        <div className={CARD} data-testid="stat-agent-profit">
          <p className={LABEL}>Agent-driven profit</p>
          <p className={VALUE}>$7,920 <span className="text-base font-normal text-dash-body">(43%)</span></p>
        </div>
        <Link
          to="/dashboard/orders"
          className={`${CARD} block hover:bg-dash-card-raised`}
          data-testid="stat-attention"
          aria-label="Orders requiring attention, open Agent orders"
        >
          <p className={LABEL}>Orders requiring attention</p>
          <p className={`${VALUE} text-dash-attention`}>
            {orders.status === 'loading' && <span className="text-base font-normal text-dash-body">Loading…</span>}
            {orders.status === 'error' && <span className="text-base font-normal text-dash-violation">Could not load</span>}
            {attention !== null && attention}
          </p>
          <p className="mt-1 text-xs text-dash-label">Review Required + Hold for Suspicion</p>
        </Link>
      </section>
      <p className="mt-2 text-xs text-dash-label">Store Health and profit figures are demo values. The attention count is read live from Agent orders.</p>

      <section className="mt-6 max-w-md rounded-xl border border-dash-edge bg-dash-card p-5" aria-label="Catalog">
        <p className={LABEL}>Catalog</p>
        {state.status === 'loading' && <p className="mt-2 text-dash-body">Loading…</p>}
        {state.status === 'error' && <p className="mt-2 break-words text-dash-violation">{state.message}</p>}
        {state.status === 'ready' && (
          <p className="mt-2 text-3xl font-bold text-dash-ink">
            {state.products.length} <span className="text-base font-normal text-dash-body">products in the store</span>
          </p>
        )}
      </section>
    </div>
  )
}
