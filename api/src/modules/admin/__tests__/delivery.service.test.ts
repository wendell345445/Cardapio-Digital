// ─── TASK-091: Área de Entrega — Unit Tests ───────────────────────────────────
// Cobre: haversine (puro), neighborhood CRUD, distance CRUD, setDeliveryMode, calculateDeliveryFee

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    deliveryNeighborhood: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deliveryDistance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  haversine,
  listNeighborhoods,
  createNeighborhood,
  updateNeighborhood,
  deleteNeighborhood,
  createDistance,
  updateDistance,
  deleteDistance,
  setDeliveryMode,
  calculateDeliveryFee,
} from '../delivery.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const STORE_ID = 'store-1'
const USER_ID = 'admin-1'
const NB_ID = 'nb-1'
const DIST_ID = 'dist-1'
const IP = '127.0.0.1'

const mockNeighborhood = {
  id: NB_ID,
  storeId: STORE_ID,
  name: 'Centro',
  fee: 5.0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockDistance = {
  id: DIST_ID,
  storeId: STORE_ID,
  minKm: 0,
  maxKm: 5,
  fee: 8.0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.clearAllMocks())

// ─── haversine (função pura) ──────────────────────────────────────────────────

describe('haversine', () => {
  it('retorna 0 para pontos idênticos', () => {
    expect(haversine(-23.55, -46.63, -23.55, -46.63)).toBe(0)
  })

  it('calcula distância aproximada entre São Paulo e Rio de Janeiro (~357 km)', () => {
    const dist = haversine(-23.5505, -46.6333, -22.9068, -43.1729)
    expect(dist).toBeGreaterThan(340)
    expect(dist).toBeLessThan(380)
  })

  it('calcula distância simétrica (A→B == B→A)', () => {
    const ab = haversine(-23.5505, -46.6333, -22.9068, -43.1729)
    const ba = haversine(-22.9068, -43.1729, -23.5505, -46.6333)
    expect(Math.abs(ab - ba)).toBeLessThan(0.001)
  })

  it('retorna valor em km (não metros)', () => {
    // 1 grau de latitude ≈ 111 km
    const dist = haversine(0, 0, 1, 0)
    expect(dist).toBeGreaterThan(100)
    expect(dist).toBeLessThan(120)
  })
})

// ─── listNeighborhoods ────────────────────────────────────────────────────────

describe('listNeighborhoods', () => {
  it('retorna bairros da loja ordenados por nome asc', async () => {
    ;(mockPrisma.deliveryNeighborhood.findMany as jest.Mock).mockResolvedValue([mockNeighborhood])

    const result = await listNeighborhoods(STORE_ID)

    expect(mockPrisma.deliveryNeighborhood.findMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
      orderBy: { name: 'asc' },
    })
    expect(result).toHaveLength(1)
  })

  it('retorna lista vazia quando não há bairros', async () => {
    ;(mockPrisma.deliveryNeighborhood.findMany as jest.Mock).mockResolvedValue([])

    const result = await listNeighborhoods(STORE_ID)

    expect(result).toHaveLength(0)
  })
})

// ─── createNeighborhood ───────────────────────────────────────────────────────

describe('createNeighborhood', () => {
  it('cria bairro com nome e taxa', async () => {
    ;(mockPrisma.deliveryNeighborhood.create as jest.Mock).mockResolvedValue(mockNeighborhood)

    const result = await createNeighborhood(STORE_ID, { name: 'Centro', fee: 5.0 })

    expect(mockPrisma.deliveryNeighborhood.create).toHaveBeenCalledWith({
      data: { storeId: STORE_ID, name: 'Centro', fee: 5.0 },
    })
    expect(result.name).toBe('Centro')
  })
})

// ─── updateNeighborhood ───────────────────────────────────────────────────────

describe('updateNeighborhood', () => {
  it('atualiza bairro quando pertence à loja', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(mockNeighborhood)
    ;(mockPrisma.deliveryNeighborhood.update as jest.Mock).mockResolvedValue({
      ...mockNeighborhood,
      fee: 7.0,
    })

    const result = await updateNeighborhood(STORE_ID, NB_ID, { fee: 7.0 })

    expect(result.fee).toBe(7.0)
  })

  it('lança 404 quando bairro não existe', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(updateNeighborhood(STORE_ID, NB_ID, { fee: 7.0 })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('lança 404 quando bairro pertence a outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue({
      ...mockNeighborhood,
      storeId: 'outra-loja',
    })

    await expect(updateNeighborhood(STORE_ID, NB_ID, { fee: 7.0 })).rejects.toMatchObject({
      status: 404,
    })
  })
})

// ─── deleteNeighborhood ───────────────────────────────────────────────────────

