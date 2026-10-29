import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Receipt } from '../../shared/schemas'
import { useRows, type Rows } from '../data'
import { Card, Empty, Live, PageTitle } from '../components/Panel'
import { CATEGORY_LABELS, PILLAR_NAMES, type Category, type Pillar, type PillarResult } from '../../../supabase/functions/optimizer/checks'
import { callOptimizer, rankSuggestions, STATUS_LABEL, type Scan, type ScanListing, type Suggestion } from '../optimizer'

// The dashboard is Northwind's (demo sign-in). Everything below is filtered to this merchant.
const MERCHANT_NAME = 'Northwind Outfitters'

// Counted live from the line-by-line checks stored on receipts. Never a hard-coded number.
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

export function fieldCounts(receipts: Receipt[]): { field: string; count: number }[] {
  const map = new Map<string, number>()
  for (const c of causeCounts(receipts)) map.set(c.field, (map.get(c.field) ?? 0) + c.count)
  return [...map.entries()].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count || a.field.localeCompare(b.field))
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

// Colour is never the only signal: every chip and card also says what it means in words.
const RESULT_STYLE: Record<PillarResult, { text: string; cls: string }> = {
  contradiction: { text: 'Contradiction', cls: 'border-dash-violation text-dash-violation' },
  missing: { text: 'Missing', cls: 'border-dash-attention text-dash-attention' },
  pass: { text: 'Pass', cls: 'border-dash-teal text-dash-teal' },
  not_checked: { text: 'Not checked', cls: 'border-dash-edge text-dash-label' },
}
const SEVERITY: Record<string, { label: string; border: string; text: string }> = {
  violation: { label: 'Fix first', border: 'border-dash-violation', text: 'text-dash-violation' },
  attention: { label: 'Blocks agent parsing', border: 'border-dash-attention', text: 'text-dash-attention' },
  lower: { label: 'Lower impact', border: 'border-dash-edge', text: 'text-dash-label' },
}

type Filters = { pillar: 'all' | Pillar; type: 'all' | 'contradiction' | 'missing'; caused: boolean }
const matches = (s: Suggestion, f: Filters) =>
  (f.pillar === 'all' || s.pillar === f.pillar) && (f.type === 'all' || s.flag_type === f.type) && (!f.caused || s.caused_mismatch_count > 0)

export default function Optimization() {
  const [reload, setReload] = useState(0)
  const merchants = useRows<{ id: string; name: string }>('merchants', 'name', true)
  const scans = useRows<Scan>('optimizer_scans', 'scanned_at', false, reload)
  const suggestions = useRows<Suggestion>('optimizer_suggestions', 'category', true, reload)
  const receipts = useRows<Receipt>('receipts', 'chain_seq', false, reload)

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Optimization for Agents">
        What an agent shopping for a customer cannot find, parse or compare in your listings, and the fix for each.
        You approve every fix; nothing here edits a listing, price, term or page.
      </PageTitle>
      <Live state={merchants}>
        {(rows) => {
          const merchant = rows.find((m) => m.name === MERCHANT_NAME)
          if (!merchant) return <Empty title="Merchant not found.">No merchant named {MERCHANT_NAME} in the merchants table.</Empty>
          return (
            <Live state={scans}>
              {(scanRows) => (
                <Live state={suggestions}>
                  {(sugRows) => (
                    <Workspace
                      merchant={merchant}
                      scan={scanRows.find((s) => s.merchant_id === merchant.id) ?? null}
                      suggestions={sugRows.filter((s) => s.merchant_id === merchant.id)}
                      receipts={receipts}
                      onChanged={() => setReload((n) => n + 1)}
                    />
                  )}
                </Live>
              )}
            </Live>
          )
        }}
      </Live>
    </div>
  )
}

