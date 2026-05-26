import Fastify from 'fastify'

import { startRetentionCron } from './cron/retention.js'
import { env } from './env.js'
import { aiRoutes } from './routes/ai.js'
import { testRoutes } from './routes/test.js'
import { pool, runMigrations } from './services/db.js'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

app.get('/healthz', async () => ({ status: 'ok' }))

app.get('/healthz/db', async (_req, reply) => {
  try {
    await pool.query('SELECT 1')
    return { status: 'ok' }
  } catch (err) {
    return reply.status(503).send({ status: 'down', err: String(err) })
  }
})

app.get('/healthz/ollama', async (_req, reply) => {
  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/tags`)
    if (!res.ok) throw new Error(String(res.status))
    return { status: 'ok' }
  } catch (err) {
    return reply.status(503).send({ status: 'down', err: String(err) })
  }
})

await app.register(aiRoutes)
await app.register(testRoutes)

async function shutdown() {
  app.log.info('shutting down...')
  await app.close()
  await pool.end()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

await runMigrations()
startRetentionCron(app.log)
await app.listen({ host: '0.0.0.0', port: env.PORT })
