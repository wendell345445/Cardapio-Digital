import { NextFunction, Request, Response } from 'express'
import { verify } from 'jsonwebtoken'

import { prisma } from '../prisma/prisma'

import { AppError } from './error.middleware'

export interface JwtPayload {
  userId: string
  role: string
  storeId?: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      userId: string
      role: string
      storeId?: string
    }
    interface Request {
      tenant?: { storeId: string }
      store?: { id: string; slug: string; name: string }
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('Unauthorized', 401)
  }

  const token = authorization.slice(7)
  try {
    const payload = verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    next()
  } catch {
    throw new AppError('Invalid or expired token', 401)
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError('Unauthorized', 401)
    if (!roles.includes(req.user.role)) throw new AppError('Forbidden', 403)
    next()
  }
}

/**
 * Extracts storeId from JWT payload and sets req.tenant.
 * OWNERs are exempt — they pass storeId as a route param instead.
 */
export function extractStoreId(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next()
    return
  }

  if (req.user.role === 'OWNER') {
    // OWNER uses storeId from route params (e.g. /owner/stores/:storeId/...)
    const storeId = req.params.storeId
    if (storeId) req.tenant = { storeId }
    next()
    return
  }

  if (req.user.storeId) {
    req.tenant = { storeId: req.user.storeId }
  }

  next()
}

/**
 * Blocks the request if no storeId is present in the tenant context.
 * Must be used AFTER authMiddleware + extractStoreId.
 */
export function requireStore(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant?.storeId) {
    throw new AppError('Store context required', 403)
  }
  next()
}

/**
 * Validates role MOTOBOY and ensures storeId is present.
 */
export function requireMotoboy(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new AppError('Unauthorized', 401)
  if (req.user.role !== 'MOTOBOY') throw new AppError('Forbidden', 403)
  if (!req.tenant?.storeId) throw new AppError('Store context required', 403)
  next()
}

/**
 * Bloqueia rotas admin quando a loja está SUSPENDED. Usar APÓS `requireStore`
 * — assume `req.tenant.storeId` já populado.
 *
 * Resposta 403 com `code: 'STORE_SUSPENDED'` permite o frontend identificar
 * o motivo do bloqueio e redirecionar pra página de billing/assinatura.
 *
 * NÃO aplicar em rotas que o admin precisa acessar mesmo suspenso:
 *   - GET /admin/store (frontend lê pra detectar status e fazer guard)
 *   - /billing/* (rotas de regularização — sub-router separado, sem este middleware)
 */
export async function requireActiveStore(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.tenant?.storeId) {
      throw new AppError('Store context required', 403)
    }
    const store = await prisma.store.findUnique({
      where: { id: req.tenant.storeId },
      select: { status: true },
    })
    if (!store) throw new AppError('Loja não encontrada', 404)
    if (store.status === 'SUSPENDED') {
      throw new AppError(
        'Loja suspensa — regularize a assinatura para continuar',
        403,
        'STORE_SUSPENDED'
      )
    }
    next()
  } catch (err) {
    next(err)
  }
}
