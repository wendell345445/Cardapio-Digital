// ─── TASK-060/062/065/066/090: Menu Público — Integration Tests ───────────────
// Cobre: GET /menu/:slug, POST /:slug/orders, GET /:slug/pedido/:token,
//        POST /:slug/coupon/validate, POST /:slug/delivery/geocode,
//        POST /:slug/delivery/calculate

jest.mock('../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn() },
    category: { findMany: jest.fn() },
    product: { findUnique: jest.fn() },
    coupon: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    deliveryDistance: { findMany: jest.fn() },
    user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    order: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    customer: { findUnique: jest.fn() },
    // C-027: getPaymentMethodsForClient consulta blacklist por loja
    clientPaymentAccess: { findFirst: jest.fn() },
    table: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../shared/redis/redis', () => ({
  cache: { get: jest.fn(), set: jest.fn(), setMenu: jest.fn(), del: jest.fn() },
}))

jest.mock('../../modules/auth/passport.config', () => ({
  configurePassport: jest.fn(),
}))

jest.mock('../../shared/socket/socket', () => ({
  emit: { orderNew: jest.fn() },
}))

jest.mock('../../jobs/scheduled-orders.job', () => ({
  enqueueScheduledOrderAlert: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../modules/whatsapp/messages.service', () => ({
  sendOrderCreatedMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../modules/menu/pix.service', () => ({
  generatePix: jest.fn().mockResolvedValue({
    qrCodeBase64: 'data:image/png;base64,ABC',
    copyPaste: '00020101...',
  }),
}))

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}))

import request from 'supertest'
import { verify } from 'jsonwebtoken'

import { app } from '../../app'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>
const mockVerify = verify as jest.Mock

process.env.JWT_SECRET = 'test-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
process.env.GOOGLE_GEOCODING_API_KEY = 'test-google-key'

const SLUG = 'pizzaria-do-ze'
const STORE_ID = 'store-1'
const CLIENT_ID = 'client-1'
// Schema Zod exige productId em UUID — usar UUID válido
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111'
const ORDER_ID = 'order-1'

// TASK-122: slug vem do hostname (subdomain routing), não mais da URL.
// Helper encapsula `.set('Host', '<slug>.cardapio.test')` em cada request.
const menuHost = (slug = SLUG) => `${slug}.cardapio.test`

const openAllWeek = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  openTime: '00:00',
  closeTime: '23:59',
  isClosed: false,
}))

const mockStore = {
  id: STORE_ID,
  name: 'Pizzaria do Zé',
  slug: SLUG,
  description: 'As melhores pizzas',
  logo: null,
  address: 'Rua A, 123',
  phone: '5548999990000',
  pixKey: 'pix@pizzaria.com',
  pixKeyType: 'EMAIL',
  allowCashOnDelivery: true,
  allowPickup: true,
  allowDelivery: true,
  manualOpen: null,
  features: { allowPix: true },
  plan: 'PROFESSIONAL',
  status: 'ACTIVE',
  businessHours: openAllWeek,
}

const mockProduct = {
  id: PRODUCT_ID,
  storeId: STORE_ID,
  name: 'Pizza Margherita',
  basePrice: 40.0,
  isActive: true,
  variations: [],
  additionals: [],
}

const mockClient = {
  id: CLIENT_ID,
  whatsapp: '54999990000',
  name: 'João Cliente',
  role: 'CLIENT',
  storeId: STORE_ID,
}

const mockOrder = {
  id: ORDER_ID,
  number: 1,
  storeId: STORE_ID,
  status: 'WAITING_PAYMENT_PROOF',
  total: 40.0,
  items: [],
}

const validOrderBody = {
  clientName: 'João Cliente',
  type: 'DELIVERY',
  paymentMethod: 'PIX',
  address: {
    street: 'Rua B',
    number: '100',
    neighborhood: 'Centro',
    city: 'Joinville',
  },
  items: [{ productId: PRODUCT_ID, quantity: 1, additionalIds: [] }],
}

function setupOrderMocks() {
  ;(mockCache.get as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
  ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
  ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([])
  ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockClient)
  ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(mockPrisma))
  ;(mockPrisma.order.create as jest.Mock).mockResolvedValue(mockOrder)
  ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)
  // Verificação de cliente: simula customer cadastrado para passar a validação
  ;(mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue({
    whatsapp: '54999990000', name: 'Teste', addresses: [],
  })
  // Geocoding (Google): pedidos DELIVERY chamam geocodeAddress no checkout.
  // Mocka fetch retornando lat/lng fictícios — o test de orders não valida o
  // valor da taxa, só que o pedido seja criado.
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      status: 'OK',
      results: [
        {
          formatted_address: 'Mock Address, BR',
          geometry: { location: { lat: -27.0, lng: -48.0 } },
        },
      ],
    }),
  }) as unknown as typeof fetch
}

