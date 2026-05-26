// Integration tests da área de entrega.
// Cobre: GET /admin/delivery, PATCH /admin/delivery/coordinates,
//        PATCH /admin/delivery/settings,
//        CRUD /admin/delivery/distances, CRUD /admin/delivery/neighborhoods.

jest.mock('../../shared/prisma/prisma', () => ({
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
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: { del: jest.fn(), get: jest.fn(), set: jest.fn() },
}))

jest.mock('../../modules/menu/geo/geo.service', () => ({
  geocode: jest.fn().mockResolvedValue({
    latitude: -23.5505,
    longitude: -46.6333,
    displayName: 'Av. Paulista, 1000',
  }),
  reverseGeocode: jest.fn().mockResolvedValue({
    latitude: -23.5505,
    longitude: -46.6333,
    displayName: 'Av. Paulista, 1000 - Bela Vista, São Paulo',
  }),
}))

jest.mock('../../modules/auth/passport.config', () => ({
  configurePassport: jest.fn(),
}))

import request from 'supertest'
import { sign } from 'jsonwebtoken'

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const STORE_ID = 'store-1'
const DIST_ID = 'dist-1'
const NEIGH_ID = '11111111-1111-4111-8111-111111111111'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockStore = {
  id: STORE_ID,
  slug: 'minha-loja',
  status: 'ACTIVE',
  plan: 'PREMIUM',
  latitude: null,
  longitude: null,
  prepTimeMin: 30,
  freeDeliveryAboveCents: null,
}

const mockDistance = {
  id: DIST_ID,
  storeId: STORE_ID,
  maxKm: 5,
  fee: 8.0,
  etaMin: 15,
  isAvailable: true,
  sortOrder: 0,
}

const mockNeighborhood = {
  id: NEIGH_ID,
  storeId: STORE_ID,
  name: 'Centro',
  fee: 5.0,
  etaMin: 20,
  isAvailable: true,
  sortOrder: 0,
  createdAt: new Date(),
}

beforeEach(() => jest.clearAllMocks())

// ─── GET /admin/delivery ──────────────────────────────────────────────────────

describe('GET /api/v1/admin/delivery', () => {
  it('retorna 200 com lat/lng + settings + distances + neighborhoods', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([mockDistance])
    ;(mockPrisma.deliveryNeighborhood.findMany as jest.Mock).mockResolvedValue([mockNeighborhood])

    const res = await request(app)
      .get('/api/v1/admin/delivery')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('distances')
    expect(res.body.data).toHaveProperty('neighborhoods')
    expect(res.body.data).toHaveProperty('prepTimeMin', 30)
    expect(res.body.data).toHaveProperty('freeDeliveryAboveCents', null)
    expect(res.body.data.distances[0]).toMatchObject({ maxKm: 5, etaMin: 15, isAvailable: true })
    expect(res.body.data.neighborhoods[0]).toMatchObject({ name: 'Centro', fee: 5.0 })
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/delivery')
    expect(res.status).toBe(401)
  })
})

// ─── POST /admin/delivery/distances ──────────────────────────────────────────

describe('POST /api/v1/admin/delivery/distances', () => {
  it('retorna 201 ao criar faixa de distância válida', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryDistance.create as jest.Mock).mockResolvedValue(mockDistance)

    const res = await request(app)
      .post('/api/v1/admin/delivery/distances')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ maxKm: 5, fee: 8.0, etaMin: 15, isAvailable: true })

    expect(res.status).toBe(201)
    expect(res.body.data.maxKm).toBe(5)
    expect(res.body.data.etaMin).toBe(15)
  })

  it('retorna 400 para payload sem fee', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/admin/delivery/distances')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ maxKm: 5 })

    expect(res.status).toBe(400)
  })
})

// ─── PATCH /admin/delivery/distances/:id ─────────────────────────────────────

