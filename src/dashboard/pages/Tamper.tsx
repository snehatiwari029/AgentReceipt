import { useEffect, useMemo, useState } from 'react'
import { verifyChain, type ChainCheck, type ChainRecord } from '../../shared/chain'
import { formatMoney } from '../../shared/format'
import { num, useRows, type Rows } from '../data'
import { Card, Empty, Live, PageTitle } from '../components/Panel'

type Raw = Record<string, unknown> & { chain_seq: number; prev_hash: string; entry_hash: string }

function toRecords(entryType: ChainRecord['entry_type'], state: Rows<Raw>): ChainRecord[] | null {
  return state.status === 'ready' ? state.rows.map((row) => ({ chain_seq: row.chain_seq, entry_type: entryType, row })) : null
}

const short = (h: string) => `${h.slice(0, 14)}…${h.slice(-6)}`

// The tamper demo changes the amount on a COPY of one receipt, in this page only.
// Stored records are never touched.
function tampered(records: ChainRecord[], receiptId: string): { records: ChainRecord[]; from: number; to: number } | null {
  let from = 0
  let to = 0
  const out = records.map((r) => {
    if (r.entry_type !== 'receipt' || r.row.id !== receiptId) return r
    const summary = (r.row.action_summary ?? {}) as Record<string, unknown>
    const total = num(summary.total_cents)
    if (total === null) return r
    from = total
    to = Math.floor(total / 10)
    return { ...r, row: { ...r.row, action_summary: { ...summary, total_cents: to } } }
  })
  return from === 0 ? null : { records: out, from, to }
}

