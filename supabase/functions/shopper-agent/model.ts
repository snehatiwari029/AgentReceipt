// Meta Model API client (chat completions). Pure TypeScript, no Deno globals, so tests can import it.
// Endpoint and request shape verified from https://dev.meta.ai/docs/tool-calling:
//   POST https://api.meta.ai/v1/chat/completions, Authorization: Bearer <MODEL_API_KEY>
//   tools use {type:'function', function:{...}}; tool_choice supports only "auto"; tool results go back as
//   role 'tool' messages with the matching tool_call_id, after replaying the assistant message that made the calls.

export const META_CHAT_URL = 'https://api.meta.ai/v1/chat/completions'
export const MODEL_NAME = 'muse-spark-1.3'
export const MISSING_KEY_MESSAGE = 'MODEL_API_KEY not set in Supabase secrets'

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type ToolDef = {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export type ModelReply = { content: string | null; tool_calls?: ToolCall[] }

export interface ModelClient {
  complete(messages: ChatMessage[], tools: ToolDef[]): Promise<ModelReply>
}

export class ModelKeyMissingError extends Error {
  constructor() {
    super(MISSING_KEY_MESSAGE)
    this.name = 'ModelKeyMissingError'
  }
}

export class ModelCallError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message)
    this.name = 'ModelCallError'
  }
}

export function createMetaClient(apiKey: string | undefined | null, fetchFn: typeof fetch = fetch): ModelClient {
  if (!apiKey || !apiKey.trim()) throw new ModelKeyMissingError()
  const key = apiKey.trim()
  return {
    async complete(messages, tools) {
      const body: Record<string, unknown> = { model: MODEL_NAME, messages }
      if (tools.length > 0) {
        body.tools = tools
        body.tool_choice = 'auto' // the only value the API accepts
        body.parallel_tool_calls = false
      }
      let res: Response
      try {
        res = await fetchFn(META_CHAT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {
        throw new ModelCallError('Could not reach the Meta Model API', null)
      }
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).slice(0, 300)
        throw new ModelCallError(`Meta Model API returned ${res.status}${text ? `: ${text}` : ''}`, res.status)
      }
      const json = (await res.json().catch(() => null)) as {
        choices?: { message?: { content?: unknown; tool_calls?: unknown } }[]
      } | null
      const msg = json?.choices?.[0]?.message
      if (!msg) throw new ModelCallError('Meta Model API returned no message', res.status)
      const content = typeof msg.content === 'string' && msg.content.length > 0 ? msg.content : null
      const calls = Array.isArray(msg.tool_calls) ? (msg.tool_calls as ToolCall[]) : undefined
      return { content, tool_calls: calls && calls.length > 0 ? calls : undefined }
    },
  }
}
