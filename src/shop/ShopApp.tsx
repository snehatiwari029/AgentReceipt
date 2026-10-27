import { useState } from 'react'
import StoreHeader from './components/StoreHeader'
import ProductSection from './components/ProductSection'
import ProductDetails from './components/ProductDetails'
import { useProducts } from '../shared/useProducts'
import type { Product } from '../shared/types'

// The demo store exactly as a shopper or an agent sees it, in a light retail theme.
export default function ShopApp() {
  const state = useProducts()
  const [cartCount, setCartCount] = useState(0)
  const [selected, setSelected] = useState<Product | null>(null)

  const addToCart = () => setCartCount((n) => n + 1)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <StoreHeader cartCount={cartCount} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="mb-10 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Snowboard and Ski Gear</h1>

        {state.status === 'loading' && (
          <p role="status" className="text-slate-700">
            Loading products…
          </p>
        )}

        {state.status === 'error' && (
          <div role="alert" className="rounded-lg border border-slate-300 bg-slate-50 p-5">
            <p className="font-semibold text-slate-900">We couldn&apos;t load the products.</p>
            <p className="mt-2 break-words text-sm text-slate-700">{state.message}</p>
          </div>
        )}

        {state.status === 'ready' && state.products.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-lg font-semibold text-slate-900">No products in the store yet.</p>
            <p className="mt-2 text-sm text-slate-700">The products table is empty.</p>
          </div>
        )}

        {state.status === 'ready' && state.products.length > 0 && (
          <>
            <ProductSection
              id="snowboard"
              title="Snowboard"
              products={state.products.filter((p) => p.category === 'snowboard')}
              onView={setSelected}
              onAdd={addToCart}
            />
            <ProductSection
              id="ski"
              title="Ski"
              products={state.products.filter((p) => p.category === 'ski')}
              onView={setSelected}
              onAdd={addToCart}
            />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        Northwind Outfitters demo store. Checkout is simulated.
      </footer>

      {selected && <ProductDetails product={selected} onClose={() => setSelected(null)} onAdd={addToCart} />}
    </div>
  )
}