beforeEach(() => {
  jest.resetAllMocks()
  // publicTenantMiddleware faz prisma.store.findUnique({where:{slug}}) → precisa resolver loja por default
  ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
  // Cache miss por default — tests que precisam de cache hit sobrescrevem
  ;(mockCache.get as jest.Mock).mockResolvedValue(null)
  // Sem promoções ativas por default (getActiveProductPromos + order price lookup)
  ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([])
  ;(mockPrisma.coupon.findFirst as jest.Mock).mockResolvedValue(null)
  // resetAllMocks limpa mockReturnValue do jsonwebtoken mock — re-configura
  ;(require('jsonwebtoken').sign as jest.Mock).mockReturnValue('mock-jwt-token')
  // C-027: blacklist vazia por default; C-022: mesa não encontrada por default
  ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.table.update as jest.Mock).mockResolvedValue({})
  // Verificação de cliente: customer não cadastrado mas tem pedido anterior → passa verificação
  ;(mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ clientName: 'Teste', address: null })
})

// ─── GET /menu/:slug ──────────────────────────────────────────────────────────

describe('GET /api/v1/menu/:slug', () => {
  it('retorna 200 com store + categories (banco)', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockCache.setMenu as jest.Mock).mockResolvedValue(undefined)

    const res = await request(app).get('/api/v1/menu').set('Host', menuHost())

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.store.id).toBe(STORE_ID)
    expect(res.body.data.store.storeStatus).toBe('open') // horário 00:00-23:59
    expect(Array.isArray(res.body.data.categories)).toBe(true)
  })

  it('retorna 200 com dados do cache sem chamar o banco', async () => {
    const cached = { store: { id: STORE_ID, storeStatus: 'open' }, categories: [] }
    ;(mockCache.get as jest.Mock).mockResolvedValue(cached)

    const res = await request(app).get('/api/v1/menu').set('Host', menuHost())

    expect(res.status).toBe(200)
    // O middleware público ainda chama store.findUnique pra resolver o subdomain,
    // mas o serviço menu.getMenu NÃO chama category.findMany quando acha no cache.
    expect(mockPrisma.category.findMany).not.toHaveBeenCalled()
  })

  it('retorna 404 quando slug não existe', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app).get('/api/v1/menu').set('Host', menuHost('nao-existe'))

    expect(res.status).toBe(404)
  })

  it('retorna storeStatus=suspended quando loja está SUSPENDED', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      status: 'SUSPENDED',
    })
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockCache.setMenu as jest.Mock).mockResolvedValue(undefined)

    const res = await request(app).get('/api/v1/menu').set('Host', menuHost())

    expect(res.status).toBe(200)
    expect(res.body.data.store.storeStatus).toBe('suspended')
  })

  it('retorna storeStatus=closed quando manualOpen=false', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: false,
    })
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockCache.setMenu as jest.Mock).mockResolvedValue(undefined)

    const res = await request(app).get('/api/v1/menu').set('Host', menuHost())

    expect(res.status).toBe(200)
    expect(res.body.data.store.storeStatus).toBe('closed')
  })

  it('retorna 404 quando acessado sem subdomain (domínio raiz)', async () => {
    // TASK-122: domínio raiz (cardapio.test) não representa loja → 404
    const res = await request(app).get('/api/v1/menu').set('Host', 'cardapio.test')

    expect(res.status).toBe(404)
  })

  it('não requer autenticação (rota pública)', async () => {
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockCache.setMenu as jest.Mock).mockResolvedValue(undefined)

    const res = await request(app).get('/api/v1/menu').set('Host', menuHost())
    // Sem header Authorization → deve funcionar normalmente
    expect(res.status).toBe(200)
  })
})

// ─── POST /menu/:slug/orders ──────────────────────────────────────────────────

