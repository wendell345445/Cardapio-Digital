// TASK-007: Segurança Base — auth/role/store middlewares

import { NextFunction, Request, Response } from 'express'
import { sign } from 'jsonwebtoken'

import {
  authMiddleware,
  extractStoreId,
  requireMotoboy,
  requireRole,
  requireStore,
} from '../auth.middleware'
import { AppError } from '../error.middleware'

const JWT_SECRET = 'test-secret'
process.env.JWT_SECRET = JWT_SECRET

function makeReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, params: {}, user: undefined, tenant: undefined, ...overrides } as unknown as Request
}

const res = {} as Response
const next: NextFunction = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── authMiddleware ────────────────────────────────────────────────────────────

describe('authMiddleware', () => {
  // authMiddleware virou async (precisa consultar Redis para single-session check).
  // Em vez de throw, chama next(err) com AppError. Os testes usam mock de next.

  it('calls next(AppError 401) when Authorization header is missing', async () => {
    const req = makeReq({ headers: {} })
    await authMiddleware(req, res, next)
    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const passedErr = (next as jest.Mock).mock.calls[0][0] as AppError
    expect(passedErr.message).toBe('Unauthorized')
    expect(passedErr.status).toBe(401)
  })

  it('calls next(AppError 401) when Authorization header does not start with Bearer', async () => {
    const req = makeReq({ headers: { authorization: 'Basic abc123' } })
    await authMiddleware(req, res, next)
    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const passedErr = (next as jest.Mock).mock.calls[0][0] as AppError
    expect(passedErr.message).toBe('Unauthorized')
  })

  it('calls next(AppError 401) when token is invalid', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer invalid.token.here' } })
    await authMiddleware(req, res, next)
    expect(next).toHaveBeenCalledWith(expect.any(AppError))
    const passedErr = (next as jest.Mock).mock.calls[0][0] as AppError
    expect(passedErr.message).toBe('Invalid or expired token')
  })

  it('sets req.user and calls next() with a valid token (sem jti = sem check de sessão revogada)', async () => {
    const payload = { userId: 'u1', role: 'ADMIN', storeId: 's1' }
    const token = sign(payload, JWT_SECRET)
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    await authMiddleware(req, res, next)
    expect(req.user).toMatchObject(payload)
    expect(next).toHaveBeenCalledWith()
  })
})

// ─── requireRole ──────────────────────────────────────────────────────────────

describe('requireRole', () => {
  it('throws 401 when req.user is not set', () => {
    const req = makeReq()
    const mw = requireRole('ADMIN')
    expect(() => mw(req, res, next)).toThrow('Unauthorized')
  })

  it('throws 403 when user role is not in allowed list', () => {
    const req = makeReq({ user: { userId: 'u1', role: 'MOTOBOY' } } as any)
    const mw = requireRole('ADMIN', 'OWNER')
    expect(() => mw(req, res, next)).toThrow('Forbidden')
  })

  it('calls next() when user role matches', () => {
    const req = makeReq({ user: { userId: 'u1', role: 'ADMIN' } } as any)
    const mw = requireRole('ADMIN', 'OWNER')
    mw(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('accepts multiple allowed roles', () => {
    const req = makeReq({ user: { userId: 'u1', role: 'OWNER' } } as any)
    const mw = requireRole('ADMIN', 'OWNER')
    mw(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
})

// ─── extractStoreId ───────────────────────────────────────────────────────────

describe('extractStoreId', () => {
  it('calls next() when req.user is not set', () => {
    const req = makeReq()
    extractStoreId(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.tenant).toBeUndefined()
  })

  it('sets req.tenant from route param for OWNER', () => {
    const req = makeReq({
      user: { userId: 'u1', role: 'OWNER' } as any,
      params: { storeId: 's-owner' },
    })
    extractStoreId(req, res, next)
    expect(req.tenant).toEqual({ storeId: 's-owner' })
    expect(next).toHaveBeenCalled()
  })

  it('does not set tenant for OWNER without storeId param', () => {
    const req = makeReq({
      user: { userId: 'u1', role: 'OWNER' } as any,
      params: {},
    })
    extractStoreId(req, res, next)
    expect(req.tenant).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })

  it('sets req.tenant from JWT storeId for non-OWNER roles', () => {
    const req = makeReq({
      user: { userId: 'u1', role: 'ADMIN', storeId: 's-jwt' } as any,
    })
    extractStoreId(req, res, next)
    expect(req.tenant).toEqual({ storeId: 's-jwt' })
    expect(next).toHaveBeenCalled()
  })

  it('does not set tenant when non-OWNER has no storeId in JWT', () => {
    const req = makeReq({
      user: { userId: 'u1', role: 'ADMIN' } as any,
    })
    extractStoreId(req, res, next)
    expect(req.tenant).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })
})

// ─── requireStore ─────────────────────────────────────────────────────────────

describe('requireStore', () => {
  it('throws 403 when tenant is not set', () => {
    const req = makeReq()
    expect(() => requireStore(req, res, next)).toThrow('Store context required')
  })

  it('throws 403 when tenant has no storeId', () => {
    const req = makeReq({ tenant: {} } as any)
    expect(() => requireStore(req, res, next)).toThrow('Store context required')
  })

  it('calls next() when tenant.storeId is present', () => {
    const req = makeReq({ tenant: { storeId: 's1' } } as any)
    requireStore(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
})

// ─── requireMotoboy ───────────────────────────────────────────────────────────

describe('requireMotoboy', () => {
  it('throws 401 when req.user is not set', () => {
    const req = makeReq()
    expect(() => requireMotoboy(req, res, next)).toThrow('Unauthorized')
  })

  it('throws 403 when role is not MOTOBOY', () => {
    const req = makeReq({ user: { userId: 'u1', role: 'ADMIN' } } as any)
    expect(() => requireMotoboy(req, res, next)).toThrow('Forbidden')
  })

  it('throws 403 when role is MOTOBOY but no storeId in tenant', () => {
    const req = makeReq({ user: { userId: 'u1', role: 'MOTOBOY' } } as any)
    expect(() => requireMotoboy(req, res, next)).toThrow('Store context required')
  })

  it('calls next() for MOTOBOY with valid storeId', () => {
    const req = makeReq({
      user: { userId: 'u1', role: 'MOTOBOY' } as any,
      tenant: { storeId: 's1' },
    })
    requireMotoboy(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })
})
