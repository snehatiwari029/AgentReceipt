import type { Dispute, DisputeEvent, Receipt } from '../../shared/schemas'
import { DISPUTE_STATUS, disputeStatus } from '../status'
import { useRows } from '../data'
import { Card, Empty, Live, PageTitle } from '../components/Panel'
import { RecommendationBadge } from '../components/Badges'
import VerdictTable from '../components/VerdictTable'

export default function Disputes() {
  const disputes = useRows<Dispute>('disputes', 'opened_at', false)
  const receipts = useRows<Receipt>('receipts', 'chain_seq', false)
  const events = useRows<DisputeEvent>('dispute_events', 'chain_seq', true)

  const state =
    disputes.status === 'error' ? disputes : receipts.status === 'error' ? receipts : events.status === 'error' ? events
    : disputes.status === 'loading' || receipts.status === 'loading' || events.status === 'loading' ? ({ status: 'loading' } as const)
    : ({ status: 'ready', rows: disputes.rows } as const)

  return (
    <div>
      <PageTitle title="Disputes">
        Each dispute with the receipt behind it. Decisions are recorded as new entries in the chain, never as edits.
      </PageTitle>

      <Live state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No disputes yet.">
              A dispute appears here when a customer disputes an agent order, together with the receipt and the
              line-by-line check behind it. This page reads the database live.
            </Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {rows.map((d) => {
                const receipt = receipts.status === 'ready' ? receipts.rows.find((r) => r.id === d.receipt_id) : undefined
                const evs = events.status === 'ready' ? events.rows.filter((e) => e.dispute_id === d.id) : []
                                return (
                  <Card key={d.id} label={`Dispute ${receipt?.receipt_ref ?? d.id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-dash-ink">{receipt?.receipt_ref ?? 'Receipt not found'}</p>
                        <p className="text-sm text-dash-body">Reason: {d.reason}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-dash-ink">{disputeStatus(evs)}</span>
                        {receipt && <RecommendationBadge value={receipt.recommendation} />}
                      </div>
                    </div>

                    {receipt && (
                      <div className="mt-5">
                        <p className="mb-3 text-sm font-semibold text-dash-ink">
                          {receipt.problems_found} {receipt.problems_found === 1 ? 'problem' : 'problems'} found
                        </p>
                        <VerdictTable rows={receipt.mismatch_results} />
                        <p className="mt-2 text-xs text-dash-label">{receipt.schema_label}. Verified-agent status is simulated.</p>
                      </div>
                    )}

                    {evs.length > 0 && (
                      <ol className="mt-5 border-t border-dash-edge pt-4 text-sm">
                        {evs.map((e) => (
                          <li key={e.id} className="flex flex-wrap gap-x-3 py-1">
                            <span className="font-semibold text-dash-ink">{DISPUTE_STATUS[e.event_type]}</span>
                            <span className="text-dash-label">{e.decided_by ? `by ${e.decided_by}` : 'automatic'}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Card>
                )
              })}
            </div>
          )
        }
      </Live>
    </div>
  )
}
