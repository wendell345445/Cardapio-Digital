import Bull from 'bull'

import { logger } from '../shared/logger/logger'
import { cleanupOldPrintJobs } from '../modules/print/print.service'

// ─── Print Jobs Cleanup Cron ──────────────────────────────────────
//
// Varre diariamente e remove `PrintJob`s PRINTED com mais de 30 dias.
// Não há razão pra manter histórico de impressão — auditoria de pedido fica
// no AuditLog, e PrintJob é só fila operacional.

const JOB_NAME = 'print-jobs-cleanup'
const REPEATABLE_CRON = process.env.PRINT_JOBS_CLEANUP_CRON || '15 3 * * *' // 03:15 diariamente
const RETENTION_DAYS = Number(process.env.PRINT_JOBS_RETENTION_DAYS) || 30

let cleanupQueue: Bull.Queue | null = null

export function getPrintJobsCleanupQueue(): Bull.Queue {
  if (cleanupQueue) return cleanupQueue

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  cleanupQueue = new Bull(JOB_NAME, redisUrl)

  cleanupQueue.process(async () => {
    logger.info({ cron: REPEATABLE_CRON, retentionDays: RETENTION_DAYS }, 'print-jobs-cleanup: starting sweep')
    const removed = await cleanupOldPrintJobs(RETENTION_DAYS)
    logger.info({ removed }, 'print-jobs-cleanup: sweep complete')
  })

  return cleanupQueue
}

export async function registerPrintJobsCleanupJob(): Promise<void> {
  if (process.env.DISABLE_CRON_JOBS === 'true') {
    logger.warn('print-jobs-cleanup: cron disabled via DISABLE_CRON_JOBS=true')
    return
  }

  const queue = getPrintJobsCleanupQueue()

  // Remove repetíveis existentes pra evitar duplicação em restart
  const existing = await queue.getRepeatableJobs()
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key)
  }

  await queue.add(
    {},
    {
      repeat: { cron: REPEATABLE_CRON },
      jobId: 'print-jobs-cleanup-cron',
    }
  )

  logger.info({ cron: REPEATABLE_CRON }, 'print-jobs-cleanup: cron registered')
}
