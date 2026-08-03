import Bull from 'bull'

import { logger } from '../shared/logger/logger'
import { prisma } from '../shared/prisma/prisma'
import { acknowledgeEvents, pollEvents } from '../shared/ifood/ifood.service'
import { processIFoodEvent } from '../modules/ifood/ingest.service'

// ─── Polling de eventos iFood (rede de segurança do webhook) ──────────────────
// O webhook é a fonte primária (tempo real); este poll a cada 30s garante que
// nenhum evento se perca. Dedup por eventId (no ingest) torna reprocessar seguro,
// então damos ACK sempre (mesmo em falha pontual) pra não prender a fila.

const JOB_NAME = 'ifood-polling'
const EVERY_MS = Number(process.env.IFOOD_POLL_INTERVAL_MS || 30_000)

let queue: Bull.Queue | null = null

export function getIFoodPollingQueue(): Bull.Queue {
  if (queue) return queue
  queue = new Bull(JOB_NAME, process.env.REDIS_URL || 'redis://localhost:6379')

  queue.process(async () => {
    // Só há trabalho se ao menos uma loja está conectada (o token/merchants é global do app).
    const connectedCount = await prisma.store.count({ where: { ifoodMerchantId: { not: null } } })
    if (connectedCount === 0) return { polled: 0 }

    let events
    try {
      events = await pollEvents()
    } catch (err) {
      logger.error({ err }, 'ifood-polling: pollEvents failed')
      return { polled: 0 }
    }
    if (events.length === 0) return { polled: 0 }

    // Mapa merchantId → store (evita 1 query por evento).
    const merchantIds = [...new Set(events.map((e) => e.merchantId).filter(Boolean) as string[])]
    const stores = await prisma.store.findMany({
      where: { ifoodMerchantId: { in: merchantIds } },
      select: { id: true, autoConfirmOrders: true, ifoodMerchantId: true },
    })
    const byMerchant = new Map(stores.map((s) => [s.ifoodMerchantId as string, s]))

    for (const event of events) {
      const store = event.merchantId ? byMerchant.get(event.merchantId) : undefined
      if (store) {
        try {
          await processIFoodEvent(store, event)
        } catch (err) {
          logger.error({ err, eventId: event.id }, 'ifood-polling: process failed (será re-polled)')
        }
      }
    }

    // ACK sempre (dedup protege o reprocessamento). ACK em lotes de 2000.
    const ids = events.map((e) => e.id)
    for (let i = 0; i < ids.length; i += 2000) {
      await acknowledgeEvents(ids.slice(i, i + 2000)).catch((err) =>
        logger.error({ err }, 'ifood-polling: acknowledge failed')
      )
    }

    logger.info({ polled: events.length }, 'ifood-polling: processed')
    return { polled: events.length }
  })

  queue.on('failed', (job, err) => logger.error({ jobId: job.id, err }, 'ifood-polling: job failed'))
  return queue
}

/** Registra o poll repetível (30s). Chamar uma vez no bootstrap. */
export async function registerIFoodPollingJob(): Promise<void> {
  if (process.env.DISABLE_CRON_JOBS === 'true') {
    logger.warn('ifood-polling: disabled via DISABLE_CRON_JOBS=true')
    return
  }
  const q = getIFoodPollingQueue()
  const existing = await q.getRepeatableJobs()
  for (const job of existing) await q.removeRepeatableByKey(job.key)
  await q.add({}, { repeat: { every: EVERY_MS }, jobId: 'ifood-polling-cron', removeOnComplete: true, removeOnFail: true })
  logger.info({ everyMs: EVERY_MS }, 'ifood-polling: registered')
}
