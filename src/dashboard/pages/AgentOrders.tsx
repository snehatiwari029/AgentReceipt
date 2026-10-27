import { useState } from 'react'
import type { Receipt } from '../../shared/schemas'
import { formatMoney } from '../../shared/format'
import { num, str, useRows } from '../data'
import { Card, Empty, Live, PageTitle } from '../components/Panel'
import { RecommendationBadge } from '../components/Badges'
import VerdictTable from '../components/VerdictTable'

// Expected action_summary keys (written by the receipt function when it is built):
// product_name, total_cents.
export default function AgentOrders() {
  const state = useRows<Receipt>('receipts', 'chain_seq', false)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div>
      <PageTitle title="Agent orders">
        Every order an agent placed at this store, with the receipt written for it. Open a row for the line-by-line check.
      </PageTitle>

      <Live state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No agent orders yet.">
              Orders and their receipts appear here as soon as an agent completes a purchase at the store. This
              page reads the database live, so nothing needs to change when they arrive.
            </Empty>
          ) : (
            <Card label="Agent orders">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-dash-edge text-xs uppercase tracking-wider text-dash-label">
                      <th className="py-2 pr-4 font-semibold">Receipt</th>
                      <th className="py-2 pr-4 font-semibold">Order</th>
                      <th className="py-2 pr-4 font-semibold">Item</th>
                      <th className="py-2 pr-4 font-semibold">Total</th>
                      <th className="py-2 pr-4 font-semibold">Problems</th>
                      <th className="py-2 pr-4 font-semibold">Recommendation</th>
                      <th className="py-2 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const total = num(r.action_summary.total_cents)
                      const isOpen = open === r.id
                      return (
                        <tr key={r.id} className="border-b border-dash-edge align-top">
                          <td className="py-2 pr-4 font-semibold text-dash-ink">{r.receipt_ref}</td>
                          <td className="py-2 pr-4">{r.order_ref ?? '–'}</td>
                          <td className="py-2 pr-4">{str(r.action_summary.product_name) ?? '–'}</td>
                          <td className="py-2 pr-4">{total === null ? '–' : formatMoney(total)}</td>
                          <td className={`py-2 pr-4 font-bold ${r.problems_found > 0 ? 'text-dash-violation' : 'text-dash-ink'}`}>
                            {r.problems_found}
                          </td>
                          <td className="py-2 pr-4">
                            <RecommendationBadge value={r.recommendation} />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => setOpen(isOpen ? null : r.id)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-dash-teal hover:bg-dash-card-raised"
                            >
                              {isOpen ? 'Hide check' : 'Show check'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {rows
                .filter((r) => r.id === open)
                .map((r) => (
                  <div key={r.id} className="mt-5 rounded-lg border border-dash-edge bg-dash-card-raised p-4">
                    <p className="mb-3 text-sm font-semibold text-dash-ink">
                      {r.receipt_ref}: {r.problems_found} {r.problems_found === 1 ? 'problem' : 'problems'} found
                    </p>
                    <VerdictTable rows={r.mismatch_results} />
                    {r.missing_components.length > 0 && (
                      <p className="mt-3 text-sm text-dash-attention">
                        Missing record components: {r.missing_components.join(', ')}.
                      </p>
                    )}
                    <p className="mt-3 break-all text-xs text-dash-label">
                      {r.schema_label}. Entry hash {r.entry_hash}
                    </p>
                  </div>
                ))}
            </Card>
          )
        }
      </Live>
    </div>
  )
}
