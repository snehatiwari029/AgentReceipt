import type { MismatchResult, Recommendation } from '../../shared/schemas'

// Colour is never the only signal: every badge has text.
export function RecommendationBadge({ value }: { value: Recommendation }) {
  const map: Record<Recommendation, { text: string; cls: string }> = {
    represent: { text: 'Represent', cls: 'border-dash-teal text-dash-teal' },
    concede: { text: 'Concede', cls: 'border-dash-violation text-dash-violation' },
    review: { text: 'Review', cls: 'border-dash-attention text-dash-attention' },
  }
  const m = map[value]
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-bold ${m.cls}`}>{m.text}</span>
}

export function MatchBadge({ value }: { value: MismatchResult['result'] }) {
  if (value === 'mismatch') {
    return <span className="font-bold text-dash-violation">✕ Mismatch</span>
  }
  if (value === 'match') {
    return <span className="font-semibold text-dash-teal">✓ Match</span>
  }
  return <span className="font-semibold text-dash-label">– Not specified</span>
}
