// ─── TASK-044: QR Code de Mesa e Comanda — Integration Tests ─────────────────

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK'),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('qr-mock')),
}))

jest.mock('pdfkit', () => {
  const EventEmitter = require('events')
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter()
    const doc = Object.assign(emitter, {
      page: { width: 595 },
      y: 100,
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      end: jest.fn().mockImplementation(function (this: typeof emitter) {
        emitter.emit('data', Buffer.from('pdf-content'))
        emitter.emit('end')
      }),
    })
    return doc
  })
})

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    table: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    order: { findFirst: jest.fn(), update: jest.fn() },
    orderItem: { findFirst: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: { del: jest.fn(), get: jest.fn(), set: jest.fn() },
}))

jest.mock('../../shared/socket/socket', () => ({
  emit: { itemStatus: jest.fn(), menuUpdated: jest.fn() },
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
const TABLE_ID = 'table-1'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockTable = {
  id: TABLE_ID,
  storeId: STORE_ID,
  number: 5,
  isOccupied: false,
  createdAt: new Date(),
}

const mockStore = { id: STORE_ID, slug: 'minha-loja' }

const mockOrderItems = [
  { id: 'item-1', totalPrice: 50, additionals: [] },
  { id: 'item-2', totalPrice: 30, additionals: [] },
]

const mockOrder = {
  id: 'order-1',
  storeId: STORE_ID,
  tableId: TABLE_ID,
  status: 'PENDING',
  items: mockOrderItems,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation((input) => {
    if (typeof input === 'function') return input(mockPrisma)
    return Promise.all(input)
  })
})

// ─── GET /admin/tables ────────────────────────────────────────────────────────

describe('GET /api/v1/admin/tables', () => {
  it('returns 200 with table list', async () => {
    ;(mockPrisma.table.findMany as jest.Mock).mockResolvedValue([mockTable])

    const res = await request(app)
      .get('/api/v1/admin/tables')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].number).toBe(5)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/admin/tables')

    expect(res.status).toBe(401)
  })
})

// ─── POST /admin/tables ───────────────────────────────────────────────────────

describe('POST /api/v1/admin/tables', () => {
  it('returns 201 when table is created', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.table.create as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/admin/tables')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ number: 5 })

    expect(res.status).toBe(201)
    expect(res.body.data.number).toBe(5)
  })

  it('returns 422 when table number already exists (mesa com comanda aberta bloqueia nova)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)

    const res = await request(app)
      .post('/api/v1/admin/tables')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ number: 5 })

    expect(res.status).toBe(422)
  })

  it('returns 400 when number is missing or invalid', async () => {
    const res = await request(app)
      .post('/api/v1/admin/tables')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ number: 0 }) // min is 1

    expect(res.status).toBe(400)
  })
})

// ─── GET /admin/tables/:id/qrcode ─────────────────────────────────────────────

describe('GET /api/v1/admin/tables/:id/qrcode', () => {
  it('returns 200 with QR code data URL (QR Code gerado e scanável)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .get(`/api/v1/admin/tables/${TABLE_ID}/qrcode`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.qrDataUrl).toContain('data:image/png')
    expect(res.body.data.url).toContain('mesa=5')
    expect(res.body.data.tableNumber).toBe(5)
  })

  it('returns 404 when table not found', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/tables/nonexistent/qrcode')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── GET /admin/tables/:id/qrcode/pdf ────────────────────────────────────────

describe('GET /api/v1/admin/tables/:id/qrcode/pdf', () => {
  it('returns PDF with 200 (PDF A4 com logo e número da mesa imprimível)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .get(`/api/v1/admin/tables/${TABLE_ID}/qrcode/pdf`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
  })
})

// ─── GET /admin/tables/:id/comanda ────────────────────────────────────────────

describe('GET /api/v1/admin/tables/:id/comanda', () => {
  it('returns 200 with comanda items and subtotal', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)

    const res = await request(app)
      .get(`/api/v1/admin/tables/${TABLE_ID}/comanda`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.subtotal).toBe(80)
    expect(res.body.data.items).toHaveLength(2)
  })

  it('returns empty comanda when table has no open order', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get(`/api/v1/admin/tables/${TABLE_ID}/comanda`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.order).toBeNull()
    expect(res.body.data.items).toHaveLength(0)
  })
})

// ─── POST /admin/tables/:id/close ─────────────────────────────────────────────

describe('POST /api/v1/admin/tables/:id/close', () => {
  it('returns 200 with totals on successful close (comanda encerrada libera a mesa)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
    ;(mockPrisma.table.update as jest.Mock).mockResolvedValue({ ...mockTable, isOccupied: false })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'DELIVERED' })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const res = await request(app)
      .post(`/api/v1/admin/tables/${TABLE_ID}/close`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ applyServiceCharge: true, serviceChargePercent: 10 })

    expect(res.status).toBe(200)
    expect(res.body.data.subtotal).toBe(80)
    expect(res.body.data.serviceCharge).toBe(8)
    expect(res.body.data.total).toBe(88)
    expect(res.body.data.tableNumber).toBe(5)
  })

  it('returns 422 when table has no open comanda', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post(`/api/v1/admin/tables/${TABLE_ID}/close`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ applyServiceCharge: false })

    expect(res.status).toBe(422)
  })

  it('returns 404 when table does not exist', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/admin/tables/nonexistent/close')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ applyServiceCharge: false })

    expect(res.status).toBe(404)
  })
})
