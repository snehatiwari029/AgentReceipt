import type { Product } from '../../shared/types'
import ProductCard from './ProductCard'

type Props = {
  id: 'snowboard' | 'ski'
  title: string
  products: Product[]
  onView: (product: Product) => void
  onAdd: (product: Product) => void
}

export default function ProductSection({ id, title, products, onView, onAdd }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-14 first:mt-0">
      <h2 id={`${id}-heading`} className="mb-5 border-b border-slate-200 pb-3 text-2xl font-bold text-slate-900">
        {title}
      </h2>
      {products.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">No products listed in this section.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onView={onView} onAdd={onAdd} />
          ))}
        </div>
      )}
    </section>
  )
}
