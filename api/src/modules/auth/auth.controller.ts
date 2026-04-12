import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import { isOAuthProviderEnabled } from './passport.config'
import {
  loginSchema,
  logoutSchema,
  reauthSchema,
  refreshSchema,
} from './auth.schema'
import {
  loginWithPassword,
  logout,
  reauth,
  refreshAccessToken,
  verifyClientToken,
} from './auth.service'
import { registerStoreSchema } from './register.schema'
import { registerStore } from './register.service'

/**
 * GET /api/v1/auth/config — public endpoint
 * Returns which OAuth providers are enabled in the current runtime.
 * Cached for 5 minutes.
 */
export function getAuthConfigController(_req: Request, res: Response) {
  res.set('Cache-Control', 'public, max-age=300')
  res.json({
    providers: {
      google: isOAuthProviderEnabled('google'),
      facebook: isOAuthProviderEnabled('facebook'),
    },
  })
}

/**
 * POST /api/v1/auth/register-store — public endpoint (rate-limited)
 * Auto-cadastro de loja com trial Stripe 7d sem cartão (v2.5+).
 */
export async function registerStoreController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerStoreSchema.parse(req.body)
    const result = await registerStore(data, req.ip)
    res.status(201).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      store: result.store,
    })
  } catch (err) {
    next(err)
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await loginWithPassword(email, password)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body)
    const result = await refreshAccessToken(refreshToken)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function logoutController(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = logoutSchema.parse(req.body)
    await logout(refreshToken)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export async function reauthController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401)
    const { password } = reauthSchema.parse(req.body)
    await reauth(req.user.userId, password)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export async function googleCallbackController(req: Request, res: Response) {
  const user = req.user as unknown as {
    accessToken: string
    refreshToken: string
  }
  const frontendUrl = process.env.WEB_URL || 'http://localhost:5173'
  res.redirect(
    `${frontendUrl}/auth/callback?token=${user.accessToken}&refresh=${user.refreshToken}`
  )
}

export async function facebookCallbackController(req: Request, res: Response) {
  const user = req.user as unknown as {
    accessToken: string
    refreshToken: string
  }
  const frontendUrl = process.env.WEB_URL || 'http://localhost:5173'
  res.redirect(
    `${frontendUrl}/auth/callback?token=${user.accessToken}&refresh=${user.refreshToken}`
  )
}

export async function clientTokenController(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params
    const { orderId } = verifyClientToken(token)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true, imageUrl: true } },
          },
        },
        store: { select: { name: true, slug: true, phone: true } },
      },
    })

    if (!order) throw new AppError('Pedido não encontrado', 404)

    res.json({ success: true, data: { order, clientToken: token } })
  } catch (err) {
    next(err)
  }
}
