import axios, { AxiosError } from 'axios'

// ─── TASK-072: OllamaService via RunPod Serverless ──────────────────────────

const RUNPOD_URL = process.env.RUNPOD_URL || ''
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || ''
const TIMEOUT_MS = 30_000

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaResponse {
  message: { content: string }
}

async function callOllama(messages: OllamaMessage[]): Promise<string> {
  if (!RUNPOD_URL || !RUNPOD_API_KEY) {
    throw new Error('RunPod not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await axios.post<OllamaResponse>(
      `${RUNPOD_URL}/api/chat`,
      { model: process.env.OLLAMA_MODEL || 'llama3', messages, stream: false },
      {
        headers: {
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        timeout: TIMEOUT_MS,
      }
    )
    return response.data.message.content.trim()
  } catch (err) {
    const axiosErr = err as AxiosError
    if (
      axiosErr.code === 'ECONNABORTED' ||
      axiosErr.message?.includes('aborted') ||
      axiosErr.message?.includes('timeout')
    ) {
      throw new Error('TIMEOUT')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export type IntentType = 'order' | 'question' | 'confirm' | 'other'

export async function classifyIntent(message: string): Promise<IntentType> {
  const prompt: OllamaMessage[] = [
    {
      role: 'system',
      content: `Classifique a intenção do cliente em UMA palavra: "order" (quer fazer pedido), "question" (dúvida sobre cardápio/loja), "confirm" (confirmando algo, ex: "sim", "pode", "quero"), "other" (outro assunto).
Responda APENAS a palavra, sem pontuação.`,
    },
    { role: 'user', content: message },
  ]
  const result = await callOllama(prompt)
  const intent = result.toLowerCase().trim() as IntentType
  return ['order', 'question', 'confirm', 'other'].includes(intent) ? intent : 'other'
}

export async function answerQuestion(
  message: string,
  menuContext: string,
  storeInfo: { name: string; address?: string; phone: string }
): Promise<string> {
  const systemPrompt = `Você é o assistente de atendimento do restaurante "${storeInfo.name}".
Responda dúvidas dos clientes sobre o cardápio de forma amigável, concisa e em português.
Não invente informações que não estão no cardápio abaixo.
Se não souber, diga que um atendente vai responder em breve.

CARDÁPIO:
${menuContext}

INFORMAÇÕES DA LOJA:
- Endereço: ${storeInfo.address ?? 'Ver site'}
- WhatsApp: ${storeInfo.phone}`

  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ]

  return callOllama(messages)
}

export async function suggestCartLink(
  message: string,
  menuContext: string
): Promise<{ reply: string; cartItems?: Array<{ productId: string; variationId?: string; qty: number }> }> {
  const systemPrompt = `Você é o assistente de pedidos do restaurante.
O cliente quer fazer um pedido. Identifique os produtos mencionados no CARDÁPIO abaixo.
Responda em JSON com este formato exato:
{"reply": "mensagem para o cliente", "items": [{"productId": "uuid", "variationId": "uuid ou null", "qty": número}]}
Se não conseguir identificar produtos, retorne {"reply": "Não encontrei esses produtos no nosso cardápio. Você pode ver nosso menu completo no link que enviei!", "items": []}
Seja amigável e confirme os itens encontrados na reply.

CARDÁPIO JSON:
${menuContext}`

  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ]

  const raw = await callOllama(messages)
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { reply: raw }
    const parsed = JSON.parse(jsonMatch[0]) as { reply?: string; items?: Array<{ productId: string; variationId?: string; qty?: number }> }
    return {
      reply: parsed.reply || raw,
      cartItems:
        parsed.items && parsed.items.length > 0
          ? parsed.items.map((i) => ({
              productId: i.productId,
              variationId: i.variationId || undefined,
              qty: i.qty || 1,
            }))
          : undefined,
    }
  } catch {
    return { reply: raw }
  }
}