describe('POST /api/v1/menu/:slug/orders', () => {
  it('retorna 201 com orderId, orderNumber, token, total e status (PIX)', async () => {
    setupOrderMocks()

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send(validOrderBody)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      orderId: ORDER_ID,
      orderNumber: 1,
      token: 'mock-jwt-token',
      status: 'WAITING_PAYMENT_PROOF',
    })
  })

  it('retorna 201 com status WAITING_CONFIRMATION quando CASH_ON_DELIVERY', async () => {
    setupOrderMocks()
    ;(mockPrisma.order.create as jest.Mock).mockResolvedValue({
      ...mockOrder,
      status: 'WAITING_CONFIRMATION',
    })

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, paymentMethod: 'CASH_ON_DELIVERY' })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('WAITING_CONFIRMATION')
  })

  it('retorna 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost('loja-inexistente'))
      .send(validOrderBody)

    expect(res.status).toBe(404)
  })

  it('retorna 422 quando loja está fechada (manualOpen=false)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: false,
    })

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send(validOrderBody)

    expect(res.status).toBe(422)
  })

  it('retorna 422 quando loja está SUSPENDED', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      status: 'SUSPENDED',
    })

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send(validOrderBody)

    expect(res.status).toBe(422)
  })

  it('retorna 400 quando items está vazio', async () => {
    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, items: [] })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando clientName não informado (TASK-130 parte 2)', async () => {
    const { clientName: _, ...body } = validOrderBody as any

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send(body)

    expect(res.status).toBe(400)
  })

  it('aceita pedido sem clientWhatsapp (cliente não digita mais — opt-in via WA)', async () => {
    setupOrderMocks()
    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send(validOrderBody) // já não tem clientWhatsapp

    expect(res.status).toBe(201)
    const orderCreateCall = (mockPrisma.order.create as jest.Mock).mock.calls[0][0]
    expect(orderCreateCall.data.clientWhatsapp).toBeUndefined()
  })

  it('retorna 400 quando type é inválido', async () => {
    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, type: 'INVALIDO' })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando paymentMethod é inválido', async () => {
    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, paymentMethod: 'CARTAO' })

    expect(res.status).toBe(400)
  })

  it('retorna 422 quando type=DELIVERY mas address não informado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, address: undefined })

    expect(res.status).toBe(422)
  })

  it('retorna 404 quando produto não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send(validOrderBody)

    expect(res.status).toBe(404)
  })

  it('não requer autenticação (rota pública)', async () => {
    setupOrderMocks()

    // Sem header Authorization
    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send(validOrderBody)

    expect(res.status).toBe(201)
  })

  it('aplica cupom quando couponCode é enviado em lowercase (normaliza para uppercase)', async () => {
    setupOrderMocks()
    // Cupom salvo no banco em uppercase — busca precisa normalizar input lowercase.
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      id: 'coupon-1',
      storeId: STORE_ID,
      code: 'APROVEITE25',
      type: 'PERCENTAGE',
      value: 25,
      isActive: true,
      productId: null,
      expiresAt: null,
      maxUses: null,
      usedCount: 0,
      minOrder: null,
    })

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, couponCode: 'aproveite25' })

    expect(res.status).toBe(201)
    // Confirma que o Prisma foi consultado com o code em uppercase.
    expect(mockPrisma.coupon.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId_code: { storeId: STORE_ID, code: 'APROVEITE25' } },
      })
    )
  })

  it('aceita manualCoordinates e NÃO chama Google Geocoding', async () => {
    setupOrderMocks()
    // Sobrescreve o fetch mockado em setupOrderMocks pra detectar uso indevido:
    // se chamar, o teste falha na asserção abaixo.
    global.fetch = jest.fn() as unknown as typeof fetch

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({
        ...validOrderBody,
        address: {
          ...validOrderBody.address,
          manualCoordinates: { latitude: -16.17, longitude: -42.29 },
        },
      })

    expect(res.status).toBe(201)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejeita manualCoordinates fora do range válido', async () => {
    setupOrderMocks()

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({
        ...validOrderBody,
        address: {
          ...validOrderBody.address,
          manualCoordinates: { latitude: 999, longitude: -42.29 },
        },
      })

    expect(res.status).toBe(400)
  })
})

// ─── GET /menu/:slug/pedido/:token ────────────────────────────────────────────

