// The auditor's own Muse Spark client. Separate from the shopper's: the auditor never imports shopper code.
//
// Spark does language work only, on STRUCTURED fields the shopper wrote to its proposal record. It never sees the
// chat, never sees proposal free text, never does arithmetic, never touches a hash and never decides the verdict.
//   Call 3  readReturns   agent_summary_returns + agent_believed_terms vs formal terms_text -> same meaning? (true/false + reason)
//   Call 4  readDelivery  agent_summary_delivery phrase -> an exact date (only when code cannot read the phrase itself)
// Each call has its own prompt, JSON-only output, and a labelled `rules-fallback` if the model call fails.
import { kindOfText, type SemanticDelivery, type SemanticReturns } from './audit.ts'

export const META_CHAT_URL = 'https://api.meta.ai/v1/chat/completions'
export const MODEL_NAME = 'muse-spark-1.3'

export interface SemanticReader {
  readReturns(input: { agent_summary_returns: string; agent_believed_terms: string | null; formal_returns: string | null; formal_terms_text: string }): Promise<SemanticReturns>
  readDelivery(phrase: string, today: string): Promise<SemanticDelivery>
}

const RETURNS_SYSTEM =
  'You are the AgentReceipt auditor. You get structured fields only: what a shopping agent wrote as its returns summary and its believed terms, and the merchant\'s formal returns terms. ' +
  'Decide whether the agent\'s returns claim means the same thing as the formal terms. Compare meaning, not keywords: "no-hassle returns", "30-day returns", "easy returns" and "free returns" all claim the item can be returned; ' +
  '"final sale" and "no returns" claim it cannot. A claim of returns when the terms say final sale does NOT match. ' +
  'Answer with JSON only, exactly {"returns_summary_matches_terms": true|false|null, "reason": "<one short sentence>"}. Use null only if the agent\'s fields say nothing about returns.'

const DELIVERY_SYSTEM =
  'You are the AgentReceipt auditor. Rewrite a delivery phrase as an exact calendar date. You are given the phrase and today\'s date. ' +
  'Answer with JSON only, exactly {"claimed_date": "YYYY-MM-DD" | null}. Use null if the phrase does not name a date. Do not guess a year in the past.'

// ---- plain rules used when there is no key, the call fails, or the answer is unreadable ----
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

// Exact labels our own store writes ("Wed Oct 28", "Oct 28", "2026-10-28"). Anything looser is Spark's job.
export function parseExactDeliveryPhrase(phrase: string, today: string): string | null {
  const s = phrase.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))) return s
  const m = s.match(/^(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})$/i)
  if (!m) return null
  const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  const day = Number(m[2])
  if (mi < 0 || day < 1 || day > 31) return null
  const y = Number(today.slice(0, 4))
  const t = Date.parse(`${today}T00:00:00Z`)
  let cand = `${y}-${pad(mi + 1)}-${pad(day)}`
  if (Date.parse(`${cand}T00:00:00Z`) < t - 120 * 86400_000) cand = `${y + 1}-${pad(mi + 1)}-${pad(day)}`
  return Number.isNaN(Date.parse(`${cand}T00:00:00Z`)) ? null : cand
}

function returnsFallback(i: { agent_summary_returns: string; agent_believed_terms: string | null; formal_returns: string | null }): SemanticReturns {
  const claim = kindOfText(i.agent_summary_returns) ?? kindOfText(i.agent_believed_terms)
  const formal = i.formal_returns === 'final_sale' ? 'final_sale' : i.formal_returns ? 'returnable' : null
  if (claim === null || formal === null) return { returns_summary_matches_terms: null, reason: 'Keyword reading could not tell what the agent claimed.', source: 'rules-fallback' }
  return {
    returns_summary_matches_terms: claim === formal,
    reason: claim === formal ? 'Keyword reading: the agent\'s claim and the formal terms agree.' : 'Keyword reading: the agent\'s claim and the formal terms disagree.',
    source: 'rules-fallback',
  }
}

async function ask(apiKey: string | undefined | null, fetchFn: typeof fetch, system: string, user: unknown): Promise<Record<string, unknown> | null> {
  const key = apiKey?.trim()
  if (!key) return null
  try {
    const res = await fetchFn(META_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL_NAME, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(user) }] }),
    })
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null
    const content = json?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null
    const m = content.match(/\{[^{}]*\}/)
    return m ? (JSON.parse(m[0]) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function createSparkReader(apiKey: string | undefined | null, fetchFn: typeof fetch = fetch): SemanticReader {
  return {
    async readReturns(i) {
      const out = await ask(apiKey, fetchFn, RETURNS_SYSTEM, {
        agent_summary_returns: i.agent_summary_returns, agent_believed_terms: i.agent_believed_terms, formal_terms_text: i.formal_terms_text,
      })
      const v = out?.returns_summary_matches_terms
      if (out && (v === true || v === false || v === null)) {
        const reason = typeof out.reason === 'string' && out.reason.trim() ? out.reason.trim().slice(0, 200) : 'Muse Spark compared the two fields.'
        // null from the model means "said nothing about returns": use the keyword reading, labelled as such.
        return v === null ? returnsFallback(i) : { returns_summary_matches_terms: v, reason, source: 'muse-spark' }
      }
      return returnsFallback(i)
    },
    async readDelivery(phrase, today) {
      const exact = parseExactDeliveryPhrase(phrase, today)
      if (exact) return { claimed_date: exact, source: 'rules-fallback' } // an exact label needs no model
      const out = await ask(apiKey, fetchFn, DELIVERY_SYSTEM, { phrase, today })
      const d = out?.claimed_date
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))) return { claimed_date: d, source: 'muse-spark' }
      return { claimed_date: null, source: 'rules-fallback' }
    },
  }
}
