/**
 * Unit test — requireFeature (gate de plano por flag em Store.features).
 */

jest.mock('../../prisma/prisma', () => ({
  prisma: { store: { findUnique: jest.fn() } },
}))

import { NextFunction, Request, Response } from 'express'

import { prisma } from '../../prisma/prisma'
import { AppError } from '../error.middleware'
import { requireFeature } from '../auth.middleware'

const mockPrisma = prisma as unknown as { store: { findUnique: jest.Mock } }

function makeReq(storeId?: string): Request {
  return { tenant: storeId ? { storeId } : undefined } as unknown as Request
}
const res = {} as Response

beforeEach(() => jest.clearAllMocks())

describe('requireFeature', () => {
  it('passa (next sem erro) quando a loja tem a flag true', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ features: { ifoodIntegration: true } })
    const next = jest.fn() as NextFunction
    await requireFeature('ifoodIntegration')(makeReq('store-1'), res, next)
    expect(next).toHaveBeenCalledWith() // sem argumento = sucesso
  })

  it('403 FEATURE_NOT_IN_PLAN quando a flag é false/ausente', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ features: { ifoodIntegration: false } })
    const next = jest.fn() as NextFunction
    await requireFeature('ifoodIntegration')(makeReq('store-1'), res, next)
    const err = (next as jest.Mock).mock.calls[0][0] as AppError
    expect(err).toBeInstanceOf(AppError)
    expect(err.status).toBe(403)
    expect(err.code).toBe('FEATURE_NOT_IN_PLAN')
  })

  it('403 quando não há store context', async () => {
    const next = jest.fn() as NextFunction
    await requireFeature('ifoodIntegration')(makeReq(), res, next)
    expect((next as jest.Mock).mock.calls[0][0].status).toBe(403)
  })

  it('404 quando a loja não existe', async () => {
    mockPrisma.store.findUnique.mockResolvedValue(null)
    const next = jest.fn() as NextFunction
    await requireFeature('ifoodIntegration')(makeReq('store-x'), res, next)
    expect((next as jest.Mock).mock.calls[0][0].status).toBe(404)
  })
})
