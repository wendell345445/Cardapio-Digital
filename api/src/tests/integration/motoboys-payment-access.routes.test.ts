// ─── TASK-053/054: Motoboys e Blacklist/Whitelist — Integration Tests ─────────

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: { deleteMany: jest.fn() },
    order: { findFirst: jest.fn() },
    store: { findUnique: jest.fn() },
    clientPaymentAccess: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
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

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}))

import request from 'supertest'
import { sign } from 'jsonwebtoken'

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const STORE_ID = 'store-1'
const MOTOBOY_ID = 'motoboy-1'
const CLIENT_ID = 'client-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'admin-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockMotoboySelect = {
  id: MOTOBOY_ID,
  name: 'Carlos Moto',
  email: 'carlos@moto.com',
  whatsapp: '5548999990001',
  isActive: true,
  storeId: STORE_ID,
}

const mockMotoboy = {
  ...mockMotoboySelect,
  passwordHash: 'hashed-password',
  role: 'MOTOBOY' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockClient = {
  id: CLIENT_ID,
  name: 'João Cliente',
  email: 'joao@email.com',
  whatsapp: '5548999990002',
  role: 'CLIENT' as const,
  storeId: null,
}

beforeEach(() => jest.clearAllMocks())

// ─── GET /admin/store/motoboys ────────────────────────────────────────────────

describe('GET /api/v1/admin/store/motoboys', () => {
  it('retorna 200 com lista de motoboys da loja', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([mockMotoboySelect])

    const res = await request(app)
      .get('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Carlos Moto')
  })

  it('retorna 200 com lista vazia quando não há motoboys', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/store/motoboys')

    expect(res.status).toBe(401)
  })

  it('retorna 403 quando token não tem storeId', async () => {
    const tokenNoStore = sign({ userId: 'admin-1', role: 'ADMIN' }, 'test-secret')
    const res = await request(app)
      .get('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${tokenNoStore}`)

    expect(res.status).toBe(403)
  })
})

// ─── POST /admin/store/motoboys ───────────────────────────────────────────────

describe('POST /api/v1/admin/store/motoboys', () => {
  const validPayload = {
    name: 'Carlos Moto',
    email: 'carlos@moto.com',
    whatsapp: '5548999990001',
    password: '12345678',
  }

  it('retorna 201 ao criar motoboy com sucesso', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue(mockMotoboySelect)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body.data.id).toBe(MOTOBOY_ID)
    expect(res.body.data.name).toBe('Carlos Moto')
  })

  it('retorna 422 quando email já existe nesta loja', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockMotoboy)

    const res = await request(app)
      .post('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validPayload)

    expect(res.status).toBe(422)
  })

  it('retorna 422 quando nem email nem whatsapp são informados', async () => {
    const res = await request(app)
      .post('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Carlos', password: '12345678' })

    expect(res.status).toBe(422)
  })

  it('retorna 400 quando name não é informado', async () => {
    const res = await request(app)
      .post('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'carlos@moto.com', password: '12345678' })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando password não é informado', async () => {
    const res = await request(app)
      .post('/api/v1/admin/store/motoboys')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Carlos', email: 'carlos@moto.com' })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/v1/admin/store/motoboys')
      .send(validPayload)

    expect(res.status).toBe(401)
  })
})

// ─── DELETE /admin/store/motoboys/:id ────────────────────────────────────────

describe('DELETE /api/v1/admin/store/motoboys/:id', () => {
  it('retorna 200 ao remover motoboy', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.user.delete as jest.Mock).mockResolvedValue(mockMotoboy)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .delete(`/api/v1/admin/store/motoboys/${MOTOBOY_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('retorna 404 quando motoboy não existe', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .delete('/api/v1/admin/store/motoboys/nao-existe')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })

  it('retorna 404 quando motoboy pertence a outra loja', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...mockMotoboy,
      storeId: 'outra-loja',
    })

    const res = await request(app)
      .delete(`/api/v1/admin/store/motoboys/${MOTOBOY_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app).delete(`/api/v1/admin/store/motoboys/${MOTOBOY_ID}`)

    expect(res.status).toBe(401)
  })
})

// ─── GET /admin/store/clients ─────────────────────────────────────────────────

describe('GET /api/v1/admin/store/clients', () => {
  it('retorna 200 com lista de clientes da loja', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: CLIENT_ID,
        name: 'João Cliente',
        email: 'joao@email.com',
        whatsapp: '5548999990002',
        clientAccessLists: [],
      },
    ])

    const res = await request(app)
      .get('/api/v1/admin/store/clients')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].accessType).toBeNull()
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/store/clients')

    expect(res.status).toBe(401)
  })
})

// ─── POST /admin/store/payment-access ────────────────────────────────────────

describe('POST /api/v1/admin/store/payment-access', () => {
  const mockAccess = { id: 'access-1', storeId: STORE_ID, clientId: CLIENT_ID, type: 'BLACKLIST' as const }

  it('retorna 201 ao adicionar cliente à BLACKLIST', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockClient)
    ;(mockPrisma.clientPaymentAccess.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.clientPaymentAccess.create as jest.Mock).mockResolvedValue(mockAccess)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/store/payment-access')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ clientId: CLIENT_ID, type: 'BLACKLIST' })

    expect(res.status).toBe(201)
    expect(res.body.data.type).toBe('BLACKLIST')
  })

  it('retorna 201 ao adicionar cliente à WHITELIST', async () => {
    const whitelistAccess = { ...mockAccess, type: 'WHITELIST' as const }
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockClient)
    ;(mockPrisma.clientPaymentAccess.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.clientPaymentAccess.create as jest.Mock).mockResolvedValue(whitelistAccess)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/store/payment-access')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ clientId: CLIENT_ID, type: 'WHITELIST' })

    expect(res.status).toBe(201)
  })

  it('retorna 422 quando cliente não tem histórico na loja', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/admin/store/payment-access')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ clientId: CLIENT_ID, type: 'BLACKLIST' })

    expect(res.status).toBe(422)
  })

  it('retorna 400 quando type é inválido', async () => {
    const res = await request(app)
      .post('/api/v1/admin/store/payment-access')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ clientId: CLIENT_ID, type: 'INVALIDO' })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando clientId não é informado', async () => {
    const res = await request(app)
      .post('/api/v1/admin/store/payment-access')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ type: 'BLACKLIST' })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .post('/api/v1/admin/store/payment-access')
      .send({ clientId: CLIENT_ID, type: 'BLACKLIST' })

    expect(res.status).toBe(401)
  })
})

// ─── DELETE /admin/store/payment-access/:clientId ────────────────────────────

describe('DELETE /api/v1/admin/store/payment-access/:clientId', () => {
  const mockAccess = { id: 'access-1', storeId: STORE_ID, clientId: CLIENT_ID, type: 'BLACKLIST' as const }

  it('retorna 200 ao remover cliente da lista', async () => {
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(mockAccess)
    ;(mockPrisma.clientPaymentAccess.delete as jest.Mock).mockResolvedValue(mockAccess)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .delete(`/api/v1/admin/store/payment-access/${CLIENT_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('retorna 404 quando entrada não existe', async () => {
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .delete(`/api/v1/admin/store/payment-access/nao-existe`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app).delete(`/api/v1/admin/store/payment-access/${CLIENT_ID}`)

    expect(res.status).toBe(401)
  })
})
