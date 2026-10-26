type Props = {
  cartCount: number
}

// Store header as an agent / shopper sees it: brand, tagline, category nav, cart.
// No links to any other view live here, by design.
export default function StoreHeader({ cartCount }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-900">Northwind Outfitters</p>
          <p className="text-sm text-slate-600">Soar new heights</p>
        </div>

        <nav aria-label="Store categories" className="order-3 flex w-full items-center gap-6 sm:order-none sm:w-auto">
          <a href="#ski" className="text-sm font-semibold text-slate-800 underline-offset-4 hover:underline">
            Ski
          </a>
          <a href="#snowboard" className="text-sm font-semibold text-slate-800 underline-offset-4 hover:underline">
            Snowboard
          </a>
        </nav>

        <p
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900"
          aria-live="polite"
          data-testid="cart-indicator"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l-1 13H7L6 7z" />
            <path d="M9 7a3 3 0 016 0" />
          </svg>
          Cart {cartCount} {cartCount === 1 ? 'item' : 'items'}
        </p>
      </div>
    </header>
  )
}
