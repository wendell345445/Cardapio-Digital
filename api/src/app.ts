import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import passport from 'passport'

import { configurePassport } from './modules/auth/passport.config'
import { errorHandler } from './shared/middleware/error.middleware'
import { publicRateLimiter } from './shared/middleware/rateLimit.middleware'
import { router } from './router'
import { prisma } from './shared/prisma/prisma'

configurePassport()

export const app = express()

// Caddy/proxy envia X-Forwarded-For — Express precisa confiar para rate-limit funcionar
app.set('trust proxy', 1)

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.com.br'
const allowedSuffixes = (
  process.env.ALLOWED_ORIGIN_SUFFIXES || `.cardapio.test,.${rootDomain}`
).split(',')

function isOriginAllowed(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true
  try {
    const hostname = new URL(origin).hostname
    return allowedSuffixes.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
    )
  } catch {
    return false
  }
}

async function isCustomDomainAllowed(origin: string): Promise<boolean> {
  try {
    const hostname = new URL(origin).hostname
    const store = await prisma.store.findFirst({ where: { customDomain: hostname }, select: { id: true } })
    return store !== null
  } catch {
    return false
  }
}

app.use(helmet())
app.use(
  cors({
    origin: async (origin, callback) => {
      if (!origin) return callback(null, true)
      if (isOriginAllowed(origin)) return callback(null, true)
      if (await isCustomDomainAllowed(origin)) return callback(null, true)
      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)

// Stripe webhook precisa do raw body (Buffer) pra verificar assinatura HMAC.
// DEVE ficar ANTES do `express.json()` global, senão o body é parsed como objeto e
// `stripe.webhooks.constructEvent()` falha com "Webhook payload must be provided as a string or Buffer".
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())
app.use(publicRateLimiter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/v1', router)

app.use(errorHandler)
