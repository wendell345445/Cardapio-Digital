import { NextFunction, Request, Response } from 'express'

import {
  checkCustomer,
  requestOtp,
  verifyOtp,
  signCustomerToken,
  verifyCustomerToken,
  getCookieValue,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
} from './customer-verify.service'
import {
  checkCustomerSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from './customer-verify.schema'

// ─── Helpers ────────────────────────────────────────────────────────────────

function setCookieOnResponse(res: Response, token: string): void {
  // Em prod, API e cardápio vivem em subdomínios diferentes (api.X / slug.X), então
  // o cookie precisa de domain compartilhado + SameSite=None pra atravessar cross-site.
  // Em dev é same-origin via proxy do Vite — mantém 'lax' sem domain.
  const isProd = process.env.NODE_ENV === 'production'
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    ...(isProd && rootDomain ? { domain: `.${rootDomain}` } : {}),
  })
}

// ─── GET /customer/check?whatsapp=XXX ───────────────────────────────────────

export async function checkCustomerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const { whatsapp } = checkCustomerSchema.parse(req.query)

    const result = await checkCustomer(storeId, whatsapp)

    // Cliente existente: setar cookie de verificação automaticamente
    if (result.exists) {
      const token = signCustomerToken(storeId, whatsapp)
      setCookieOnResponse(res, token)
    }

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

// ─── POST /customer/otp/request ─────────────────────────────────────────────

export async function requestOtpController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const { whatsapp } = requestOtpSchema.parse(req.body)

    await requestOtp(storeId, whatsapp)

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

// ─── POST /customer/otp/verify ──────────────────────────────────────────────

export async function verifyOtpController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const { whatsapp, code } = verifyOtpSchema.parse(req.body)

    const token = await verifyOtp(storeId, whatsapp, code)
    setCookieOnResponse(res, token)

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

// ─── POST /customer/logout ──────────────────────────────────────────────────

export function customerLogoutController(
  _req: Request,
  res: Response,
): void {
  const isProd = process.env.NODE_ENV === 'production'
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    ...(isProd && rootDomain ? { domain: `.${rootDomain}` } : {}),
  })
  res.json({ success: true })
}

// ─── GET /customer/me ───────────────────────────────────────────────────────

export async function customerMeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const storeId = req.store!.id
    const cookieValue = getCookieValue(req.headers.cookie, COOKIE_NAME)

    if (!cookieValue) {
      res.status(401).json({ success: false, error: 'Não autenticado' })
      return
    }

    const payload = verifyCustomerToken(cookieValue)
    if (!payload || payload.storeId !== storeId) {
      res.status(401).json({ success: false, error: 'Token inválido' })
      return
    }

    const data = await checkCustomer(storeId, payload.whatsapp)

    res.json({
      success: true,
      data: {
        whatsapp: payload.whatsapp,
        name: data.name,
        address: data.address,
      },
    })
  } catch (err) {
    next(err)
  }
}
