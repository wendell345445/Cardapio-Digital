import { Agent } from 'undici'

// ─── Cliente mTLS pro whatsbot self-hosted (VM GCP) ──────────────────────
// A IA do WhatsApp roda integralmente na VM whatsbot.menupanda.com.br
// (Ollama + RAG via pgvector). Este módulo é o ÚNICO ponto de saída da
// Railway pra IA — expõe `askWhatsbot` que monta o payload com o contexto
// completo da loja e recebe `{reply}` da VM. Sem fallback: se a VM cair,
// o ai-handler simplesmente loga e não envia nada ao cliente.

interface OpeningHoursLike {
  // estrutura opaca — repassa cru pro whatsbot
  [key: string]: unknown
}

export interface WhatsbotStoreContext {
  name: string
  slug?: string
  address?: string | null
  phone?: string | null
  menuUrl: string
  isOpenNow?: boolean
  openingHours?: OpeningHoursLike
}

export interface WhatsbotRequest {
  storeId: string
  customerPhone: string
  message: string
  context: {
    store: WhatsbotStoreContext
    menu?: string
    menuJson?: string
  }
}

export interface WhatsbotResponse {
  reply: string
  latencyMs: number
  memoryHits: number
  usedProfile: boolean
}

function fromB64(envName: string): string {
  const v = process.env[envName]
  if (!v) throw new Error(`${envName} ausente — mTLS whatsbot não configurado`)
  return Buffer.from(v, 'base64').toString('utf8')
}

let agent: Agent | null = null

function whatsbotAgent(): Agent {
  if (agent) return agent
  agent = new Agent({
    connect: {
      cert: fromB64('WHATSBOT_CLIENT_CERT_B64'),
      key: fromB64('WHATSBOT_CLIENT_KEY_B64'),
    },
  })
  return agent
}

const REQUEST_TIMEOUT_MS = 60_000

export async function askWhatsbot(payload: WhatsbotRequest): Promise<WhatsbotResponse> {
  const base = process.env.WHATSBOT_URL
  const key = process.env.WHATSBOT_API_KEY
  if (!base || !key) throw new Error('WHATSBOT_URL/WHATSBOT_API_KEY ausentes')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/ai/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': key,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      // @ts-expect-error — `dispatcher` é extensão undici no fetch do Node
      dispatcher: whatsbotAgent(),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`whatsbot /ai/answer ${res.status}: ${body.slice(0, 200)}`)
    }
    return (await res.json()) as WhatsbotResponse
  } finally {
    clearTimeout(t)
  }
}
