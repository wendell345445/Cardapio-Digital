import { purgeOld } from '../services/memory.js'

// Roda 1x por dia (24h após o start). Simples — sem libs de cron.
const DAY_MS = 24 * 60 * 60 * 1000

export function startRetentionCron(log: { info: (o: unknown, msg?: string) => void; error: (o: unknown, msg?: string) => void }): void {
  const tick = async () => {
    try {
      const deleted = await purgeOld()
      log.info({ deleted }, 'retention cron — memórias antigas removidas')
    } catch (err) {
      log.error({ err: String(err) }, 'retention cron falhou')
    }
  }
  setTimeout(() => { void tick(); setInterval(() => void tick(), DAY_MS) }, DAY_MS)
}
