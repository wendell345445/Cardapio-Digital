import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import passport from 'passport'

import { configurePassport } from './modules/auth/passport.config'
import { LOCAL_UPLOAD_DIR } from './modules/admin/upload.service'
import { printRouter } from './modules/print/print.routes'
import { errorHandler } from './shared/middleware/error.middleware'
import { publicRateLimiter } from './shared/middleware/rateLimit.middleware'
import { router } from './router'
import { prisma } from './shared/prisma/prisma'

configurePassport()

export const app = express()

// Caddy/proxy envia X-Forwarded-For — Express precisa confiar para rate-limit funcionar
app.set('trust proxy', 1)

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.ai'
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

// O webhook do iFood assina o body com HMAC-SHA256 (X-IFood-Signature) — a validação
// precisa dos BYTES CRUS, então essa rota recebe `express.raw` ANTES do `express.json`
// global (que reserializaria o JSON e quebraria a assinatura). Molde do Stripe antigo.
app.use('/api/v1/webhooks/ifood', express.raw({ type: '*/*', limit: '10mb' }))

// O webhook do Asaas usa JSON normal (autenticação por header `asaas-access-token`,
// não HMAC), então cai no `express.json()` global — sem raw body dedicado.
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())
app.use(publicRateLimiter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Fallback local de uploads (usado quando Cloudinary não está configurado).
// helmet bloqueia cross-origin por default — crossOriginResourcePolicy relaxa pra o web dev server conseguir carregar as imagens.
app.use(
  '/uploads',
  express.static(LOCAL_UPLOAD_DIR, {
    fallthrough: false,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
)

app.use('/api/v1', router)
// /api/print/* (fora de /api/v1) — contrato fixo consumido pelo app desktop
// Menuziprinter (login, me, pending, mark-printed).
app.use('/api/print', printRouter)

app.use(errorHandler)
