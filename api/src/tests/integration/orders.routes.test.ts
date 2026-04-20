// ─── A-046: [Pedidos - Kanban] Detalhes do pedido — Integration Tests ────────
// Cobre: GET /admin/orders/:id retornando itens, cliente, endereço, pagamento, notas

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
  },
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

describe('GET /api/v1/admin/orders/:id — A-046 Detalhes do pedido', () => {
  it('retorna 200 com pedido completo: itens, cliente, endereço, pagamento, notas', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrderFull)

    const res = await request(app)
      .get(`/api/v1/admin/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const order = res.body.data

    // Itens com quantidade, nome, variação, adicionais e obs
    expect(order.items).toHaveLength(2)
    expect(order.items[0]).toMatchObject({
      quantity: 2,
      productName: 'Pizza Margherita',
      notes: 'Bem passada',
      totalPrice: 79.9,
    })
    expect(order.items[0].additionals).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Borda recheada', price: 5.0 })])
    )
    expect(order.items[1]).toMatchObject({
      quantity: 1,
      productName: 'Refrigerante',
      variationName: '2L',
    })

    // Cliente
    expect(order.clientName).toBe('Maria da Silva')
    expect(order.clientWhatsapp).toBe('5548999990001')
    expect(order.client).toMatchObject({ name: 'Maria da Silva', whatsapp: '5548999990001' })

    // Endereço
    expect(order.address).toMatchObject({
      street: 'Rua das Flores',
      number: '123',
      complement: 'Apto 4B',
      neighborhood: 'Centro',
      city: 'Joinville',
    })

    // Pagamento
    expect(order.paymentMethod).toBe('PIX')

    // Notas do pedido
    expect(order.notes).toBe('Sem cebola, por favor')
  })

  it('retorna itens com adicionais vazios e sem notas quando não há', async () => {
    const orderMinimal = {
      ...mockOrderFull,
      notes: null,
      address: null,
      type: 'PICKUP',
      items: [
        {
          id: 'item-3',
          orderId: ORDER_ID,
          productId: 'prod-3',
          variationId: null,
          quantity: 1,
          unitPrice: 15.0,
          totalPrice: 15.0,
          notes: null,
          status: 'PENDING',
          productName: 'Pastel de Carne',
          variationName: null,
          additionals: [],
        },
      ],
    }
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(orderMinimal)

    const res = await request(app)
      .get(`/api/v1/admin/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    const order = res.body.data

    expect(order.items).toHaveLength(1)
    expect(order.items[0].additionals).toEqual([])
    expect(order.items[0].notes).toBeNull()
    expect(order.notes).toBeNull()
    expect(order.address).toBeNull()
  })

  it('retorna 404 quando pedido não existe', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/admin/orders/inexistente')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('retorna 404 quando pedido pertence a outra loja (multi-tenant)', async () => {
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrderFull,
      storeId: 'outra-loja',
    })

    const res = await request(app)
      .get(`/api/v1/admin/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('retorna 401 sem token de autenticação', async () => {
    const res = await request(app).get(`/api/v1/admin/orders/${ORDER_ID}`)

    expect(res.status).toBe(401)
  })
})
