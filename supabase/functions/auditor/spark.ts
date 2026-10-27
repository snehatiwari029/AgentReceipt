// The auditor's own Muse Spark client. Separate from the shopper's: the auditor never imports shopper code.
// Spark does exactly one job here: read the agent's believed-returns phrase and say what it claims
// (returnable / final sale / unclear). It never sees the chat, never decides the verdict, never touches a hash.
import { kindOfText, type SemanticReturns } from './audit.ts'

export const META_CHAT_URL = 'https://api.meta.ai/v1/chat/completions'
export const MODEL_NAME = 'muse-spark-1.3'

export interface SemanticReader {
  readReturns(believed: string, formalTermsText: string): Promise<SemanticReturns>
}

const SYSTEM =
  'You are the AgentReceipt auditor. You are given two short texts: the merchant\'s formal returns terms and what a shopping agent told its customer about returns. ' +
  'Say what the AGENT\'S text claims about returns, regardless of what the formal terms say. ' +
  'Answer with JSON only, exactly {"believed_kind":"returnable"|"final_sale"|"unclear"}. ' +
  '"returnable" = the agent\'s text says the item can be returned or exchanged. "final_sale" = it says no returns or final sale. "unclear" = it says neither.'

function fallback(believed: string): SemanticReturns {
  const k = kindOfText(believed)
  return { believed_kind: k ?? 'unclear', source: 'rules-fallback' }
}

// With no key, a failing call or an unreadable answer, the plain keyword reading is used and labelled as such.
export function createSparkReader(apiKey: string | undefined | null, fetchFn: typeof fetch = fetch): SemanticReader {
  return {
    async readReturns(believed, formal) {
      const key = apiKey?.trim()
      if (!key) return fallback(believed)
      try {
        const res = await fetchFn(META_CHAT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: JSON.stringify({ formal_terms_text: formal, agent_text: believed }) },
            ],
          }),
        })
        if (!res.ok) return fallback(believed)
        const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null
        const content = json?.choices?.[0]?.message?.content
        if (typeof content !== 'string') return fallback(believed)
        const m = content.match(/\{[^{}]*\}/)
        const kind = m ? (JSON.parse(m[0]) as { believed_kind?: unknown }).believed_kind : null
        if (kind === 'returnable' || kind === 'final_sale' || kind === 'unclear') return { believed_kind: kind, source: 'muse-spark' }
        return fallback(believed)
      } catch {
        return fallback(believed)
      }
    },
  }
}