describe('GET /api/v1/menu/:slug/pedido/:token', () => {
  const mockOrderFull = {
    id: ORDER_ID,
    storeId: STORE_ID,
    number: 1,
    status: 'CONFIRMED',
    total: 40.0,
    items: [],
  }

  it('retorna 200 com dados do pedido quando token válido', async () => {
    mockVerify.mockReturnValue({ orderId: ORDER_ID, storeId: STORE_ID })
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrderFull)

    const res = await request(app)
      .get('/api/v1/menu/pedido/valid-token')
      .set('Host', menuHost())

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(ORDER_ID)
  })

  it('retorna 401 quando token é inválido', async () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid token') })

    const res = await request(app)
      .get('/api/v1/menu/pedido/invalid-token')
      .set('Host', menuHost())

    expect(res.status).toBe(401)
  })

  it('retorna 404 quando pedido não existe (token válido mas pedido removido)', async () => {
    mockVerify.mockReturnValue({ orderId: ORDER_ID, storeId: STORE_ID })
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/menu/pedido/valid-token')
      .set('Host', menuHost())

    expect(res.status).toBe(404)
  })

  it('não requer autenticação (acesso por magic link)', async () => {
    mockVerify.mockReturnValue({ orderId: ORDER_ID, storeId: STORE_ID })
    ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrderFull)

    const res = await request(app)
      .get('/api/v1/menu/pedido/any-token')
      .set('Host', menuHost())

    expect(res.status).toBe(200)
  })
})

// ─── POST /menu/:slug/coupon/validate ─────────────────────────────────────────

describe('POST /api/v1/menu/:slug/coupon/validate', () => {
  const mockCoupon = {
    id: 'coupon-1',
    storeId: STORE_ID,
    code: 'PROMO10',
    type: 'PERCENTAGE',
    value: 10,
    isActive: true,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    minOrder: null,
  }

  it('retorna 200 com discount quando cupom válido', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ id: STORE_ID })
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)

    const res = await request(app)
      .post('/api/v1/menu/coupon/validate')
      .set('Host', menuHost())
      .send({ code: 'PROMO10', subtotal: 100 })

    expect(res.status).toBe(200)
    expect(res.body.data.discount).toBe(10)
    expect(res.body.data.coupon).toBeDefined()
  })

  it('retorna 422 quando cupom inválido', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ id: STORE_ID })
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/menu/coupon/validate')
      .set('Host', menuHost())
      .send({ code: 'INVALIDO' })

    expect(res.status).toBe(422)
  })

  it('retorna 422 quando cupom expirou', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ id: STORE_ID })
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      expiresAt: new Date('2020-01-01'),
    })

    const res = await request(app)
      .post('/api/v1/menu/coupon/validate')
      .set('Host', menuHost())
      .send({ code: 'PROMO10' })

    expect(res.status).toBe(422)
  })

  it('retorna 400 quando code não informado', async () => {
    const res = await request(app)
      .post('/api/v1/menu/coupon/validate')
      .set('Host', menuHost())
      .send({ subtotal: 100 })

    expect(res.status).toBe(400)
  })

  it('retorna 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/menu/coupon/validate')
      .set('Host', menuHost())
      .send({ code: 'PROMO10' })

    expect(res.status).toBe(404)
  })

  it('aceita subtotal negativo como inválido (Zod: nonneg)', async () => {
    const res = await request(app)
      .post('/api/v1/menu/coupon/validate')
      .set('Host', menuHost())
      .send({ code: 'PROMO10', subtotal: -10 })

    expect(res.status).toBe(400)
  })
})

// ─── POST /menu/delivery/calculate ────────────────────────────────────────────
// Agora exige lat/lng do cliente. O frontend resolve o endereço em lat/lng
// primeiro via /menu/delivery/geocode.

describe('POST /api/v1/menu/delivery/calculate', () => {
  it('retorna 200 com fee quando distância dentro de uma faixa', async () => {
    // 1ª chamada: publicTenantMiddleware (resolve slug → store)
    // 2ª chamada: calculateDeliveryFee lookup (lat/lng da loja)
    ;(mockPrisma.store.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockStore)
      .mockResolvedValueOnce({ latitude: -23.5505, longitude: -46.6333 })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', storeId: STORE_ID, minKm: 0, maxKm: 50, fee: 10.0 },
    ])

    const res = await request(app)
      .post('/api/v1/menu/delivery/calculate')
      .set('Host', menuHost())
      .send({ latitude: -23.5505, longitude: -46.6333 })

    expect(res.status).toBe(200)
    expect(res.body.data.fee).toBe(10.0)
  })

  it('retorna 400 quando payload não tem lat/lng (regressão: campo `neighborhood` não aceito)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .post('/api/v1/menu/delivery/calculate')
      .set('Host', menuHost())
      .send({ neighborhood: 'Centro' })

    expect(res.status).toBe(400)
  })

  it('retorna 404 quando loja do subdomain não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/menu/delivery/calculate')
      .set('Host', menuHost('loja-inexistente'))
      .send({ latitude: -23.5, longitude: -46.6 })

    expect(res.status).toBe(404)
  })
})

