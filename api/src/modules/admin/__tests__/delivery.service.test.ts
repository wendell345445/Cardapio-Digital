// Cobre: haversine (puro), distance CRUD, setStoreCoordinates, calculateDeliveryFee.
// Calc usa maxKm-only (cliente cai no primeiro raio com dist <= maxKm). isAvailable=false
// é pulado.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    deliveryDistance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deliveryNeighborhood: {
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
  },
}))

jest.mock('../../menu/geo/geo.service', () => ({
  reverse: jest.fn(),
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  calculateDeliveryFee,
  createDistance,
  deleteDistance,
  haversine,
  setStoreCoordinates,
  updateDistance,
} from '../delivery.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const STORE_ID = 'store-1'
const DIST_ID = 'dist-1'

const mockDistance = {
  id: DIST_ID,
  storeId: STORE_ID,
  maxKm: 5,
  fee: 8.0,
  etaMin: 15,
  isAvailable: true,
  sortOrder: 0,
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
    const dist = haversine(0, 0, 1, 0)
    expect(dist).toBeGreaterThan(100)
    expect(dist).toBeLessThan(120)
  })
})

// ─── createDistance ───────────────────────────────────────────────────────────

describe('createDistance', () => {
  it('cria faixa de distância válida', async () => {
    ;(mockPrisma.deliveryDistance.create as jest.Mock).mockResolvedValue(mockDistance)

    const result = await createDistance(STORE_ID, {
      maxKm: 5,
      fee: 8.0,
      etaMin: 15,
      isAvailable: true,
    })

    expect(mockPrisma.deliveryDistance.create).toHaveBeenCalledWith({
      data: {
        storeId: STORE_ID,
        maxKm: 5,
        fee: 8.0,
        etaMin: 15,
        isAvailable: true,
      },
    })
    expect(result.id).toBe(DIST_ID)
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

  it('lança 404 quando faixa pertence a outra loja (isolamento multi-tenant)', async () => {
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

// ─── setStoreCoordinates ─────────────────────────────────────────────────────

describe('setStoreCoordinates', () => {
  it('usa addressLabel explícito quando cliente envia (não faz reverse)', async () => {
    const { reverse } = jest.requireMock('../../menu/geo/geo.service')
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: 'Av. Paulista, 1000',
    })

    const result = await setStoreCoordinates(STORE_ID, {
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: 'Av. Paulista, 1000',
    })

    expect(reverse).not.toHaveBeenCalled()
    expect(mockPrisma.store.update).toHaveBeenCalledWith({
      where: { id: STORE_ID },
      data: {
        latitude: -23.5505,
        longitude: -46.6333,
        addressLabel: 'Av. Paulista, 1000',
      },
      select: { id: true, latitude: true, longitude: true, addressLabel: true },
    })
    expect(result.addressLabel).toBe('Av. Paulista, 1000')
  })

  it('faz reverse-geocode e salva displayName quando addressLabel não é enviado', async () => {
    const { reverse } = jest.requireMock('../../menu/geo/geo.service')
    ;(reverse as jest.Mock).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
      displayName: 'Av. Paulista, 1000 - Bela Vista, São Paulo',
    })
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: 'Av. Paulista, 1000 - Bela Vista, São Paulo',
    })

    await setStoreCoordinates(STORE_ID, { latitude: -23.5505, longitude: -46.6333 })

    expect(reverse).toHaveBeenCalledWith(-23.5505, -46.6333)
    expect(mockPrisma.store.update).toHaveBeenCalledWith({
      where: { id: STORE_ID },
      data: {
        latitude: -23.5505,
        longitude: -46.6333,
        addressLabel: 'Av. Paulista, 1000 - Bela Vista, São Paulo',
      },
      select: { id: true, latitude: true, longitude: true, addressLabel: true },
    })
  })

  it('salva com addressLabel=null quando reverse-geocode falha (nao bloqueia save)', async () => {
    const { reverse } = jest.requireMock('../../menu/geo/geo.service')
    ;(reverse as jest.Mock).mockRejectedValue(new Error('Nominatim down'))
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: null,
    })

    await setStoreCoordinates(STORE_ID, { latitude: -23.5505, longitude: -46.6333 })

    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ addressLabel: null }),
      })
    )
  })

  it('salva addressLabel=null explicitamente quando cliente envia null (reset)', async () => {
    const { reverse } = jest.requireMock('../../menu/geo/geo.service')
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: null,
    })

    await setStoreCoordinates(STORE_ID, {
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: null,
    })

    expect(reverse).not.toHaveBeenCalled()
    expect(mockPrisma.store.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ addressLabel: null }),
      })
    )
  })
})

// ─── calculateDeliveryFee (só por distância) ─────────────────────────────────

