import { useEffect, useRef } from 'react'
import type { Product } from '../../shared/types'
import { daysLabel, formatMoney, shippingLabel } from '../../shared/format'
import ProductImage from './ProductImage'
import ReturnsChip from './ReturnsChip'

type Props = {
  product: Product
  onClose: () => void
  onAdd: (product: Product) => void
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ProductDetails({ product, onClose, onAdd }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const titleId = `details-title-${product.id}`

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="min-w-0">
            {product.brand && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{product.brand}</p>
            )}
            <h2 id={titleId} className="mt-1 text-xl font-bold text-slate-900">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {product.size_cm}cm{product.colour ? ` · ${product.colour}` : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-900"
          >
            Close
          </button>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[200px_1fr]">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 sm:aspect-auto sm:h-56">
            <ProductImage product={product} />
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-3xl font-bold text-slate-900">{formatMoney(product.price_cents, product.currency)}</p>
              <ReturnsChip term={product.formal_returns} />
            </div>
            {product.marketing_blurb && <p className="text-sm leading-relaxed text-slate-700">{product.marketing_blurb}</p>}
          </div>
        </div>

        <dl className="grid gap-4 border-t border-slate-200 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">Terms ({product.terms_version})</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-800">{product.formal_terms_text}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">Shipping</dt>
            <dd className="mt-1 space-y-1 text-sm text-slate-800">
              <p>
                Standard: {shippingLabel(product.standard_shipping_cents)}, {daysLabel(product.standard_delivery_days)}
              </p>
              {product.expedited_shipping_cents !== null && product.expedited_delivery_days !== null && (
                <p>
                  Expedited: {formatMoney(product.expedited_shipping_cents)}, {daysLabel(product.expedited_delivery_days)}
                </p>
              )}
            </dd>
          </div>
        </dl>

        <div className="border-t border-slate-200 p-5">
          <button
            type="button"
            onClick={() => onAdd(product)}
            className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  )
}
