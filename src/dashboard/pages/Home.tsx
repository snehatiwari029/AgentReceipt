import { useProducts } from '../../shared/useProducts'

export default function Home() {
  const state = useProducts()
  return (
    <div>
      <h1 className="text-2xl font-bold text-dash-ink">Dashboard</h1>
      <p className="mt-2 text-sm text-dash-body">
        Merchant view for Northwind Outfitters. Open a section on the left.
      </p>

      <section className="mt-6 max-w-md rounded-xl border border-dash-edge bg-dash-card p-5" aria-label="Catalog">
        <p className="text-xs font-semibold uppercase tracking-widest text-dash-label">Catalog</p>
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