describe('calculateDeliveryFee', () => {
  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      calculateDeliveryFee(STORE_ID, { latitude: -23.55, longitude: -46.63 })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando loja não tem coordenadas configuradas', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      latitude: null,
      longitude: null,
    })

    await expect(
      calculateDeliveryFee(STORE_ID, { latitude: -23.55, longitude: -46.63 })
    ).rejects.toMatchObject({ status: 422, message: 'Coordenadas da loja não configuradas' })
  })

  it('lança 422 quando nenhuma faixa de distância está cadastrada', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
    })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([])

    await expect(
      calculateDeliveryFee(STORE_ID, { latitude: -23.55, longitude: -46.63 })
    ).rejects.toMatchObject({ status: 422, message: 'Nenhuma faixa de distância configurada' })
  })

  it('retorna taxa correta para distância dentro de uma faixa', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      latitude: -23.5614,
      longitude: -46.6558,
    })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', storeId: STORE_ID, maxKm: 5, fee: 5.0, etaMin: 10, isAvailable: true },
      { id: 'd2', storeId: STORE_ID, maxKm: 10, fee: 10.0, etaMin: 20, isAvailable: true },
      { id: 'd3', storeId: STORE_ID, maxKm: 20, fee: 18.0, etaMin: 30, isAvailable: true },
    ])

    const result = await calculateDeliveryFee(STORE_ID, {
      latitude: -23.5889,
      longitude: -46.6388,
    })

    if ('distance' in result) {
      expect(result.fee).toBe(5.0)
      expect(result.distance).toBeGreaterThan(0)
      expect(result.distance).toBeLessThan(5)
    } else {
      throw new Error('esperado retorno por distância')
    }
  })

  it('retorna taxa da faixa correta para distância maior', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
    })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', storeId: STORE_ID, maxKm: 5, fee: 5.0, etaMin: 10, isAvailable: true },
      { id: 'd2', storeId: STORE_ID, maxKm: 10, fee: 10.0, etaMin: 20, isAvailable: true },
      { id: 'd3', storeId: STORE_ID, maxKm: 20, fee: 18.0, etaMin: 30, isAvailable: true },
    ])

    // Cliente em Guarulhos (~15km)
    const result = await calculateDeliveryFee(STORE_ID, {
      latitude: -23.4538,
      longitude: -46.5333,
    })

    if ('distance' in result) {
      expect(result.fee).toBe(18.0)
      expect(result.distance).toBeGreaterThan(10)
      expect(result.distance).toBeLessThan(20)
    } else {
      throw new Error('esperado retorno por distância')
    }
  })

  it('pula raios indisponíveis e cai no próximo (filtro isAvailable)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      latitude: -23.5614,
      longitude: -46.6558,
    })
    // Calc service só consulta isAvailable=true, então mock retorna só os disponíveis.
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd2', storeId: STORE_ID, maxKm: 10, fee: 10.0, etaMin: 20, isAvailable: true },
      { id: 'd3', storeId: STORE_ID, maxKm: 20, fee: 18.0, etaMin: 30, isAvailable: true },
    ])

    const result = await calculateDeliveryFee(STORE_ID, {
      latitude: -23.5889,
      longitude: -46.6388,
    })

    if ('distance' in result) {
      // dist ~3km — raio 0-5 estava indisponível, cai no raio 10km.
      expect(result.fee).toBe(10.0)
    } else {
      throw new Error('esperado retorno por distância')
    }
  })

  it('lança 422 quando distância fora de todas as faixas', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
    })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', storeId: STORE_ID, maxKm: 5, fee: 5.0, etaMin: 10, isAvailable: true },
      { id: 'd2', storeId: STORE_ID, maxKm: 10, fee: 10.0, etaMin: 20, isAvailable: true },
    ])

    // Cliente no Rio (~357km) — fora de qualquer faixa
    await expect(
      calculateDeliveryFee(STORE_ID, { latitude: -22.9068, longitude: -43.1729 })
    ).rejects.toMatchObject({ status: 422, message: 'Distância fora da área de entrega' })
  })

  it('calcula taxa por bairro quando neighborhoodId é informado', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue({
      id: 'n1',
      storeId: STORE_ID,
      name: 'Vila Madalena',
      fee: 7.5,
      etaMin: 25,
      isAvailable: true,
    })

    const result = await calculateDeliveryFee(STORE_ID, { neighborhoodId: 'n1' })

    if ('neighborhoodId' in result) {
      expect(result.fee).toBe(7.5)
      expect(result.etaMin).toBe(25)
      expect(result.neighborhoodName).toBe('Vila Madalena')
    } else {
      throw new Error('esperado retorno por bairro')
    }
  })

  it('lança 422 quando bairro está indisponível', async () => {
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue({
      id: 'n1',
      storeId: STORE_ID,
      name: 'Bairro X',
      fee: 5,
      etaMin: 20,
      isAvailable: false,
    })

    await expect(
      calculateDeliveryFee(STORE_ID, { neighborhoodId: 'n1' })
    ).rejects.toMatchObject({ status: 422, message: 'Bairro indisponível para entrega' })
  })
})
