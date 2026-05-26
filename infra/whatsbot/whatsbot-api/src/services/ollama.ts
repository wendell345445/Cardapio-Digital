import { env } from '../env.js'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  message: { content: string }
}

interface EmbedResponse {
  embedding: number[]
}

// Em CPU, o primeiro chat costuma levar 30-60s só pra carregar o modelo;
// chats subsequentes 5-15s. Embedding é leve. Damos folga generosa pra cold
// start; subsequente vai retornar bem antes.
const CHAT_TIMEOUT_MS = 180_000
const EMBED_TIMEOUT_MS = 30_000

async function ollamaFetch<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${env.OLLAMA_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama ${path} ${res.status}: ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  const data = await ollamaFetch<ChatResponse>(
    '/api/chat',
    {
      model: env.OLLAMA_CHAT_MODEL,
      messages,
      stream: false,
      options: {
        // Limita tamanho da resposta — WhatsApp informativo é curto. Cada token
        // gerado em CPU custa ~150ms, então cortar em 180 já controla muito.
        num_predict: 180,
        // Temperatura baixa pra evitar alucinação de produto/preço.
        temperature: 0.3,
        // Contexto enxuto: prompt + resposta deve caber em 4096 (max do 3b).
        num_ctx: 4096,
      },
    },
    CHAT_TIMEOUT_MS
  )
  return data.message.content.trim()
}

export async function embed(text: string): Promise<number[]> {
  const data = await ollamaFetch<EmbedResponse>(
    '/api/embeddings',
    { model: env.OLLAMA_EMBED_MODEL, prompt: text },
    EMBED_TIMEOUT_MS
  )
  return data.embedding
}