describe('PATCH /api/v1/admin/delivery/distances/:id', () => {
  it('retorna 200 ao atualizar faixa', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue(mockDistance)
    ;(mockPrisma.deliveryDistance.update as jest.Mock).mockResolvedValue({
      ...mockDistance,
      fee: 12.0,
    })

    const res = await request(app)
      .patch(`/api/v1/admin/delivery/distances/${DIST_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ fee: 12.0 })

    expect(res.status).toBe(200)
    expect(res.body.data.fee).toBe(12.0)
  })

  it('retorna 404 para faixa inexistente', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/admin/delivery/distances/nao-existe')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ fee: 12.0 })

    expect(res.status).toBe(404)
  })
})

// ─── DELETE /admin/delivery/distances/:id ────────────────────────────────────

describe('DELETE /api/v1/admin/delivery/distances/:id', () => {
  it('retorna 200 ao deletar faixa', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryDistance.findUnique as jest.Mock).mockResolvedValue(mockDistance)
    ;(mockPrisma.deliveryDistance.delete as jest.Mock).mockResolvedValue(mockDistance)

    const res = await request(app)
      .delete(`/api/v1/admin/delivery/distances/${DIST_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ─── CRUD /admin/delivery/neighborhoods ──────────────────────────────────────

describe('POST /api/v1/admin/delivery/neighborhoods', () => {
  it('retorna 201 ao criar bairro novo', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.deliveryNeighborhood.create as jest.Mock).mockResolvedValue(mockNeighborhood)

    const res = await request(app)
      .post('/api/v1/admin/delivery/neighborhoods')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Centro', fee: 5, etaMin: 20, isAvailable: true })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Centro')
  })

  it('retorna 422 quando bairro já existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(mockNeighborhood)

    const res = await request(app)
      .post('/api/v1/admin/delivery/neighborhoods')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Centro', fee: 5, etaMin: 20, isAvailable: true })

    expect(res.status).toBe(422)
  })
})

describe('PATCH /api/v1/admin/delivery/neighborhoods/:id', () => {
  it('retorna 200 ao atualizar bairro', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(mockNeighborhood)
    ;(mockPrisma.deliveryNeighborhood.update as jest.Mock).mockResolvedValue({
      ...mockNeighborhood,
      fee: 7.5,
    })

    const res = await request(app)
      .patch(`/api/v1/admin/delivery/neighborhoods/${NEIGH_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ fee: 7.5 })

    expect(res.status).toBe(200)
    expect(res.body.data.fee).toBe(7.5)
  })
})

describe('DELETE /api/v1/admin/delivery/neighborhoods/:id', () => {
  it('retorna 200 ao remover bairro', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(mockNeighborhood)
    ;(mockPrisma.deliveryNeighborhood.delete as jest.Mock).mockResolvedValue(mockNeighborhood)

    const res = await request(app)
      .delete(`/api/v1/admin/delivery/neighborhoods/${NEIGH_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
  })
})

// ─── PATCH /admin/delivery/settings ──────────────────────────────────────────

describe('PATCH /api/v1/admin/delivery/settings', () => {
  it('retorna 200 ao atualizar prepTime + free delivery', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      prepTimeMin: 45,
      freeDeliveryAboveCents: 5000,
    })

    const res = await request(app)
      .patch('/api/v1/admin/delivery/settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ prepTimeMin: 45, freeDeliveryAboveCents: 5000 })

    expect(res.status).toBe(200)
    expect(res.body.data.prepTimeMin).toBe(45)
    expect(res.body.data.freeDeliveryAboveCents).toBe(5000)
  })

  it('retorna 200 desativando frete grátis com null', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      prepTimeMin: 30,
      freeDeliveryAboveCents: null,
        })

    const res = await request(app)
      .patch('/api/v1/admin/delivery/settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ freeDeliveryAboveCents: null })

    expect(res.status).toBe(200)
    expect(res.body.data.freeDeliveryAboveCents).toBeNull()
  })
})

// ─── PATCH /admin/delivery/coordinates ──────────────────────────────────────

describe('PATCH /api/v1/admin/delivery/coordinates', () => {
  it('retorna 200 ao definir coordenadas da loja', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: null,
    })

    const res = await request(app)
      .patch('/api/v1/admin/delivery/coordinates')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ latitude: -23.5505, longitude: -46.6333 })

    expect(res.status).toBe(200)
    expect(res.body.data.latitude).toBe(-23.5505)
    expect(res.body.data.longitude).toBe(-46.6333)
  })

  it('retorna 200 e persiste addressLabel quando enviado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      latitude: -23.5505,
      longitude: -46.6333,
      addressLabel: 'Av. Paulista, 1000 - São Paulo',
    })

    const res = await request(app)
      .patch('/api/v1/admin/delivery/coordinates')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        latitude: -23.5505,
        longitude: -46.6333,
        addressLabel: 'Av. Paulista, 1000 - São Paulo',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.addressLabel).toBe('Av. Paulista, 1000 - São Paulo')
  })

  it('retorna 400 para latitude fora do range', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .patch('/api/v1/admin/delivery/coordinates')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ latitude: -100, longitude: -46.63 })

    expect(res.status).toBe(400)
  })

  it('retorna 400 para longitude fora do range', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .patch('/api/v1/admin/delivery/coordinates')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ latitude: -23.55, longitude: -200 })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/delivery/coordinates')
      .send({ latitude: -23.55, longitude: -46.63 })

    expect(res.status).toBe(401)
  })
})

// ─── POST /admin/delivery/geocode ────────────────────────────────────────────

describe('POST /api/v1/admin/delivery/geocode', () => {
  it('retorna 200 com lat/lng/displayName do provider', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/admin/delivery/geocode')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ street: 'Av. Paulista, 1000, São Paulo' })

    expect(res.status).toBe(200)
    expect(res.body.data.latitude).toBe(-23.5505)
    expect(res.body.data.longitude).toBe(-46.6333)
    expect(res.body.data.displayName).toBeDefined()
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app)
      .post('/api/v1/admin/delivery/geocode')
      .send({ street: 'Av. Paulista, 1000' })

    expect(res.status).toBe(401)
  })
})
