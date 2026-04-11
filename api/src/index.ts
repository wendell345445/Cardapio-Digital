import 'dotenv/config'
import { createServer } from 'http'

import { app } from './app'
import { registerTrialSuspensionJob } from './jobs/trial-suspension.job'
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

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'API running')
    logger.info('Socket.io ready')
  })
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server')
  process.exit(1)
})
