import type { Product } from '../../shared/types'
import { formatMoney } from '../../shared/format'
import ProductImage from './ProductImage'
import ReturnsChip from './ReturnsChip'

type Props = {
  product: Product
  onView: (product: Product) => void
  onAdd: (product: Product) => void
}

export default function ProductCard({ product, onView, onAdd }: Props) {
  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      data-testid="product-card"
    >
      <div className="relative aspect-[4/3] border-b border-slate-200">
        <ProductImage product={product} />
        {product.featured && (
          <span className="absolute left-3 top-3 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          {product.brand && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{product.brand}</p>
          )}
          <h3 className="mt-1 text-lg font-semibold leading-snug text-slate-900">{product.name}</h3>
          <p className="mt-1 text-sm text-slate-700">
            {product.size_cm}cm{product.colour ? ` · ${product.colour}` : ""}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <p className="text-2xl font-bold text-slate-900">{formatMoney(product.price_cents, product.currency)}</p>
          <ReturnsChip term={product.formal_returns} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onView(product)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-900"
            aria-label={`View details for ${product.name}`}
          >
            View details
          </button>
          <button
            type="button"
            onClick={() => onAdd(product)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            aria-label={`Add ${product.name} to cart`}
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  )
}
