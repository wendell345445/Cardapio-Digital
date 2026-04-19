import { Router, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import passport from 'passport'

import { authMiddleware } from '../../shared/middleware/auth.middleware'

import {
  clientTokenController,
  facebookCallbackController,
  getAuthConfigController,
  googleCallbackController,
  loginController,
  logoutController,
  reauthController,
  refreshController,
  registerStoreController,
} from './auth.controller'

// Rate limiter para auto-cadastro: 5 req/h/IP — anti-spam
const registerStoreRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.' },
})

export const authRouter = Router()

// ─── Public Config (v2.5+) ────────────────────────────────────────
// Must be registered BEFORE OAuth routes — public, no auth required.
authRouter.get('/config', getAuthConfigController)

// ─── Self-Register (v2.5+) ────────────────────────────────────────
// POST /api/v1/auth/register-store — pública, rate-limited 5/h/IP.
authRouter.post('/register-store', registerStoreRateLimiter, registerStoreController)

// Deriva o callback OAuth a partir do host do request, para que funcione
// tanto em localhost/cardapio.test quanto em produção sem env var.
// Requer `app.set('trust proxy', 1)` para respeitar X-Forwarded-* (já configurado em app.ts).
const callbackFor = (req: Request, provider: 'google' | 'facebook') =>
  `${req.protocol}://${req.get('host')}/api/v1/auth/${provider}/callback`

// ─── Email/Senha ──────────────────────────────────────────────────
authRouter.post('/login', loginController)
authRouter.post('/refresh', refreshController)
authRouter.post('/logout', logoutController)
authRouter.post('/reauth', authMiddleware, reauthController)

// ─── OAuth Google ─────────────────────────────────────────────────
// Cast `as any` necessário porque os tipos do passport-google-oauth20 não expõem
// `callbackURL`/`state` em AuthenticateOptions, mas são opções válidas em runtime.
// O `state` carrega o scope esperado (motoboy|admin) pro callback validar a role.
function parseScope(raw: unknown): 'motoboy' | 'admin' {
  return raw === 'motoboy' ? 'motoboy' : 'admin'
}

authRouter.get('/google', (req, res, next) => {
  const scope = parseScope(req.query.scope)
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    callbackURL: callbackFor(req, 'google'),
    state: scope,
  } as any)(req, res, next)
})
authRouter.get(
  '/google/callback',
  (req, res, next) =>
    passport.authenticate('google', {
      session: false,
      failureRedirect: '/auth/error',
      callbackURL: callbackFor(req, 'google'),
    } as any)(req, res, next),
  googleCallbackController
)

// ─── OAuth Facebook ───────────────────────────────────────────────
authRouter.get('/facebook', (req, res, next) => {
  const scope = parseScope(req.query.scope)
  passport.authenticate('facebook', {
    scope: ['email'],
    session: false,
    callbackURL: callbackFor(req, 'facebook'),
    state: scope,
  } as any)(req, res, next)
})
authRouter.get(
  '/facebook/callback',
  (req, res, next) =>
    passport.authenticate('facebook', {
      session: false,
      failureRedirect: '/auth/error',
      callbackURL: callbackFor(req, 'facebook'),
    } as any)(req, res, next),
  facebookCallbackController
)

// ─── Magic Link Cliente ───────────────────────────────────────────
authRouter.get('/client-token/:token', clientTokenController)
