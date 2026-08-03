/**
 * Unit tests — admin/ifood service (Fase 1: conexão).
 */

jest.mock('../../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../../../shared/ifood/ifood.service', () => ({
  listMerchants: jest.fn(),
  getMerchant: jest.fn(),
}))

import { getMerchant, listMerchants } from '../../../../shared/ifood/ifood.service'
import { prisma } from '../../../../shared/prisma/prisma'
import { disconnect, getConnectionStatus, linkMerchant, listAvailableMerchants } from '../ifood.service'

const mockPrisma = prisma as unknown as {
  store: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock }
  auditLog: { create: jest.Mock }
}

const MERCHANT = { id: 'mch-uuid-1', name: 'Loja iFood' }

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.store.update.mockResolvedValue({})
  mockPrisma.auditLog.create.mockResolvedValue({})
  mockPrisma.store.findFirst.mockResolvedValue(null)
  mockPrisma.store.findMany.mockResolvedValue([])
  ;(listMerchants as jest.Mock).mockResolvedValue([MERCHANT])
  ;(getMerchant as jest.Mock).mockResolvedValue(MERCHANT)
})

describe('getConnectionStatus', () => {
  it('DISCONNECTED quando sem merchant vinculado', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ ifoodMerchantId: null, ifoodConnectedAt: null })
    const s = await getConnectionStatus('store-1')
    expect(s.status).toBe('DISCONNECTED')
    expect(s.merchantId).toBeNull()
  })

  it('CONNECTED com nome do merchant quando vinculado', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({
      ifoodMerchantId: 'mch-uuid-1',
      ifoodConnectedAt: new Date(),
    })
    const s = await getConnectionStatus('store-1')
    expect(s.status).toBe('CONNECTED')
    expect(s.merchantId).toBe('mch-uuid-1')
    expect(s.merchantName).toBe('Loja iFood')
  })
})

describe('listAvailableMerchants', () => {
  it('marca linkedElsewhere quando o merchant já é de outra loja', async () => {
    mockPrisma.store.findMany.mockResolvedValue([{ id: 'outra-loja', ifoodMerchantId: 'mch-uuid-1' }])
    const list = await listAvailableMerchants('store-1')
    expect(list[0].linkedElsewhere).toBe(true)
    expect(list[0].linkedToThisStore).toBe(false)
  })

  it('marca linkedToThisStore quando é a própria loja', async () => {
    mockPrisma.store.findMany.mockResolvedValue([{ id: 'store-1', ifoodMerchantId: 'mch-uuid-1' }])
    const list = await listAvailableMerchants('store-1')
    expect(list[0].linkedToThisStore).toBe(true)
    expect(list[0].linkedElsewhere).toBe(false)
  })
})

describe('linkMerchant', () => {
  it('vincula e grava CONNECTED + audit log', async () => {
    const res = await linkMerchant('store-1', 'mch-uuid-1', 'user-1')
    expect(res.status).toBe('CONNECTED')
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ifoodMerchantId: 'mch-uuid-1', ifoodStatus: 'CONNECTED' }),
      })
    )
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  it('422 quando o merchant não está autorizado no app', async () => {
    ;(listMerchants as jest.Mock).mockResolvedValue([])
    await expect(linkMerchant('store-1', 'mch-uuid-x')).rejects.toMatchObject({ status: 422 })
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })

  it('422 quando o merchant já está vinculado a outra loja', async () => {
    mockPrisma.store.findFirst.mockResolvedValue({ id: 'outra-loja' })
    await expect(linkMerchant('store-1', 'mch-uuid-1')).rejects.toMatchObject({ status: 422 })
    expect(mockPrisma.store.update).not.toHaveBeenCalled()
  })
})

describe('disconnect', () => {
  it('limpa o vínculo + audit log', async () => {
    mockPrisma.store.findUnique.mockResolvedValue({ ifoodMerchantId: 'mch-uuid-1' })
    await disconnect('store-1', 'user-1')
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ifoodMerchantId: null, ifoodStatus: null }) })
    )
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })
})