// ─── POST /menu/delivery/geocode ──────────────────────────────────────────────

describe('POST /api/v1/menu/delivery/geocode', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('retorna 200 com lat/lng a partir do endereço', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Av. Paulista, 1000',
            geometry: { location: { lat: -23.5505, lng: -46.6333 } },
          },
        ],
      }),
    }) as unknown as typeof fetch

    const res = await request(app)
      .post('/api/v1/menu/delivery/geocode')
      .set('Host', menuHost())
      .send({ cep: '01310-100', street: 'Av. Paulista', number: '1000', city: 'São Paulo' })

    expect(res.status).toBe(200)
    expect(res.body.data.latitude).toBe(-23.5505)
    expect(res.body.data.longitude).toBe(-46.6333)
  })

  it('retorna 422 quando endereço insuficiente', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    global.fetch = jest.fn() as unknown as typeof fetch

    const res = await request(app)
      .post('/api/v1/menu/delivery/geocode')
      .set('Host', menuHost())
      .send({})

    expect(res.status).toBe(422)
  })
})

// ─── TASK-130: customerSessionId + flag de notificação ───────────────────────

describe('POST /api/v1/menu/orders — TASK-130', () => {
  it('ignora silenciosamente clientWhatsapp se enviado (Zod strip)', async () => {
    setupOrderMocks()
    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, clientWhatsapp: '11999999999' })

    expect(res.status).toBe(201)
    const orderCreateCall = (mockPrisma.order.create as jest.Mock).mock.calls[0][0]
    expect(orderCreateCall.data.clientWhatsapp).toBeUndefined()
  })

  it('persiste customerSessionId e notifyOnStatusChange=false ao criar', async () => {
    setupOrderMocks()
    const sessionId = '11111111-2222-4333-8444-555566667777'

    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, customerSessionId: sessionId })

    expect(res.status).toBe(201)
    const orderCreateCall = (mockPrisma.order.create as jest.Mock).mock.calls[0][0]
    expect(orderCreateCall.data).toMatchObject({
      customerSessionId: sessionId,
      notifyOnStatusChange: false,
    })
  })

  it('rejeita 400 quando customerSessionId não é UUID', async () => {
    setupOrderMocks()
    const res = await request(app)
      .post('/api/v1/menu/orders')
      .set('Host', menuHost())
      .send({ ...validOrderBody, customerSessionId: 'not-a-uuid' })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/menu/orders/by-session/:sessionId — TASK-130', () => {
  const SESSION_ID = '11111111-2222-4333-8444-555566667777'

  it('retorna lista de pedidos da sessão com token de tracking', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(require('jsonwebtoken').sign as jest.Mock).mockReturnValue('mock-tracking-token')
    ;(mockPrisma.order.findMany as jest.Mock) = jest.fn().mockResolvedValue([
      {
        id: 'order-a',
        number: 1,
        status: 'PREPARING',
        type: 'DELIVERY',
        total: 50,
        paymentMethod: 'PIX',
        notifyOnStatusChange: true,
        createdAt: new Date('2026-04-28T10:00:00Z'),
      },
    ])

    const res = await request(app)
      .get(`/api/v1/menu/orders/by-session/${SESSION_ID}`)
      .set('Host', menuHost())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toMatchObject({
      id: 'order-a',
      number: 1,
      status: 'PREPARING',
      token: 'mock-tracking-token',
    })
    const findManyCall = (mockPrisma.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where).toEqual({ storeId: STORE_ID, customerSessionId: SESSION_ID })
  })

  it('retorna 400 quando sessionId é muito curto', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const res = await request(app)
      .get('/api/v1/menu/orders/by-session/short')
      .set('Host', menuHost())

    expect(res.status).toBe(400)
  })

  it('retorna 200 com lista vazia quando sessão não tem pedidos', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.order.findMany as jest.Mock) = jest.fn().mockResolvedValue([])

    const res = await request(app)
      .get(`/api/v1/menu/orders/by-session/${SESSION_ID}`)
      .set('Host', menuHost())

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})
