import type { ReturnsTerm } from '../types'
import { returnsLabel } from '../lib/format'

// Neutral styling on purpose: red and amber are reserved for violations on the merchant side.
// The meaning is carried by the text and the icon, never by colour alone.
export default function ReturnsChip({ term }: { term: ReturnsTerm }) {
  const free = term === 'free'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        free ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-50 text-slate-800'
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {free ? <path d="M2 6.5l2.5 2.5L10 3.5" /> : <path d="M3 3l6 6M9 3l-6 6" />}
      </svg>
      {returnsLabel(term)}
    </span>
  )
}
