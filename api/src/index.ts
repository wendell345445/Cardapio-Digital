import 'dotenv/config'
import { createServer } from 'http'

import { app } from './app'
import { registerTrialSuspensionJob } from './jobs/trial-suspension.job'
import { getWhatsAppQueue } from './modules/whatsapp/whatsapp.queue'
import { restoreAllSessions } from './modules/whatsapp/whatsapp.service'
import { logger } from './shared/logger/logger'
import { connectRedis } from './shared/redis/redis'
import { initSocket } from './shared/socket/socket'

const PORT = process.env.PORT || 3001

async function bootstrap() {
  await connectRedis()

  const httpServer = createServer(app)
  initSocket(httpServer)

  // Cron jobs (Bull repeatable)
  await registerTrialSuspensionJob()

  // WhatsApp outbox queue — registra o processor antes de restaurar sessões
  // pra garantir que jobs pendentes (persistidos em Redis) comecem a drenar imediatamente.
  getWhatsAppQueue()

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'API running')
    logger.info('Socket.io ready')

    // Restaura sessões WhatsApp salvas em disco (fire-and-forget, não bloqueia startup)
    restoreAllSessions()
      .then(() => logger.info('WhatsApp sessions restored'))
      .catch((err) => logger.error({ err }, 'WhatsApp session restore failed'))
  })
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server')
  process.exit(1)
})