function Verifier({ records }: { records: ChainRecord[] }) {
  const receipts = records.filter((r) => r.entry_type === 'receipt')
  const [pickId, setPickId] = useState<string>(
    () => (receipts.find((r) => r.row.receipt_ref === 'AR-2026-0041') ?? receipts[0])?.row.id as string | undefined ?? '',
  )
  const [original, setOriginal] = useState<ChainCheck | null>(null)
  const [copy, setCopy] = useState<{ check: ChainCheck; from: number; to: number; ref: string } | null>(null)

  const sorted = useMemo(() => [...records].sort((a, b) => a.chain_seq - b.chain_seq), [records])
  const pickedRef = (receipts.find((r) => r.row.id === pickId)?.row.receipt_ref as string | undefined) ?? ''

  useEffect(() => {
    setOriginal(null)
    setCopy(null)
  }, [records])

  const entryChecks = (copy ? copy.check : original)?.entries ?? []

  return (
    <div className="flex flex-col gap-6">
      <Card label="Verify the original chain">
        <h2 className="text-lg font-bold text-dash-ink">1. Verify the original chain</h2>
        <p className="mt-1 text-sm text-dash-body">
          Recomputes every hash from the stored record and checks that each record points at the one before it.
        </p>
        <button
          type="button"
          onClick={async () => {
            setCopy(null)
            setOriginal(await verifyChain(records))
          }}
          className="mt-4 rounded-md bg-dash-teal px-4 py-2 text-sm font-bold text-dash-page-bottom hover:opacity-90"
        >
          Verify chain
        </button>
        <div role="status" aria-live="polite" className="mt-4">
          {original === null && <p className="text-dash-body">Not verified yet.</p>}
          {original?.ok && (
            <p className="text-lg font-bold text-dash-teal">✓ Original verified: {original.checked} entries, every hash and link matches.</p>
          )}
          {original && !original.ok && (
            <div>
              <p className="text-lg font-bold text-dash-violation">✕ Verification failed</p>
              <ul className="mt-2 text-sm text-dash-body">
                {original.problems.map((p) => (
                  <li key={`${p.chain_seq}-${p.kind}`}>{p.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card label="Tamper demo">
        <h2 className="text-lg font-bold text-dash-ink">2. Tamper with a copy</h2>
        <p className="mt-1 text-sm text-dash-body">
          Changes the amount on a copy of one receipt in this page and verifies again. The stored records are not touched.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="tamper-receipt" className="text-sm text-dash-body">
            Receipt
          </label>
          <select
            id="tamper-receipt"
            value={pickId}
            onChange={(e) => {
              setPickId(e.target.value)
              setCopy(null)
            }}
            className="rounded-md border border-dash-edge bg-dash-card-raised px-2 py-2 text-sm text-dash-ink"
          >
            {receipts.map((r) => (
              <option key={String(r.row.id)} value={String(r.row.id)}>
                {String(r.row.receipt_ref)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={receipts.length === 0}
            onClick={async () => {
              const t = tampered(records, pickId)
              if (!t) return
              setCopy({ check: await verifyChain(t.records), from: t.from, to: t.to, ref: pickedRef })
            }}
            className="rounded-md border border-dash-violation px-4 py-2 text-sm font-bold text-dash-violation hover:bg-dash-card-raised disabled:opacity-40"
          >
            Tamper with the amount
          </button>
          <button
            type="button"
            onClick={() => setCopy(null)}
            className="rounded-md px-3 py-2 text-sm font-semibold text-dash-body hover:bg-dash-card-raised"
          >
            Reset
          </button>
        </div>

        <div role="status" aria-live="polite" className="mt-4">
          {copy === null && <p className="text-dash-body">No tampering yet.</p>}
          {copy && (
            <div>
              <p className="text-sm text-dash-body">
                {copy.ref}: {formatMoney(copy.from)} <span aria-hidden="true">→</span>
                <span className="sr-only"> changed to </span> {formatMoney(copy.to)} in the copy
              </p>
              {copy.check.ok ? (
                <p className="mt-2 text-lg font-bold text-dash-teal">✓ Copy verified</p>
              ) : (
                <div>
                  <p className="mt-2 text-lg font-bold text-dash-violation">✕ Tampered copy fails verification</p>
                  <ul className="mt-2 text-sm text-dash-body">
                    {copy.check.problems.map((p) => (
                      <li key={`${p.chain_seq}-${p.kind}`}>{p.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card label="Chain entries">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-dash-edge text-xs uppercase tracking-wider text-dash-label">
                <th className="py-2 pr-4 font-semibold">#</th>
                <th className="py-2 pr-4 font-semibold">Type</th>
                <th className="py-2 pr-4 font-semibold">Points at</th>
                <th className="py-2 pr-4 font-semibold">Own hash</th>
                <th className="py-2 font-semibold">Check</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const c = entryChecks.find((e) => e.chain_seq === r.chain_seq)
                return (
                  <tr key={r.chain_seq} className="border-b border-dash-edge">
                    <td className="py-2 pr-4 font-semibold text-dash-ink">{r.chain_seq}</td>
                    <td className="py-2 pr-4">{r.entry_type}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{short(r.row.prev_hash)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{short(r.row.entry_hash)}</td>
                    <td className="py-2 font-semibold">
                      {!c ? (
                        <span className="text-dash-label">–</span>
                      ) : c.linkOk && c.contentOk ? (
                        <span className="text-dash-teal">✓ Matches</span>
                      ) : (
                        <span className="text-dash-violation">✕ {!c.contentOk ? 'Content changed' : 'Broken link'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-dash-label">VI-aligned demo representation. Hashes are SHA-256, chained in the order written.</p>
      </Card>
    </div>
  )
}

export default function Tamper() {
  const grants = useRows<Raw>('grants', 'chain_seq', true)
  const proposals = useRows<Raw>('proposals', 'chain_seq', true)
  const actions = useRows<Raw>('actions', 'chain_seq', true)
  const receipts = useRows<Raw>('receipts', 'chain_seq', true)
  const events = useRows<Raw>('dispute_events', 'chain_seq', true)
  const all = [grants, proposals, actions, receipts, events]

  const failed = all.find((s) => s.status === 'error')
  const loading = all.some((s) => s.status === 'loading')
  const state: Rows<ChainRecord> = failed
    ? (failed as Rows<ChainRecord>)
    : loading
      ? { status: 'loading' }
      : {
          status: 'ready',
          rows: [
            ...(toRecords('grant', grants) ?? []),
            ...(toRecords('proposal', proposals) ?? []),
            ...(toRecords('action', actions) ?? []),
            ...(toRecords('receipt', receipts) ?? []),
            ...(toRecords('dispute_event', events) ?? []),
          ],
        }

  return (
    <div>
      <PageTitle title="Tamper">
        Every record carries a hash of its own contents and points at the record before it. Change any record and it no
        longer matches.
      </PageTitle>
      <Live state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="The chain is empty.">
              Entries are added when a shopper confirms a grant and an agent acts. Once there are entries, you can verify
              the chain here and try the tamper demo. This page reads the database live.
            </Empty>
          ) : (
            <Verifier records={rows} />
          )
        }
      </Live>
    </div>
  )
}


