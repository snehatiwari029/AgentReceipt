import type { Product } from '../../shared/types'
import type { Receipt } from '../../shared/schemas'
import { useRows } from '../data'
import { Card, Empty, Live, PageTitle } from '../components/Panel'

// Rule-based check on the live products table: the product page promises returns, but the
// formal terms say final sale. Semantic detection by the Auditor comes later; this is a plain rule.
export function contradictingProducts(products: Product[]): Product[] {
  return products.filter((p) => p.formal_returns === 'final_sale' && /return/i.test(p.marketing_blurb ?? ''))
}

export function causeCounts(receipts: Receipt[]): { field: string; cause: string; count: number }[] {
  const map = new Map<string, { field: string; cause: string; count: number }>()
  for (const r of receipts) {
    for (const m of r.mismatch_results) {
      if (m.result !== 'mismatch') continue
      const cause = m.cause ?? 'No cause recorded'
      const key = `${m.field}||${cause}`
      const cur = map.get(key)
      if (cur) cur.count += 1
      else map.set(key, { field: m.field, cause, count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

export default function Optimization() {
  const products = useRows<Product>('products', 'sort_order', true)
  const receipts = useRows<Receipt>('receipts', 'chain_seq', false)

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Optimization">
        Where agents can misread this store&apos;s terms, and what to change so they stop.
      </PageTitle>

      <Card label="Product pages that contradict their terms">
        <h2 className="text-lg font-bold text-dash-ink">Product pages that contradict their terms</h2>
        <p className="mt-1 text-sm text-dash-body">
          Rule-based check on the live catalog: the page text mentions returns, but the formal terms say final sale.
        </p>
        <div className="mt-4">
          <Live state={products}>
            {(rows) => {
              const bad = contradictingProducts(rows)
              if (bad.length === 0) {
                return <p className="text-dash-body">No contradictions found in {rows.length} products.</p>
              }
              return (
                <ul className="flex flex-col gap-4">
                  {bad.map((p) => (
                    <li key={p.id} className="rounded-lg border border-dash-attention bg-dash-card-raised p-4">
                      <p className="font-semibold text-dash-ink">
                        {p.brand ? `${p.brand} ` : ''}
                        {p.name}
                      </p>
                      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
                        <dt className="text-dash-label">Product page says</dt>
                        <dd>{p.marketing_blurb}</dd>
                        <dt className="text-dash-label">Formal terms say</dt>
                        <dd>{p.formal_terms_text}</dd>
                        <dt className="text-dash-label">Change</dt>
                        <dd>State &quot;Final sale&quot; on the product page, or change the terms so the two agree.</dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              )
            }}
          </Live>
        </div>
      </Card>

      <Card label="Most common mismatch causes">
        <h2 className="text-lg font-bold text-dash-ink">Most common mismatch causes</h2>
        <p className="mt-1 text-sm text-dash-body">Counted from the line-by-line checks stored on receipts.</p>
        <div className="mt-4">
          <Live state={receipts}>
            {(rows) => {
              const counts = causeCounts(rows)
              if (counts.length === 0) {
                return (
                  <Empty title="No mismatches recorded yet.">
                    Causes appear here once receipts with mismatches exist.
                  </Empty>
                )
              }
              return (
                <ul className="flex flex-col gap-2 text-sm">
                  {counts.map((c) => (
                    <li key={`${c.field}-${c.cause}`} className="flex flex-wrap gap-x-3">
                      <span className="w-8 font-bold text-dash-violation">{c.count}</span>
                      <span className="font-semibold text-dash-ink">{c.field}</span>
                      <span>{c.cause}</span>
                    </li>
                  ))}
                </ul>
              )
            }}
          </Live>
        </div>
      </Card>
    </div>
  )
}
