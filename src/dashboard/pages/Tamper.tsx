import { useState } from 'react'
import { verifyLinks, withAlteredEntry, type ChainCheck, type ChainEntry } from '../../shared/chain'
import { useRows } from '../data'
import { Card, Empty, Live, PageTitle } from '../components/Panel'

const short = (h: string) => `${h.slice(0, 14)}…${h.slice(-6)}`

function Chain({ entries }: { entries: ChainEntry[] }) {
  const [alteredSeq, setAlteredSeq] = useState<number | null>(null)
  const [result, setResult] = useState<ChainCheck | null>(null)

  const shown = alteredSeq === null ? entries : withAlteredEntry(entries, alteredSeq)
  const alterable = entries.slice(0, -1)
  const [pick, setPick] = useState<number>(alterable[0]?.chain_seq ?? 0)
  const badSeqs = new Set(result?.problems.map((p) => p.chain_seq) ?? [])

  return (
    <div className="flex flex-col gap-6">
      <Card label="Chain check">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setResult(verifyLinks(shown))}
            className="rounded-md bg-dash-teal px-4 py-2 text-sm font-bold text-dash-page-bottom hover:opacity-90"
          >
            Verify chain
          </button>
          <label htmlFor="alter-entry" className="text-sm text-dash-body">
            Entry to alter
          </label>
          <select
            id="alter-entry"
            value={pick}
            onChange={(e) => setPick(Number(e.target.value))}
            disabled={alterable.length === 0}
            className="rounded-md border border-dash-edge bg-dash-card-raised px-2 py-2 text-sm text-dash-ink"
          >
            {alterable.map((e) => (
              <option key={e.chain_seq} value={e.chain_seq}>
                #{e.chain_seq} {e.entry_type}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={alterable.length === 0}
            onClick={() => {
              setAlteredSeq(pick)
              setResult(null)
            }}
            className="rounded-md border border-dash-violation px-4 py-2 text-sm font-bold text-dash-violation hover:bg-dash-card-raised disabled:opacity-40"
          >
            Tamper with this entry
          </button>
          <button
            type="button"
            onClick={() => {
              setAlteredSeq(null)
              setResult(null)
            }}
            className="rounded-md px-3 py-2 text-sm font-semibold text-dash-body hover:bg-dash-card-raised"
          >
            Reset
          </button>
        </div>

        <p className="mt-3 text-xs text-dash-label">
          Tamper changes a copy of one entry&apos;s hash in this page, as if that record had been edited. The stored records are
          not touched.
          {alteredSeq !== null && <span className="text-dash-attention"> Entry #{alteredSeq} is altered in this view.</span>}
        </p>

        <div role="status" aria-live="polite" className="mt-4">
          {result === null && <p className="text-dash-body">Not verified yet. Press Verify chain.</p>}
          {result?.ok && (
            <p className="text-lg font-bold text-dash-teal">✓ Chain intact: {result.checked} entries, every link matches.</p>
          )}
          {result && !result.ok && (
            <div>
              <p className="text-lg font-bold text-dash-violation">✕ Verification failed</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-dash-body">
                {result.problems.map((p) => (
                  <li key={`${p.chain_seq}-${p.kind}`}>{p.message}</li>
                ))}
              </ul>
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
                <th className="py-2 font-semibold">Link</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.chain_seq} className="border-b border-dash-edge">
                  <td className="py-2 pr-4 font-semibold text-dash-ink">{e.chain_seq}</td>
                  <td className="py-2 pr-4">{e.entry_type}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{short(e.prev_hash)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{short(e.entry_hash)}</td>
                  <td className="py-2 font-semibold">
                    {result === null ? (
                      <span className="text-dash-label">–</span>
                    ) : badSeqs.has(e.chain_seq) ? (
                      <span className="text-dash-violation">✕ Broken</span>
                    ) : (
                      <span className="text-dash-teal">✓ Matches</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-dash-label">
          This check follows the links between entries and looks for missing entries. Recomputing each hash from its own
          record comes with the receipt function, which is not built yet.
        </p>
      </Card>
    </div>
  )
}

export default function Tamper() {
  const state = useRows<ChainEntry>('chain_entries', 'chain_seq', true)
  return (
    <div>
      <PageTitle title="Tamper">
        Every record points at the hash of the one before it. Change any earlier record and the next link stops matching.
      </PageTitle>
      <Live state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="The chain is empty.">
              Entries are added when a shopper confirms a grant and an agent acts. Once there are entries, you can verify
              the chain here and try the tamper demo. This page reads the database live.
            </Empty>
          ) : (
            // key resets the demo state if the chain is reloaded
            <Chain key={rows.length} entries={rows} />
          )
        }
      </Live>
    </div>
  )
}
