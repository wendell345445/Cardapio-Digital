// ─── TASK-091: Área de Entrega — Integration Tests ───────────────────────────
// Cobre: CRUD /admin/delivery/neighborhoods, /admin/delivery/distances,
//        PATCH /admin/delivery/mode, GET /admin/delivery

jest.mock('../../shared/prisma/prisma', () => ({
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

jest.mock('../../shared/redis/redis', () => ({
  cache: { del: jest.fn(), get: jest.fn(), set: jest.fn() },
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
const NB_ID = 'nb-1'
const DIST_ID = 'dist-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockStore = {
  id: STORE_ID,
  slug: 'minha-loja',
  status: 'ACTIVE',
  plan: 'PREMIUM',
  deliveryMode: null,
}

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

// ─── GET /admin/delivery ──────────────────────────────────────────────────────

describe('GET /api/v1/admin/delivery', () => {
  it('retorna 200 com config de entrega completa', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findMany as jest.Mock).mockResolvedValue([mockNeighborhood])
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([mockDistance])

    const res = await request(app)
      .get('/api/v1/admin/delivery')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('neighborhoods')
    expect(res.body.data).toHaveProperty('distances')
    expect(res.body.data).toHaveProperty('deliveryMode')
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/delivery')
    expect(res.status).toBe(401)
  })
})

// ─── PATCH /admin/delivery/mode ───────────────────────────────────────────────

describe('PATCH /api/v1/admin/delivery/mode', () => {
  it('retorna 200 ao definir modo NEIGHBORHOOD', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      ...mockStore,
      deliveryMode: 'NEIGHBORHOOD',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/delivery/mode')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ mode: 'NEIGHBORHOOD' })

    expect(res.status).toBe(200)
    expect(res.body.data.deliveryMode).toBe('NEIGHBORHOOD')
  })

  it('retorna 200 ao definir modo DISTANCE', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      ...mockStore,
      deliveryMode: 'DISTANCE',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/delivery/mode')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ mode: 'DISTANCE' })

    expect(res.status).toBe(200)
    expect(res.body.data.deliveryMode).toBe('DISTANCE')
  })

  it('retorna 400 para mode inválido', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .patch('/api/v1/admin/delivery/mode')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ mode: 'INVALIDO' })

    expect(res.status).toBe(400)
  })
})

// ─── GET /admin/delivery/neighborhoods ───────────────────────────────────────

describe('GET /api/v1/admin/delivery/neighborhoods', () => {
  it('retorna 200 com lista de bairros', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findMany as jest.Mock).mockResolvedValue([mockNeighborhood])

    const res = await request(app)
      .get('/api/v1/admin/delivery/neighborhoods')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Centro')
  })
})

// ─── POST /admin/delivery/neighborhoods ──────────────────────────────────────

describe('POST /api/v1/admin/delivery/neighborhoods', () => {
  it('retorna 201 ao criar bairro', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.create as jest.Mock).mockResolvedValue(mockNeighborhood)

    const res = await request(app)
      .post('/api/v1/admin/delivery/neighborhoods')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Centro', fee: 5.0 })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Centro')
    expect(res.body.data.fee).toBe(5.0)
  })

  it('retorna 400 para payload inválido (fee ausente)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/admin/delivery/neighborhoods')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Centro' }) // sem fee

    expect(res.status).toBe(400)
  })
})

// ─── PATCH /admin/delivery/neighborhoods/:id ──────────────────────────────────

describe('PATCH /api/v1/admin/delivery/neighborhoods/:id', () => {
  it('retorna 200 ao atualizar taxa do bairro', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(mockNeighborhood)
    ;(mockPrisma.deliveryNeighborhood.update as jest.Mock).mockResolvedValue({
      ...mockNeighborhood,
      fee: 7.0,
    })

    const res = await request(app)
      .patch(`/api/v1/admin/delivery/neighborhoods/${NB_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ fee: 7.0 })

    expect(res.status).toBe(200)
    expect(res.body.data.fee).toBe(7.0)
  })

  it('retorna 404 quando bairro não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch('/api/v1/admin/delivery/neighborhoods/nao-existe')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ fee: 7.0 })

    expect(res.status).toBe(404)
  })
})

// ─── DELETE /admin/delivery/neighborhoods/:id ─────────────────────────────────

describe('DELETE /api/v1/admin/delivery/neighborhoods/:id', () => {
  it('retorna 204 ao deletar bairro', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(mockNeighborhood)
    ;(mockPrisma.deliveryNeighborhood.delete as jest.Mock).mockResolvedValue(mockNeighborhood)

    const res = await request(app)
      .delete(`/api/v1/admin/delivery/neighborhoods/${NB_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('retorna 404 para bairro inexistente', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.deliveryNeighborhood.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/v1/admin/delivery/neighborhoods/nao-existe')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
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
      .send({ minKm: 0, maxKm: 5, fee: 8.0 })

    expect(res.status).toBe(201)
    expect(res.body.data.minKm).toBe(0)
    expect(res.body.data.maxKm).toBe(5)
  })

  it('retorna 422 quando minKm >= maxKm', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/admin/delivery/distances')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ minKm: 5, maxKm: 5, fee: 8.0 })

    expect(res.status).toBe(422)
  })

  it('retorna 400 para payload sem fee', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/admin/delivery/distances')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ minKm: 0, maxKm: 5 }) // sem fee

    expect(res.status).toBe(400)
  })
})

// ─── PATCH /admin/delivery/distances/:id ─────────────────────────────────────

describe('PATCH /api/v1/admin/delivery/distances/:id', () => {
  it('retorna 200 ao atualizar faixa de distância', async () => {
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
  it('retorna 200 ao deletar faixa de distância', async () => {
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

// ─── PATCH /admin/delivery/coordinates ──────────────────────────────────────

describe('PATCH /api/v1/admin/delivery/coordinates', () => {
  it('retorna 200 ao definir coordenadas da loja', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      latitude: -23.5505,
      longitude: -46.6333,
    })

    const res = await request(app)
      .patch('/api/v1/admin/delivery/coordinates')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ latitude: -23.5505, longitude: -46.6333 })

    expect(res.status).toBe(200)
    expect(res.body.data.latitude).toBe(-23.5505)
    expect(res.body.data.longitude).toBe(-46.6333)
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