describe('deleteNeighborhood', () => {
  it('deleta bairro quando pertence à loja', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(mockNeighborhood)
    ;(mockPrisma.deliveryNeighborhood.delete as jest.Mock).mockResolvedValue(mockNeighborhood)

    await deleteNeighborhood(STORE_ID, NB_ID)

    expect(mockPrisma.deliveryNeighborhood.delete).toHaveBeenCalledWith({ where: { id: NB_ID } })
  })

  it('lança 404 quando bairro não existe', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(deleteNeighborhood(STORE_ID, NB_ID)).rejects.toMatchObject({ status: 404 })
    expect(mockPrisma.deliveryNeighborhood.delete).not.toHaveBeenCalled()
  })

  it('lança 404 quando bairro pertence a outra loja', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue({
      ...mockNeighborhood,
      storeId: 'outra-loja',
    })

    await expect(deleteNeighborhood(STORE_ID, NB_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── createDistance ───────────────────────────────────────────────────────────

describe('createDistance', () => {
  it('cria faixa de distância válida', async () => {
    ;(mockPrisma.deliveryDistance.create as jest.Mock).mockResolvedValue(mockDistance)

    const result = await createDistance(STORE_ID, { minKm: 0, maxKm: 5, fee: 8.0 })

    expect(mockPrisma.deliveryDistance.create).toHaveBeenCalledWith({
      data: { storeId: STORE_ID, minKm: 0, maxKm: 5, fee: 8.0 },
    })
    expect(result.id).toBe(DIST_ID)
  })

  it('lança 422 quando minKm >= maxKm', async () => {
    await expect(
      createDistance(STORE_ID, { minKm: 5, maxKm: 5, fee: 8.0 })
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.deliveryDistance.create).not.toHaveBeenCalled()
  })

  it('lança 422 quando minKm > maxKm', async () => {
    await expect(
      createDistance(STORE_ID, { minKm: 10, maxKm: 5, fee: 8.0 })
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── updateDistance ───────────────────────────────────────────────────────────

describe('updateDistance', () => {
  it('atualiza faixa quando pertence à loja', async () => {
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue(mockDistance)
    ;(mockPrisma.deliveryDistance.update as jest.Mock).mockResolvedValue({
      ...mockDistance,
      fee: 12.0,
    })

    const result = await updateDistance(STORE_ID, DIST_ID, { fee: 12.0 })

    expect(result.fee).toBe(12.0)
  })

  it('lança 404 quando faixa não existe', async () => {
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(updateDistance(STORE_ID, DIST_ID, { fee: 12.0 })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('lança 404 quando faixa pertence a outra loja', async () => {
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue({
      ...mockDistance,
      storeId: 'outra-loja',
    })

    await expect(updateDistance(STORE_ID, DIST_ID, { fee: 12.0 })).rejects.toMatchObject({
      status: 404,
    })
  })
})

// ─── deleteDistance ───────────────────────────────────────────────────────────

describe('deleteDistance', () => {
  it('deleta faixa quando pertence à loja', async () => {
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue(mockDistance)
    ;(mockPrisma.deliveryDistance.delete as jest.Mock).mockResolvedValue(mockDistance)

    await deleteDistance(STORE_ID, DIST_ID)

    expect(mockPrisma.deliveryDistance.delete).toHaveBeenCalledWith({ where: { id: DIST_ID } })
  })

  it('lança 404 quando faixa não existe', async () => {
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(deleteDistance(STORE_ID, DIST_ID)).rejects.toMatchObject({ status: 404 })
    expect(mockPrisma.deliveryDistance.delete).not.toHaveBeenCalled()
  })
})

// ─── setDeliveryMode ──────────────────────────────────────────────────────────

describe('setDeliveryMode', () => {
  it('atualiza deliveryMode para NEIGHBORHOOD e registra AuditLog', async () => {
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      deliveryMode: 'NEIGHBORHOOD',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await setDeliveryMode(STORE_ID, { mode: 'NEIGHBORHOOD' }, USER_ID, IP)

    expect(result.deliveryMode).toBe('NEIGHBORHOOD')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'delivery.mode_change',
          entity: 'Store',
          entityId: STORE_ID,
        }),
      })
    )
  })

  it('atualiza deliveryMode para DISTANCE', async () => {
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      deliveryMode: 'DISTANCE',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await setDeliveryMode(STORE_ID, { mode: 'DISTANCE' }, USER_ID)

    expect(result.deliveryMode).toBe('DISTANCE')
  })
})

// ─── calculateDeliveryFee ─────────────────────────────────────────────────────

describe('calculateDeliveryFee', () => {
  it('retorna fee=0 quando loja não tem deliveryMode configurado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      deliveryMode: null,
    })

    const result = await calculateDeliveryFee(STORE_ID, {})

    expect(result.fee).toBe(0)
    expect(result.mode).toBeNull()
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(calculateDeliveryFee(STORE_ID, {})).rejects.toMatchObject({ status: 404 })
  })

  it('modo NEIGHBORHOOD: retorna taxa do bairro quando encontrado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ deliveryMode: 'NEIGHBORHOOD' })
    ;(mockPrisma.deliveryNeighborhood.findFirst as jest.Mock).mockResolvedValue(mockNeighborhood)

    const result = await calculateDeliveryFee(STORE_ID, { neighborhood: 'Centro' })

    expect(result.fee).toBe(5.0)
    expect(result.mode).toBe('NEIGHBORHOOD')
  })

  it('modo NEIGHBORHOOD: lança 422 quando bairro não está no cadastro', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ deliveryMode: 'NEIGHBORHOOD' })
    ;(mockPrisma.deliveryNeighborhood.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      calculateDeliveryFee(STORE_ID, { neighborhood: 'Bairro Inexistente' })
    ).rejects.toMatchObject({ status: 422 })
  })

  it('modo NEIGHBORHOOD: lança 422 quando bairro não é informado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ deliveryMode: 'NEIGHBORHOOD' })

    await expect(calculateDeliveryFee(STORE_ID, {})).rejects.toMatchObject({ status: 422 })
  })

  it('modo DISTANCE: lança 422 quando coordenadas não são informadas', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ deliveryMode: 'DISTANCE' })

    await expect(calculateDeliveryFee(STORE_ID, {})).rejects.toMatchObject({ status: 422 })
  })
})
