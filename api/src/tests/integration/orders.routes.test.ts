// ─── A-046: [Pedidos - Kanban] Detalhes + Edição de Endereço — Integration Tests

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    store: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    deliveryDistance: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../modules/menu/geocoding.service', () => ({
  geocodeAddress: jest.fn(),
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: { del: jest.fn(), get: jest.fn(), set: jest.fn() },
}))

jest.mock('../../modules/auth/passport.config', () => ({
  configurePassport: jest.fn(),
}))

jest.mock('../../shared/socket/socket', () => ({
  emit: { orderStatus: jest.fn() },
}))

jest.mock('../../modules/whatsapp/messages.service', () => ({
  sendStatusUpdateMessage: jest.fn().mockResolvedValue(undefined),
  sendMotoboyAssignedMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../modules/admin/print.service', () => ({
  autoPrintOrder: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../modules/admin/cashflow.service', () => ({
  linkOrderToCashFlow: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../modules/admin/analytics.service', () => ({
  invalidateAnalyticsCache: jest.fn().mockResolvedValue(undefined),
}))

import request from 'supertest'
import { sign } from 'jsonwebtoken'

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

const STORE_ID = 'store-1'
const ORDER_ID = '11111111-1111-4111-8111-111111111111'

function adminToken(storeId = STORE_ID) {
  return sign({ userId: 'user-1', role: 'ADMIN', storeId }, 'test-secret')
}

const mockOrderFull = {
  id: ORDER_ID,
  number: 42,
  storeId: STORE_ID,
  status: 'CONFIRMED',
  type: 'DELIVERY',
  clientWhatsapp: '5548999990001',
  clientName: 'Maria da Silva',
  paymentMethod: 'PIX',
  subtotal: 89.9,
  deliveryFee: 5.0,
  discount: 0,
  total: 94.9,
  address: {
    street: 'Rua das Flores',
    number: '123',
    complement: 'Apto 4B',
    neighborhood: 'Centro',
    city: 'Joinville',
  },
  notes: 'Sem cebola, por favor',
  tableId: null,
  motoboyId: null,
  couponId: null,
  scheduledFor: null,
  confirmedAt: new Date('2026-04-20T10:05:00Z'),
  preparedAt: null,
  dispatchedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  deliveryIssueReason: null,
  createdAt: new Date('2026-04-20T10:00:00Z'),
  updatedAt: new Date('2026-04-20T10:05:00Z'),
  items: [
    {
      id: 'item-1',
      orderId: ORDER_ID,
      productId: 'prod-1',
      variationId: null,
      quantity: 2,
      unitPrice: 39.95,
      totalPrice: 79.9,
      notes: 'Bem passada',
      status: 'PENDING',
      productName: 'Pizza Margherita',
      variationName: null,
      additionals: [
        { id: 'add-1', orderItemId: 'item-1', name: 'Borda recheada', price: 5.0 },
      ],
    },
    {
      id: 'item-2',
      orderId: ORDER_ID,
      productId: 'prod-2',
      variationId: 'var-1',
      quantity: 1,
      unitPrice: 10.0,
      totalPrice: 10.0,
      notes: null,
      status: 'PENDING',
      productName: 'Refrigerante',
      variationName: '2L',
      additionals: [],
    },
  ],
  motoboy: null,
  client: { id: 'client-1', name: 'Maria da Silva', whatsapp: '5548999990001' },
  coupon: null,
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ status: 'ACTIVE' })
})

// ─── GET /admin/orders/:id ──────────────────────────────────────────────────

describe('GET /api/v1/admin/orders/:id — Detalhes do pedido', () => {
  it('retorna 200 com pedido completo: itens, cliente, endereço, pagamento, notas', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrderFull)

    const res = await request(app)
      .get(`/api/v1/admin/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const order = res.body.data

    // Itens
    expect(order.items).toHaveLength(2)
    expect(order.items[0]).toMatchObject({
      quantity: 2,
      productName: 'Pizza Margherita',
      notes: 'Bem passada',
    })
    expect(order.items[0].additionals).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Borda recheada' })])
    )

    // Cliente
    expect(order.clientName).toBe('Maria da Silva')
    expect(order.client).toMatchObject({ name: 'Maria da Silva' })

    // Endereço
    expect(order.address).toMatchObject({
      street: 'Rua das Flores',
      number: '123',
      neighborhood: 'Centro',
      city: 'Joinville',
    })

    // Pagamento
    expect(order.paymentMethod).toBe('PIX')

    // Notas
    expect(order.notes).toBe('Sem cebola, por favor')
  })

  it('retorna 404 quando pedido não existe', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/orders/inexistente')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('retorna 401 sem token de autenticação', async () => {
    const res = await request(app).get(`/api/v1/admin/orders/${ORDER_ID}`)
    expect(res.status).toBe(401)
  })
})

// ─── PATCH /admin/orders/:id/address ────────────────────────────────────────

const newAddress = {
  zipCode: '89201-100',
  street: 'Rua Nova',
  number: '456',
  complement: 'Casa',
  neighborhood: 'Boa Vista',
  city: 'Joinville',
  state: 'SC',
}

describe('PATCH /api/v1/admin/orders/:id/address — Edição de endereço', () => {
  it('retorna 200, atualiza endereço e recalcula frete por distância (geocode)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrderFull)
    // store.findUnique é chamado 2x (requireActiveStore + calculateDeliveryFee lat/lng)
    ;(mockPrisma.store.findUnique as jest.Mock)
      .mockResolvedValueOnce({ status: 'ACTIVE' })
      .mockResolvedValueOnce({ latitude: -23.5505, longitude: -46.6333 })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', storeId: STORE_ID, minKm: 0, maxKm: 50, fee: 8.0 },
    ])
    const { geocodeAddress } = jest.requireMock('../../modules/menu/geocoding.service')
    ;(geocodeAddress as jest.Mock).mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
    })
    ;(mockPrisma.order.update as jest.Mock).mockResolvedValue({
      ...mockOrderFull,
      address: newAddress,
      deliveryFee: 8.0,
      total: 89.9 + 8.0,
    })

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(newAddress)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.address).toMatchObject({
      street: 'Rua Nova',
      neighborhood: 'Boa Vista',
    })
    expect(res.body.data.deliveryFee).toBe(8.0)
    expect(res.body.data.total).toBe(97.9)

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: expect.objectContaining({
          address: expect.objectContaining({ street: 'Rua Nova' }),
          deliveryFee: 8.0,
        }),
      })
    )
  })

  it('retorna 422 quando pedido não é DELIVERY', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrderFull,
      type: 'PICKUP',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(newAddress)

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
  })

  it('retorna 422 quando pedido já foi despachado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrderFull,
      status: 'DISPATCHED',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(newAddress)

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
  })

  it('retorna 422 quando pedido está entregue', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrderFull,
      status: 'DELIVERED',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(newAddress)

    expect(res.status).toBe(422)
  })

  it('retorna 422 quando pedido está cancelado', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrderFull,
      status: 'CANCELLED',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(newAddress)

    expect(res.status).toBe(422)
  })

  it('retorna 404 quando pedido não existe', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(newAddress)

    expect(res.status).toBe(404)
  })

  it('retorna 400 quando endereço é inválido (rua vazia)', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...newAddress, street: '' })

    expect(res.status).toBe(400)
  })

  it('retorna 401 sem token de autenticação', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/orders/${ORDER_ID}/address`)
      .send(newAddress)

    expect(res.status).toBe(401)
  })
})
