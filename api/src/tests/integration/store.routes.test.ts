// ─── TASK-050/051/052: Configurações da Loja — Integration Tests ──────────────

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn(), update: jest.fn() },
    businessHour: { findMany: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: { del: jest.fn(), get: jest.fn(), set: jest.fn() },
}))

jest.mock('../../modules/auth/passport.config', () => ({
  configurePassport: jest.fn(),
}))

jest.mock('../../modules/auth/auth.service', () => ({
  reauth: jest.fn(),
}))

import request from 'supertest'
import { sign } from 'jsonwebtoken'

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'
import { reauth } from '../../modules/auth/auth.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockReauth = reauth as jest.Mock

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const STORE_ID = 'store-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'admin-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockStore = {
  id: STORE_ID,
  name: 'Pizzaria do Zé',
  slug: 'pizzaria-do-ze',
  description: 'As melhores pizzas',
  logo: null,
  address: 'Rua A, 123',
  phone: '5548999990000',
  manualOpen: null,
  pixKey: null,
  pixKeyType: null,
  allowCashOnDelivery: true,
  allowPickup: false,
  serviceChargePercent: null,
  features: { allowPix: true },
}

beforeEach(() => jest.clearAllMocks())

// ─── GET /admin/store ─────────────────────────────────────────────────────────

describe('GET /api/v1/admin/store', () => {
  it('retorna 200 com dados da loja', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .get('/api/v1/admin/store')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('Pizzaria do Zé')
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/store')

    expect(res.status).toBe(401)
  })

  it('retorna 403 quando token não tem storeId', async () => {
    const tokenNoStore = sign({ userId: 'admin-1', role: 'ADMIN' }, 'test-secret')
    const res = await request(app)
      .get('/api/v1/admin/store')
      .set('Authorization', `Bearer ${tokenNoStore}`)

    expect(res.status).toBe(403)
  })

  it('retorna 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/store')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── PATCH /admin/store ───────────────────────────────────────────────────────

describe('PATCH /api/v1/admin/store', () => {
  it('retorna 200 ao atualizar nome da loja', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      name: 'Nova Pizzaria',
      description: null,
      logo: null,
      address: null,
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Nova Pizzaria' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Nova Pizzaria')
  })

  it('retorna 400 quando nome é muito curto (< 2 chars)', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'X' })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando nome excede 100 chars', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'A'.repeat(101) })

    expect(res.status).toBe(400)
  })

  it('aceita body vazio (partial update — nenhum campo obrigatório)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      name: 'Pizzaria do Zé',
      description: null,
      logo: null,
      address: null,
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({})

    expect(res.status).toBe(200)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app).patch('/api/v1/admin/store').send({ name: 'X' })

    expect(res.status).toBe(401)
  })
})

// ─── GET /admin/store/hours ───────────────────────────────────────────────────

describe('GET /api/v1/admin/store/hours', () => {
  it('retorna 200 com 7 dias', async () => {
    ;(mockPrisma.businessHour.findMany as jest.Mock).mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(7)
  })

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/admin/store/hours')

    expect(res.status).toBe(401)
  })
})

// ─── PUT /admin/store/hours ───────────────────────────────────────────────────

describe('PUT /api/v1/admin/store/hours', () => {
  const validHours = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    openTime: '08:00',
    closeTime: '22:00',
    isClosed: false,
  }))

  it('retorna 200 ao salvar 7 dias de horários', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.businessHour.upsert as jest.Mock).mockImplementation(({ create }) =>
      Promise.resolve({ ...create, id: `bh-${create.dayOfWeek}` })
    )
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ hours: validHours })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(7)
  })

  it('retorna 400 quando hours tem menos de 7 dias', async () => {
    const res = await request(app)
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ hours: validHours.slice(0, 5) })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando openTime está em formato inválido (não HH:mm)', async () => {
    const badHours = validHours.map((h, i) =>
      i === 0 ? { ...h, openTime: '8h00' } : h
    )
    const res = await request(app)
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ hours: badHours })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando dayOfWeek é inválido (> 6)', async () => {
    const badHours = validHours.map((h, i) =>
      i === 0 ? { ...h, dayOfWeek: 7 } : h
    )
    const res = await request(app)
      .put('/api/v1/admin/store/hours')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ hours: badHours })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .put('/api/v1/admin/store/hours')
      .send({ hours: validHours })

    expect(res.status).toBe(401)
  })
})

// ─── PATCH /admin/store/status ────────────────────────────────────────────────

