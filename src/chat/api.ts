import type { AgentReply } from './types'

// The phone screen talks to one place: the shopper-agent function. It sends the typed words and shows the answer.
export type AgentRequestBody = {
  messages: { role: 'user' | 'assistant'; text: string }[]
  session_id?: string | null
  draft?: unknown
  offers?: unknown[]
  confirm?: boolean
}

export async function askAgent(body: AgentRequestBody): Promise<AgentReply> {
  const base = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!base || !key) return { type: 'error', message: 'This screen is not connected yet.' }
  try {
    const res = await fetch(`${base}/functions/v1/shopper-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as AgentReply | null
    if (json && typeof json === 'object' && 'type' in json) return json
    return { type: 'error', message: 'Muse could not answer just now. Please try again.' }
  } catch {
    return { type: 'error', message: 'Could not reach Muse. Check your connection and try again.' }
  }
}