function Workspace({ merchant, scan, suggestions, receipts, onChanged }: {
  merchant: { id: string; name: string }
  scan: Scan | null
  suggestions: Suggestion[]
  receipts: Rows<Receipt>
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [filters, setFilters] = useState<Filters>({ pillar: 'all', type: 'all', caused: false })
  const current = useMemo(() => {
    const listed = new Set(scan?.results.map((r) => r.product_id) ?? [])
    return suggestions.filter((s) => listed.has(s.product_id))
  }, [scan, suggestions])
  const shown = current.filter((s) => matches(s, filters))
  const pendingShown = shown.filter((s) => s.status === 'pending')

  async function scanNow() {
    setBusy('scan')
    setMessage(null)
    const r = await callOptimizer({ action: 'scan', merchant_id: merchant.id })
    setBusy(null)
    if (r.type === 'scan') {
      setMessage({ ok: true, text: `Scan finished: ${r.listings_scanned} listings, ${r.flags} flags. Resolved on re-scan: ${r.resolved}. Still flagged after approval: ${r.still_flagged}.` })
      onChanged()
    } else setMessage({ ok: false, text: r.type === 'error' ? r.message : 'Unexpected answer.' })
  }

  async function approveAll() {
    setBusy('all')
    setMessage(null)
    const r = await callOptimizer({ action: 'approve_all', merchant_id: merchant.id, suggestion_ids: pendingShown.map((s) => s.id) })
    setBusy(null)
    if (r.type === 'approve_all') {
      setMessage({ ok: true, text: `Approved ${r.approved}. ${r.skipped_unfilled} left pending because a To-be-filled field is empty. Nothing in your store was changed.` })
      onChanged()
    } else setMessage({ ok: false, text: r.type === 'error' ? r.message : 'Unexpected answer.' })
  }

  return (
    <>
      <Card label="Optimizer header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-dash-ink">{merchant.name}</p>
            <Link to="/shop" className="text-sm font-semibold text-dash-teal hover:underline">View Store</Link>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <button
              type="button" onClick={scanNow} disabled={busy !== null}
              className="rounded-md border border-dash-teal px-4 py-2 text-sm font-semibold text-dash-teal hover:bg-dash-card-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'scan' ? 'Scanning…' : 'Scan Now'}
            </button>
            <div className="max-w-xs">
              <button
                type="button" onClick={approveAll} disabled={busy !== null || pendingShown.length === 0}
                className="rounded-md border border-dash-edge px-4 py-2 text-sm font-semibold text-dash-ink hover:bg-dash-card-raised disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'all' ? 'Approving…' : `Approve All (${pendingShown.length})`}
              </button>
              <p className="mt-1 text-xs text-dash-label">
                Approves the pending suggestions shown below. It does not apply them: no listing, price, term or page
                changes. You apply each fix in your store, then Scan Now verifies it. Suggestions with an empty
                To-be-filled field stay pending.
              </p>
            </div>
          </div>
        </div>
        {message && (
          <p role="status" className={`mt-3 text-sm ${message.ok ? 'text-dash-body' : 'text-dash-violation'}`}>{message.text}</p>
        )}
      </Card>

      {!scan ? (
        <Empty title="No scan yet.">Click Scan Now to scan your listings. Results come only from a scan of your live catalogue.</Empty>
      ) : (
        <>
          <ScanSummary scan={scan} suggestions={current} receipts={receipts} />
          <FilterBar filters={filters} onChange={setFilters} />
          <ListingList scan={scan} suggestions={current} filters={filters} merchantId={merchant.id} onChanged={onChanged} />
        </>
      )}
    </>
  )
}

function ScanSummary({ scan, suggestions, receipts }: { scan: Scan; suggestions: Suggestion[]; receipts: Rows<Receipt> }) {
  const withContradiction = scan.results.filter((r) => r.pillars.some((p) => p.result === 'contradiction')).length
  const withMissing = scan.results.filter((r) => r.pillars.some((p) => p.result === 'missing')).length
  const open = rankSuggestions(suggestions.filter((s) => s.status !== 'resolved' && s.status !== 'rejected'))
  const top = open[0]
  const topText = top ? `${CATEGORY_LABELS[top.category as Category]}s first${top.mismatch_fields[0] ? ` — ${top.mismatch_fields[0]}` : ''}` : 'Nothing open'
  const m = scan.markup
  const sparkText = Object.entries(scan.spark).map(([k, n]) => `${k} on ${n}`).join(', ')

  return (
    <Card label="Scan summary">
      <dl className="grid gap-4 sm:grid-cols-4">
        {[
          ['Listings scanned', String(scan.listings_scanned)],
          ['With at least one Contradiction', String(withContradiction)],
          ['With at least one Missing flag', String(withMissing)],
          ['Top priority', topText],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-dash-label">{k}</dt>
            <dd className="mt-1 text-lg font-bold text-dash-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 flex flex-col gap-1 text-xs text-dash-label">
        <li>Last scan: {new Date(scan.scanned_at).toLocaleString()}. Catalogue: {scan.catalogue_source}.</li>
        <li>
          Schema.org check:{' '}
          {m.status === 'fetched'
            ? `HTML as served at ${m.url} (HTTP ${m.http_status}, ${m.bytes} bytes). No JavaScript is run, as many crawlers read it. ${m.products_found} Product block(s) found.`
            : `not checked — ${m.error}`}
        </li>
        <li>Semantic reading: {sparkText}. rules-fallback means deterministic check only, Spark deconstruction unavailable.</li>
      </ul>
      <div className="mt-4 border-t border-dash-edge pt-4">
        <p className="text-sm font-semibold text-dash-ink">Order check mismatches across your catalogue (counted live from receipts)</p>
        <div className="mt-2">
          <Live state={receipts}>
            {(rows) => {
              const counts = fieldCounts(rows)
              if (counts.length === 0) return <p className="text-sm text-dash-body">No mismatches recorded yet.</p>
              return (
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {counts.map((c) => (
                    <li key={c.field}><span className="font-semibold text-dash-ink">{c.field}</span> mismatches: <span className="font-bold text-dash-violation">{c.count}</span></li>
                  ))}
                </ul>
              )
            }}
          </Live>
        </div>
      </div>
    </Card>
  )
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const sel = 'rounded-md border border-dash-edge bg-dash-card-raised px-2 py-1 text-sm text-dash-ink'
  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-4 text-sm">
      <label className="flex items-center gap-2">
        Pillar
        <select className={sel} value={String(filters.pillar)} onChange={(e) => onChange({ ...filters, pillar: e.target.value === 'all' ? 'all' : (Number(e.target.value) as Pillar) })}>
          <option value="all">All pillars</option>
          {([1, 2, 3, 4, 5] as Pillar[]).map((p) => <option key={p} value={p}>{p}. {PILLAR_NAMES[p]}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2">
        Flag type
        <select className={sel} value={filters.type} onChange={(e) => onChange({ ...filters, type: e.target.value as Filters['type'] })}>
          <option value="all">All</option>
          <option value="contradiction">Contradiction</option>
          <option value="missing">Missing</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={filters.caused} onChange={(e) => onChange({ ...filters, caused: e.target.checked })} />
        Caused a real order mismatch
      </label>
    </div>
  )
}

function ListingList({ scan, suggestions, filters, merchantId, onChanged }: {
  scan: Scan; suggestions: Suggestion[]; filters: Filters; merchantId: string; onChanged: () => void
}) {
  const filtering = filters.pillar !== 'all' || filters.type !== 'all' || filters.caused
  // The worked example opens by default: the first listing with real Order check mismatches.
  const firstWithHistory = scan.results.find((r) => r.order_history.orders.length > 0)?.product_id ?? null
  const [open, setOpen] = useState<Set<string>>(() => new Set(firstWithHistory ? [firstWithHistory] : []))
  const listings = scan.results.filter((r) => !filtering || suggestions.some((s) => s.product_id === r.product_id && matches(s, filters)))
  if (listings.length === 0) return <Empty title="No listings match these filters.">Change a filter to see more.</Empty>

  return (
    <ul className="flex flex-col gap-4" aria-label="Listings">
      {listings.map((r) => {
        const isOpen = open.has(r.product_id)
        const mine = rankSuggestions(suggestions.filter((s) => s.product_id === r.product_id && (!filtering || matches(s, filters))))
        const topPillar = r.pillars.find((p) => p.result === 'contradiction') ?? r.pillars.find((p) => p.result === 'missing')
        return (
          <li key={r.product_id} className="rounded-xl border border-dash-edge bg-dash-card p-5" data-testid="optimizer-listing">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-dash-ink">{r.product_name}</p>
                <p className="mt-1 text-sm text-dash-body">
                  {r.product_scope ?? 'scope missing'} · {r.size_cm !== null ? `${r.size_cm} cm` : 'size missing'} · {r.colour ?? 'colour missing'} · {money(r.price_cents)}
                </p>
                {topPillar && <p className="mt-1 text-sm text-dash-body">Pillar {topPillar.pillar}: {topPillar.summary}</p>}
              </div>
              <button
                type="button" aria-expanded={isOpen}
                onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(r.product_id)) n.delete(r.product_id); else n.add(r.product_id); return n })}
                className="rounded-md border border-dash-edge px-3 py-1.5 text-sm font-semibold text-dash-ink hover:bg-dash-card-raised"
              >
                {isOpen ? 'Hide checklist' : 'Show checklist and fixes'}
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Pillar summary for ${r.product_name}`}>
              {r.pillars.map((p) => (
                <li key={p.pillar} className={`rounded border px-2 py-0.5 text-xs font-bold ${RESULT_STYLE[p.result].cls}`}>
                  P{p.pillar} {RESULT_STYLE[p.result].text}
                </li>
              ))}
            </ul>
            {isOpen && <ListingDetail listing={r} suggestions={mine} merchantId={merchantId} onChanged={onChanged} />}
          </li>
        )
      })}
    </ul>
  )
}

function ListingDetail({ listing, suggestions, merchantId, onChanged }: { listing: ScanListing; suggestions: Suggestion[]; merchantId: string; onChanged: () => void }) {
  const h = listing.order_history
  const d = listing.semantic.deconstructed
  const parts = d ? Object.entries(d).filter(([, v]) => v !== null) : []
  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-dash-edge pt-4">
      {h.orders.length > 0 && (
        <p className="rounded-lg border border-dash-attention bg-dash-card-raised p-3 text-sm">
          <span className="font-semibold text-dash-ink">Order check:</span> {h.orders.length} order{h.orders.length > 1 ? 's' : ''} on this listing had mismatches — {h.orders.join(', ')}.{' '}
          {Object.entries(h.fields).map(([f, n]) => `${f} mismatches: ${n}`).join(' · ')}. The flags below are the causes.{' '}
          <Link to="/dashboard/orders" className="font-semibold text-dash-teal hover:underline">Open Agent orders</Link>
        </p>
      )}
      <p className="text-xs text-dash-label">
        Semantic reading: <span className={listing.semantic.source === 'muse-spark' ? 'text-dash-teal' : 'text-dash-attention'}>{listing.semantic.label}</span>. {listing.semantic.reason}
        {parts.length > 0 && <> Spark read the copy as: {parts.map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(', ')}.</>}
      </p>
      <table className="w-full text-left text-sm">
        <caption className="mb-2 text-left font-semibold text-dash-ink">Pillar 1–5 checklist</caption>
        <thead className="text-xs text-dash-label">
          <tr><th className="py-1 pr-3">Pillar</th><th className="py-1 pr-3">Result</th><th className="py-1">Evidence</th></tr>
        </thead>
        <tbody>
          {listing.pillars.map((p) => (
            <tr key={p.pillar} className="border-t border-dash-edge align-top">
              <td className="py-2 pr-3 text-dash-ink">{p.pillar}. {p.name}</td>
              <td className={`py-2 pr-3 font-bold ${RESULT_STYLE[p.result].cls.split(' ')[1]}`}>{RESULT_STYLE[p.result].text}</td>
              <td className="py-2">
                <ul className="flex flex-col gap-1">
                  {suggestions.filter((s) => s.pillar === p.pillar).map((s) => <li key={s.id}>{s.subtype}: {s.title}</li>)}
                  {p.notes.map((n) => <li key={n} className="text-dash-label">{n}</li>)}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <p className="font-semibold text-dash-ink">Suggested fixes, highest impact first</p>
        <ul className="mt-2 flex flex-col gap-3">
          {suggestions.map((s) => <SuggestionCard key={`${s.id}-${s.status}`} s={s} merchantId={merchantId} onChanged={onChanged} />)}
        </ul>
      </div>
    </div>
  )
}

function SuggestionCard({ s, merchantId, onChanged }: { s: Suggestion; merchantId: string; onChanged: () => void }) {
  const editable = s.status === 'pending' || s.status === 'rejected'
  const [fix, setFix] = useState(s.merchant_fix_text ?? s.suggested_fix)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(s.value_fields.map((f) => [f, s.merchant_values?.[f] ?? ''])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sev = SEVERITY[s.severity] ?? SEVERITY.lower
  const unfilled = s.value_fields.filter((f) => !values[f]?.trim())

  async function act(decision: 'approve' | 'reject') {
    setBusy(true)
    setError(null)
    const r = await callOptimizer({ action: 'decide', merchant_id: merchantId, suggestion_id: s.id, decision, fix_text: fix, values })
    setBusy(false)
    if (r.type === 'decision') onChanged()
    else setError(r.type === 'error' ? r.message : 'Unexpected answer.')
  }

  return (
    <li className={`rounded-lg border-l-4 ${sev.border} bg-dash-card-raised p-4`} data-testid="optimizer-suggestion">
      <p className="flex flex-wrap gap-x-3 text-xs font-bold">
        <span className={sev.text}>{CATEGORY_LABELS[s.category as Category]} · {sev.label}</span>
        <span className="text-dash-label">Pillar {s.pillar} · {s.subtype}</span>
        {s.caused_mismatch_count > 0 && <span className="text-dash-violation">Linked to {s.caused_mismatch_count} real Order check mismatch{s.caused_mismatch_count > 1 ? 'es' : ''} ({s.mismatch_fields.join(', ')})</span>}
        {s.source !== 'deterministic' && <span className="text-dash-label">{s.source}</span>}
      </p>
      <p className="mt-1 font-semibold text-dash-ink">{s.title}</p>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {s.evidence.map((e) => <li key={e} className="break-words">{e}</li>)}
      </ul>
      <p className="mt-2 text-sm"><span className="text-dash-label">Impact: </span>{s.impact}</p>
      {editable ? (
        <label className="mt-3 block text-sm">
          <span className="text-dash-label">Suggested fix (you can edit it before approving)</span>
          <textarea
            value={fix} onChange={(e) => setFix(e.target.value)} rows={Math.min(14, fix.split('\n').length + 1)}
            className="mt-1 w-full rounded-md border border-dash-edge bg-dash-card p-2 font-mono text-xs text-dash-ink"
          />
        </label>
      ) : (
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-md border border-dash-edge bg-dash-card p-2 font-mono text-xs text-dash-ink">{s.merchant_fix_text ?? s.suggested_fix}</pre>
      )}
      {s.value_fields.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {s.value_fields.map((f) => (
            <label key={f} className="text-sm">
              <span className="text-dash-label">To be filled by merchant: {f}</span>
              <input
                value={values[f] ?? ''} disabled={!editable} placeholder="Empty — type your value"
                onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                className="mt-1 w-full rounded-md border border-dash-edge bg-dash-card px-2 py-1 text-dash-ink placeholder:text-dash-label"
              />
            </label>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm font-semibold text-dash-ink">
        Status: {STATUS_LABEL[s.status]}
        {s.decided_at && s.status !== 'pending' && <span className="font-normal text-dash-label"> · {s.decided_by}, {new Date(s.decided_at).toLocaleString()}</span>}
      </p>
      {s.rescan_result && <p className="mt-1 text-sm text-dash-body">Re-scan: {s.rescan_result}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-dash-violation">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {editable && (
          <button
            type="button" onClick={() => act('approve')} disabled={busy || unfilled.length > 0}
            className="rounded-md border border-dash-teal px-3 py-1.5 text-sm font-semibold text-dash-teal hover:bg-dash-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {(s.status === 'pending' || s.status === 'approved' || s.status === 'still_flagged') && (
          <button
            type="button" onClick={() => act('reject')} disabled={busy}
            className="rounded-md border border-dash-edge px-3 py-1.5 text-sm font-semibold text-dash-body hover:bg-dash-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        )}
        {editable && unfilled.length > 0 && <span className="text-xs text-dash-attention">Fill {unfilled.join(', ')} to approve.</span>}
        {editable && <span className="text-xs text-dash-label">Approving records your decision. It does not change your listing.</span>}
      </div>
    </li>
  )
}
