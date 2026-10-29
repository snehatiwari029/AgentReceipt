import { useEffect, useState } from 'react'
import type { MerchantReview, Receipt } from '../../shared/schemas'
import { supabase } from '../../shared/supabase'
import { ACTION_TAKEN_LABEL, METHOD_LABEL, RELEASE_LABEL } from '../../../supabase/functions/disputes/pack'
import { callDisputes, MERCHANT_NAME } from '../disputes'

const INPUT = 'w-full rounded-md border border-dash-edge bg-dash-card px-2 py-1.5 text-sm text-dash-ink'
const LABEL = 'block text-xs font-semibold uppercase tracking-wider text-dash-label'
const CONFIRMING = ['called_confirmed', 'emailed_confirmed']

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; merchantId: string | null; reviews: MerchantReview[] }

// Layer 2, captured at review time: what the merchant did after a Review Required / Hold for Suspicion flag.
// Each action is its own chained record, appended in order. The order's grant, action, verdict and receipt are never
// edited. This records what the merchant did; it sends no email and makes no link.
export default function MerchantActions({ receipt }: { receipt: Receipt }) {
  const [reload, setReload] = useState(0)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    if (!supabase) { setLoad({ status: 'error', message: 'Supabase is not configured.' }); return }
    const db = supabase
    Promise.all([
      db.from('merchants').select('id,name').eq('name', MERCHANT_NAME),
      db.from('merchant_reviews').select('*').eq('receipt_id', receipt.id).order('chain_seq', { ascending: true }),
    ]).then(
      ([m, r]) => {
        if (cancelled) return
        if (m.error || r.error) { setLoad({ status: 'error', message: (m.error ?? r.error)!.message }); return }
        const merchant = ((m.data ?? []) as { id: string }[])[0]
        setLoad({ status: 'ready', merchantId: merchant?.id ?? null, reviews: ((r.data ?? []) as MerchantReview[]).filter((x) => x.receipt_id === receipt.id) })
      },
      (e: unknown) => { if (!cancelled) setLoad({ status: 'error', message: e instanceof Error ? e.message : 'Network error' }) },
    )
    return () => { cancelled = true }
  }, [receipt.id, reload])

  return (
    <div className="mt-5 border-t border-dash-edge pt-4" data-testid="merchant-actions">
      <p className="text-sm font-bold text-dash-ink">Merchant review record</p>
      <p className="text-xs text-dash-label">What you did after this flag, recorded now, at review time. Each entry is a separate record; earlier entries are never changed. The check above is not edited.</p>
      {load.status === 'loading' && <p className="mt-2 text-sm text-dash-body">Loading…</p>}
      {load.status === 'error' && <p className="mt-2 text-sm text-dash-violation">Could not load merchant review records: {load.message}</p>}
      {load.status === 'ready' && (
        <>
          <ol className="mt-2 flex flex-col gap-2 text-sm" data-testid="review-timeline">
            {load.reviews.length === 0 && <li className="text-dash-body">No merchant review record.</li>}
            {load.reviews.map((r) => (
              <li key={r.id} className="rounded-md border border-dash-edge p-2">
                <span className="font-semibold text-dash-ink">{ACTION_TAKEN_LABEL[r.action_taken]}</span>
                <span className="ml-2 text-xs text-dash-label">{r.recorded_at} · {METHOD_LABEL[r.method]} · {RELEASE_LABEL[r.release_decision]}</span>
                <span className="block text-dash-body">{r.notes}</span>
                {(r.confirmed_total || r.confirmed_terms) && <span className="block text-dash-body">Confirmed: {[r.confirmed_total, r.confirmed_terms].filter(Boolean).join(' · ')}</span>}
                <span className="block break-all font-mono text-xs text-dash-label">Record {r.entry_hash}</span>
              </li>
            ))}
          </ol>
          {load.merchantId ? <ActionForm receiptId={receipt.id} merchantId={load.merchantId} onSaved={() => setReload((n) => n + 1)} /> : <p className="mt-2 text-sm text-dash-violation">Merchant not found.</p>}
        </>
      )}
    </div>
  )
}

function ActionForm({ receiptId, merchantId, onSaved }: { receiptId: string; merchantId: string; onSaved: () => void }) {
  const empty = { action_taken: '', method: '', notes: '', confirmed_total: '', confirmed_terms: '', release_decision: '' }
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const confirming = CONFIRMING.includes(f.action_taken)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const submit = async () => {
    setBusy(true); setMsg(null)
    const r = await callDisputes({
      action: 'record_review', merchant_id: merchantId, receipt_id: receiptId, action_taken: f.action_taken, method: f.method, notes: f.notes,
      confirmed_total: confirming ? f.confirmed_total.trim() || null : null, confirmed_terms: confirming ? f.confirmed_terms.trim() || null : null,
      release_decision: f.release_decision,
    })
    setBusy(false)
    if (r.type === 'error') { setMsg(r.message); return }
    setF(empty)
    setMsg('Merchant action recorded.')
    onSaved()
  }
  return (
    <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void submit() }} aria-label="Record merchant action">
      <p className="text-sm font-semibold text-dash-ink md:col-span-3">Record merchant action</p>
      <label><span className={LABEL}>Action taken</span>
        <select className={INPUT} value={f.action_taken} onChange={set('action_taken')} required aria-label="Action taken">
          <option value="">Choose…</option>
          {Object.entries(ACTION_TAKEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label><span className={LABEL}>Method</span>
        <select className={INPUT} value={f.method} onChange={set('method')} required aria-label="Method">
          <option value="">Choose…</option>
          {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label><span className={LABEL}>Release decision</span>
        <select className={INPUT} value={f.release_decision} onChange={set('release_decision')} required aria-label="Release decision">
          <option value="">Choose…</option>
          {Object.entries(RELEASE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="md:col-span-3"><span className={LABEL}>Reason / notes, in your own words</span>
        <textarea className={INPUT} rows={2} value={f.notes} onChange={set('notes')} required aria-label="Reason / notes" />
      </label>
      {confirming && (
        <>
          <label><span className={LABEL}>Confirmed total (exactly as confirmed)</span><input className={INPUT} value={f.confirmed_total} onChange={set('confirmed_total')} aria-label="Confirmed total" /></label>
          <label className="md:col-span-2"><span className={LABEL}>Confirmed terms (exactly as confirmed)</span><input className={INPUT} value={f.confirmed_terms} onChange={set('confirmed_terms')} aria-label="Confirmed terms" /></label>
        </>
      )}
      <p className="text-xs text-dash-label md:col-span-2">The timestamp is set when the record is saved and cannot be edited.</p>
      <div><button type="submit" disabled={busy} className="rounded-md border border-dash-teal px-3 py-1.5 text-sm font-semibold text-dash-teal hover:bg-dash-card disabled:opacity-50">{busy ? 'Recording…' : 'Record merchant action'}</button></div>
      {msg && <p role="status" className="text-sm font-semibold text-dash-ink md:col-span-3">{msg}</p>}
    </form>
  )
}
