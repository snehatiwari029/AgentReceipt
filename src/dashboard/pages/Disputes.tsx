import { useEffect, useState } from 'react'
import type { Dispute, DisputeEvent, Receipt } from '../../shared/schemas'
import { verifyOrderChain, type OrderChainCheck } from '../../shared/chain'
import { DISPUTE_STATUS, disputeStatus } from '../status'
import { loadOrderChain, useRows } from '../data'
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
                return <DisputeCard key={d.id} dispute={d} receipt={receipt} events={evs} />
              })}
            </div>
          )
        }
      </Live>
    </div>
  )
}

type Gate = { status: 'checking' } | { status: 'error'; message: string } | { status: 'done'; check: OrderChainCheck }

// Tamper check as a gate inside the dispute evidence: this order's chain is verified first. Only a verified chain lets
// the stored represent / concede recommendation show; a failed chain is untrusted and always means investigate.
function useChainGate(receipt: Receipt | undefined): Gate | null {
  const [gate, setGate] = useState<Gate | null>(null)
  useEffect(() => {
    if (!receipt) return
    let cancelled = false
    setGate({ status: 'checking' })
    const row = receipt as unknown as Parameters<typeof loadOrderChain>[0]
    loadOrderChain(row)
      .then(({ records, hashAt }) => verifyOrderChain(records, hashAt))
      .then(
        (check) => { if (!cancelled) setGate({ status: 'done', check }) },
        (e: unknown) => { if (!cancelled) setGate({ status: 'error', message: e instanceof Error ? e.message : 'Could not read the chain.' }) },
      )
    return () => { cancelled = true }
  }, [receipt])
  return gate
}

const short = (h: string | null) => (h ? `${h.slice(0, 15)}…${h.slice(-6)}` : 'none')

function DisputeCard({ dispute: d, receipt, events: evs }: { dispute: Dispute; receipt: Receipt | undefined; events: DisputeEvent[] }) {
  const gate = useChainGate(receipt)
  const verified = gate?.status === 'done' && gate.check.ok
  const failed = gate?.status === 'done' && !gate.check.ok ? gate.check : null
  return (
    <div data-dispute-order={receipt?.order_ref ?? undefined}>
    <Card label={`Dispute ${receipt?.receipt_ref ?? d.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-dash-ink">{receipt?.receipt_ref ?? 'Receipt not found'}</p>
          <p className="text-sm text-dash-body">Reason: {d.reason}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-dash-ink">{disputeStatus(evs)}{failed ? ' (record unverified)' : ''}</span>
          {receipt && verified && <RecommendationBadge value={receipt.recommendation} />}
          {failed && <span className="inline-block rounded border border-dash-violation px-2 py-0.5 text-xs font-bold text-dash-violation">Investigate</span>}
        </div>
      </div>

      {receipt && gate && (
        <div className="mt-4" data-testid="chain-check" role="status">
          {gate.status === 'checking' && <p className="text-sm text-dash-body">Checking receipt chain… recommendation withheld until it is verified.</p>}
          {gate.status === 'error' && (
            <p className="text-sm text-dash-attention">Tamper check could not run: {gate.message}. Recommendation withheld until it does.</p>
          )}
          {verified && (
            <p className="text-sm font-semibold text-dash-teal">
              Receipt chain verified — tamper check passed · <span className="break-all font-mono text-xs">{gate.check.receipt_hash}</span>
            </p>
          )}
          {failed && (
            <div className="rounded-lg border border-dash-violation p-3 text-sm">
              <p className="font-bold text-dash-violation">Receipt chain failed verification — tamper check failed. Recommendation: investigate, do not represent.</p>
              <p className="mt-1 text-dash-body">{failed.failed?.message}</p>
              {failed.failed && (
                <p className="mt-1 font-mono text-xs text-dash-label">
                  Stored {short(failed.failed.stored_hash)} · recomputed {short(failed.failed.recomputed_hash)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
    </div>
  )
}
