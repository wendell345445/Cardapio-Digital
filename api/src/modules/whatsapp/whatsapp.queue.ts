import Bull from 'bull'

import { logger } from '../../shared/logger/logger'

import { SendResult, sendMessage } from './whatsapp.service'

// ─── Outbox de WhatsApp ────────────────────────────────────────────
// Toda mensagem outgoing passa por aqui. Serializa envios por loja (limiter groupKey)
// e oferece retry com backoff, evitando race condition no socket Baileys e perdendo
// mensagens quando o socket está reconectando.

export type WhatsAppJobType = 'OTP' | 'ORDER' | 'AI' | 'MOTOBOY'

export interface WhatsAppOutgoingJob {
  storeId: string
  to: string
  text: string
  type: WhatsAppJobType
  /** epoch ms — usado pra descartar jobs com mais de 2h na fila (API/Worker ficaram fora) */
  createdAt: number
}

export type WhatsAppJobResult =
  | { ok: true; jid: string }
  | { ok: false; reason: string }

// Mais de 2h na fila = mensagem obsoleta (pedido já foi entregue, cancelado, etc).
// Descartada sem retry pelo processor.
const MAX_JOB_AGE_MS = 2 * 60 * 60 * 1000

// Concorrência global do worker — paraleliza envios de lojas diferentes.
// Serialização por loja é feita pelo storeLocks abaixo, não pelo Bull.
const GLOBAL_CONCURRENCY = 20

let queue: Bull.Queue<WhatsAppOutgoingJob> | null = null

/**
 * Serializa execução por storeId: dentro da mesma loja, só 1 envio por vez.
 * Entre lojas, processamento paralelo (limitado por GLOBAL_CONCURRENCY).
 * Implementado com Map<storeId, Promise> — cada job encadeia na promise anterior.
 */
const storeLocks = new Map<string, Promise<unknown>>()

async function withStoreLock<T>(storeId: string, fn: () => Promise<T>): Promise<T> {
  const prev = storeLocks.get(storeId) ?? Promise.resolve()
  const next = prev.then(() => fn(), () => fn())
  storeLocks.set(storeId, next)
  try {
    return (await next) as T
  } finally {
    // Limpa referência quando essa é a última promise encadeada
    if (storeLocks.get(storeId) === next) {
      storeLocks.delete(storeId)
    }
  }
}

/**
 * Cria (ou retorna) a fila Bull `whatsapp-outgoing`.
 * Idempotente: múltiplas chamadas retornam a mesma instância.
 * Registra processor + listeners na primeira chamada.
 */
export function getWhatsAppQueue(): Bull.Queue<WhatsAppOutgoingJob> {
  if (queue) return queue

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  queue = new Bull<WhatsAppOutgoingJob>('whatsapp-outgoing', redisUrl, {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
    },
  })

  queue.process(GLOBAL_CONCURRENCY, async (job) => {
    const { storeId, to, text, type, createdAt } = job.data
    const ageMs = Date.now() - createdAt

    // Descartar jobs antigos (>2h) — não faz sentido enviar mensagem velha
    if (ageMs > MAX_JOB_AGE_MS) {
      logger.warn({ storeId, to, type, ageMs }, '[WhatsAppQueue] Descartado por idade >2h')
      return { ok: false, reason: 'expired' } satisfies WhatsAppJobResult
    }

    // Serialização por loja: só 1 envio por storeId por vez (outros ficam aguardando
    // o lock). Entre lojas distintas, o processor processa em paralelo.
    return withStoreLock(storeId, async (): Promise<WhatsAppJobResult> => {
      const result: SendResult = await sendMessage(storeId, to, text)

      // Sem retry: loja nunca configurou WA ou número não existe no WhatsApp
      if (!result.ok && (result.reason === 'not_configured' || result.reason === 'invalid_number')) {
        logger.warn(
          { storeId, to, type, reason: result.reason },
          '[WhatsAppQueue] Descartado (sem retry)'
        )
        return { ok: false, reason: result.reason }
      }

      if (!result.ok) {
        logger.warn(
          { storeId, to, type, reason: result.reason, attempt: job.attemptsMade + 1 },
          '[WhatsAppQueue] Falhou — vai retry'
        )
        throw new Error(`whatsapp_send_failed:${result.reason}`)
      }

      logger.info({ storeId, to, type, jid: result.jid }, '[WhatsAppQueue] Enviado')
      return { ok: true, jid: result.jid }
    })
  })

  queue.on('failed', (job, err) => {
    logger.error(
      { jobId: job.id, storeId: job.data?.storeId, type: job.data?.type, err: err.message, attempts: job.attemptsMade },
      '[WhatsAppQueue] job failed (attempts esgotados)'
    )
  })

  logger.info('[WhatsAppQueue] pronta (fila whatsapp-outgoing)')
  return queue
}

function priorityFor(type: WhatsAppJobType): number {
  switch (type) {
    case 'OTP': return 1
    case 'MOTOBOY': return 3
    case 'ORDER': return 5
    case 'AI': return 10
  }
}

function attemptsFor(type: WhatsAppJobType): number {
  // OTP tem janela curta (15s) — não faz sentido muitas tentativas
  return type === 'OTP' ? 2 : 5
}

/**
 * Enfileira uma mensagem outgoing. Retorna o Job pra quem quiser aguardar via
 * `job.finished()` (caso do OTP síncrono). Resto é fire-and-forget.
 */
export async function enqueueWhatsApp(
  payload: Omit<WhatsAppOutgoingJob, 'createdAt'>
): Promise<Bull.Job<WhatsAppOutgoingJob>> {
  const q = getWhatsAppQueue()
  return q.add(
    { ...payload, createdAt: Date.now() },
    {
      priority: priorityFor(payload.type),
      attempts: attemptsFor(payload.type),
    }
  )
}

/**
 * Contadores pro endpoint /health — observabilidade por loja.
 */
export async function getQueueCounters() {
  const q = getWhatsAppQueue()
  const [waiting, active, failed, delayed, completed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getFailedCount(),
    q.getDelayedCount(),
    q.getCompletedCount(),
  ])
  return { waiting, active, failed, delayed, completed }
}