describe('PATCH /api/v1/admin/store/status', () => {
  it('retorna 200 ao abrir loja manualmente (manualOpen=true)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, manualOpen: true })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ manualOpen: true })

    expect(res.status).toBe(200)
    expect(res.body.data.manualOpen).toBe(true)
  })

  it('retorna 200 ao fechar loja manualmente (manualOpen=false)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, manualOpen: false })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ manualOpen: false })

    expect(res.status).toBe(200)
    expect(res.body.data.manualOpen).toBe(false)
  })

  it('retorna 200 ao restaurar controle automático (manualOpen=null)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, manualOpen: null })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ manualOpen: null })

    expect(res.status).toBe(200)
    expect(res.body.data.manualOpen).toBeNull()
  })

  it('retorna 400 quando manualOpen não é boolean nem null', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ manualOpen: 'aberto' })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/status')
      .send({ manualOpen: true })

    expect(res.status).toBe(401)
  })
})

// ─── PATCH /admin/store/whatsapp ──────────────────────────────────────────────

describe('PATCH /api/v1/admin/store/whatsapp', () => {
  it('retorna 200 ao alterar whatsapp com senha correta', async () => {
    mockReauth.mockResolvedValue(undefined)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({ id: STORE_ID, phone: '5548988880000' })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store/whatsapp')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ phone: '5548988880000', password: 'senha123' })

    expect(res.status).toBe(200)
    expect(res.body.data.phone).toBe('5548988880000')
  })

  it('retorna 403 ao alterar whatsapp com senha incorreta', async () => {
    const authError = Object.assign(new Error('Senha incorreta'), { status: 403 })
    mockReauth.mockRejectedValue(authError)

    const res = await request(app)
      .patch('/api/v1/admin/store/whatsapp')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ phone: '5548988880000', password: 'errada' })

    expect(res.status).toBe(403)
  })

  it('retorna 400 quando phone tem formato inválido', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/whatsapp')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ phone: '123', password: 'senha123' })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando password não informado', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/whatsapp')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ phone: '5548988880000' })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/whatsapp')
      .send({ phone: '5548988880000', password: 'senha123' })

    expect(res.status).toBe(401)
  })
})

// ─── PATCH /admin/store/pix ───────────────────────────────────────────────────

describe('PATCH /api/v1/admin/store/pix', () => {
  it('retorna 200 ao alterar chave Pix com senha correta', async () => {
    mockReauth.mockResolvedValue(undefined)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      pixKey: 'joao@email.com',
      pixKeyType: 'EMAIL',
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store/pix')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ pixKey: 'joao@email.com', pixKeyType: 'EMAIL', password: 'senha123' })

    expect(res.status).toBe(200)
    expect(res.body.data.pixKey).toBe('joao@email.com')
    expect(res.body.data.pixKeyType).toBe('EMAIL')
  })

  it('retorna 403 ao alterar Pix sem senha correta', async () => {
    const authError = Object.assign(new Error('Senha incorreta'), { status: 403 })
    mockReauth.mockRejectedValue(authError)

    const res = await request(app)
      .patch('/api/v1/admin/store/pix')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ pixKey: 'x', pixKeyType: 'EVP', password: 'errada' })

    expect(res.status).toBe(403)
  })

  it('retorna 400 quando pixKeyType é inválido', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/pix')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ pixKey: 'algo', pixKeyType: 'INVALIDO', password: 'senha123' })

    expect(res.status).toBe(400)
  })

  it('aceita todos os tipos válidos de pixKeyType', async () => {
    const validTypes = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']

    for (const pixKeyType of validTypes) {
      mockReauth.mockResolvedValue(undefined)
      ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
      ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
        id: STORE_ID,
        pixKey: 'teste',
        pixKeyType,
      })
      ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

      const res = await request(app)
        .patch('/api/v1/admin/store/pix')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ pixKey: 'teste', pixKeyType, password: 'senha123' })

      expect(res.status).toBe(200)
    }
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/pix')
      .send({ pixKey: 'x', pixKeyType: 'EVP', password: 'senha123' })

    expect(res.status).toBe(401)
  })
})

// ─── PATCH /admin/store/payment-settings ─────────────────────────────────────

describe('PATCH /api/v1/admin/store/payment-settings', () => {
  it('retorna 200 ao desabilitar pagar na entrega', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      allowCashOnDelivery: false,
      allowPickup: false,
      serviceChargePercent: null,
      features: { allowPix: true },
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store/payment-settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ allowCashOnDelivery: false })

    expect(res.status).toBe(200)
    expect(res.body.data.allowCashOnDelivery).toBe(false)
  })

  it('retorna 200 ao habilitar retirada na loja', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.store.update as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      allowCashOnDelivery: true,
      allowPickup: true,
      serviceChargePercent: null,
      features: { allowPix: true },
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .patch('/api/v1/admin/store/payment-settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ allowPickup: true })

    expect(res.status).toBe(200)
    expect(res.body.data.allowPickup).toBe(true)
  })

  it('retorna 400 quando serviceChargePercent é negativo', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/payment-settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ serviceChargePercent: -1 })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando serviceChargePercent excede 100', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/payment-settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ serviceChargePercent: 101 })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/store/payment-settings')
      .send({ allowCashOnDelivery: false })

    expect(res.status).toBe(401)
  })
})
