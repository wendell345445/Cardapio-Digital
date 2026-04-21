// ─── TASK-065: Criação de Pedidos Públicos — Unit Tests ───────────────────────
// Cobre: validações de loja aberta, produtos, cupom, taxa de entrega, totais

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    coupon: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    deliveryDistance: { findMany: jest.fn() },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    // C-027: getPaymentMethodsForClient consulta blacklist
    clientPaymentAccess: { findFirst: jest.fn() },
    table: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../geocoding.service', () => ({
  geocodeAddress: jest.fn(),
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: { del: jest.fn() },
}))

jest.mock('../../../shared/socket/socket', () => ({
  emit: { orderNew: jest.fn() },
}))

jest.mock('../../../jobs/scheduled-orders.job', () => ({
  enqueueScheduledOrderAlert: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../whatsapp/messages.service', () => ({
  sendOrderCreatedMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../pix.service', () => ({
  generatePix: jest.fn().mockResolvedValue({
    qrCodeBase64: 'data:image/png;base64,ABC',
    copyPaste: '00020101...',
  }),
}))

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
}))

import { prisma } from '../../../shared/prisma/prisma'
import { createOrder } from '../orders.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const SLUG = 'pizzaria-do-ze'
const STORE_ID = 'store-1'
const CLIENT_ID = 'client-1'
const PRODUCT_ID = 'product-1'
const VARIATION_ID = 'variation-1'
const ADDITIONAL_ID = 'additional-1'

// Horário aberto durante toda a semana
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
  phone: '5548999990000',
  pixKey: 'pix@pizzaria.com',
  pixKeyType: 'EMAIL',
  allowCashOnDelivery: true,
  allowPickup: true,
  allowDelivery: true,
  status: 'ACTIVE',
  manualOpen: null,
  businessHours: openAllWeek,
  features: { allowPix: true },
  address: 'Rua A, 123',
}

const mockProduct = {
  id: PRODUCT_ID,
  storeId: STORE_ID,
  name: 'Pizza Margherita',
  basePrice: 40.0,
  isActive: true,
  variations: [
    { id: VARIATION_ID, name: 'Grande', price: 50.0, isActive: true },
  ],
  additionals: [
    { id: ADDITIONAL_ID, name: 'Borda Recheada', price: 8.0, isActive: true },
  ],
}

const mockClient = {
  id: CLIENT_ID,
  whatsapp: '54999990000',
  name: 'João Cliente',
  role: 'CLIENT',
  storeId: STORE_ID,
}

const mockOrder = {
  id: 'order-1',
  number: 1,
  storeId: STORE_ID,
  status: 'WAITING_PAYMENT_PROOF',
  total: 58.0,
  items: [],
}

const baseOrderInput = {
  clientWhatsapp: '54999990000',
  clientName: 'João Cliente',
  type: 'DELIVERY' as const,
  paymentMethod: 'PIX' as const,
  address: {
    street: 'Rua B',
    number: '100',
    complement: undefined,
    neighborhood: 'Centro',
    city: 'Joinville',
  },
  items: [{ productId: PRODUCT_ID, variationId: undefined, quantity: 1, notes: undefined, additionalIds: [] }],
  couponCode: undefined,
  scheduledFor: undefined,
  notes: undefined,
  tableId: undefined,
}

function setupDefaultMocks() {
  ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
  ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
  ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([])
  const { geocodeAddress } = jest.requireMock('../geocoding.service')
  ;(geocodeAddress as jest.Mock).mockResolvedValue({
    latitude: -23.5505,
    longitude: -46.6333,
  })
  ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockClient)
  ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null) // sem pedidos anteriores
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(mockPrisma))
  ;(mockPrisma.order.create as jest.Mock).mockResolvedValue(mockOrder)
  ;(mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)
  // C-027: blacklist vazia por default
  ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)
  ;(mockPrisma.table.update as jest.Mock).mockResolvedValue({})
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  // Default: sem promo ativa no produto (coupon.findFirst consultado em createOrder)
  ;(mockPrisma.coupon.findFirst as jest.Mock).mockResolvedValue(null)
})

afterEach(() => {
  jest.useRealTimers()
})

// ─── Loja fechada / suspensa ──────────────────────────────────────────────────

describe('createOrder — validação de loja aberta', () => {
  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando loja está SUSPENDED', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      status: 'SUSPENDED',
    })

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando loja está fechada (manualOpen=false)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: false,
    })

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({ status: 422 })
  })

  it('permite pedido agendado mesmo com loja fechada', async () => {
    setupDefaultMocks()
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: false,
    })

    const futureDate = new Date(Date.now() + 60 * 60 * 1000) // 1h no futuro
    const input = { ...baseOrderInput, scheduledFor: futureDate }

    await expect(createOrder(SLUG, input)).resolves.toBeDefined()
  })
})

// ─── Agendamento ──────────────────────────────────────────────────────────────

describe('createOrder — agendamento (TASK-092)', () => {
  it('lança 422 quando scheduledFor tem menos de 30min de antecedência', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const tooSoon = new Date(Date.now() + 15 * 60 * 1000) // só 15min
    const input = { ...baseOrderInput, scheduledFor: tooSoon }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })

  it('aceita scheduledFor com 31 minutos de antecedência', async () => {
    setupDefaultMocks()

    const validFuture = new Date(Date.now() + 31 * 60 * 1000)
    const input = { ...baseOrderInput, scheduledFor: validFuture }

    await expect(createOrder(SLUG, input)).resolves.toBeDefined()
  })
})

// ─── Tipo de entrega ──────────────────────────────────────────────────────────

describe('createOrder — tipo de entrega', () => {
  it('lança 422 quando type=DELIVERY mas address não foi informado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)

    const input = { ...baseOrderInput, address: undefined }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando DELIVERY + CASH_ON_DELIVERY e loja não permite pagar na entrega', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowCashOnDelivery: false,
    })

    const input = { ...baseOrderInput, paymentMethod: 'CASH_ON_DELIVERY' as const }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando DELIVERY mas loja não aceita entregas (A-032)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowDelivery: false,
    })

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({
      status: 422,
    })
  })

  it('lança 422 quando PICKUP mas loja não permite retirada', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowPickup: false,
    })

    const input = { ...baseOrderInput, type: 'PICKUP' as const, address: undefined }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })
})

// ─── Validação de produtos ────────────────────────────────────────────────────

describe('createOrder — validação de produtos', () => {
  it('lança 404 quando produto não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando produto pertence a outra loja', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({
      ...mockProduct,
      storeId: 'outra-loja',
    })

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({ status: 404 })
  })

  it('lança 422 quando produto está inativo', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({
      ...mockProduct,
      isActive: false,
    })

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 404 quando variação não existe ou está inativa', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({
      ...mockProduct,
      variations: [{ id: VARIATION_ID, name: 'Grande', price: 50, isActive: false }],
    })

    const input = {
      ...baseOrderInput,
      items: [{ ...baseOrderInput.items[0], variationId: VARIATION_ID }],
    }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando adicional não existe no produto', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({
      ...mockProduct,
      additionals: [], // sem adicionais
    })

    const input = {
      ...baseOrderInput,
      items: [{ ...baseOrderInput.items[0], additionalIds: ['adicional-inexistente'] }],
    }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── Cálculo de total ─────────────────────────────────────────────────────────

describe('createOrder — cálculo de total', () => {
  it('calcula subtotal corretamente: basePrice × qty', async () => {
    setupDefaultMocks()

    await createOrder(SLUG, baseOrderInput)

    // mockOrder.total = 58 (definido no mock), mas verificamos que foi criado
    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 40.0, // basePrice sem variação, sem adicional, qty=1
        }),
      })
    )
  })

  it('usa preço da variação quando variationId é informado', async () => {
    setupDefaultMocks()

    const input = {
      ...baseOrderInput,
      items: [{ ...baseOrderInput.items[0], variationId: VARIATION_ID }],
    }

    await createOrder(SLUG, input)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 50.0, // preço da variação Grande
        }),
      })
    )
  })

  it('soma adicionais ao total do item', async () => {
    setupDefaultMocks()

    const input = {
      ...baseOrderInput,
      items: [{ ...baseOrderInput.items[0], additionalIds: [ADDITIONAL_ID] }],
    }

    await createOrder(SLUG, input)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 48.0, // 40 (base) + 8 (adicional) × 1
        }),
      })
    )
  })

  it('multiplica pelo quantity corretamente', async () => {
    setupDefaultMocks()

    const input = {
      ...baseOrderInput,
      items: [{ ...baseOrderInput.items[0], quantity: 3 }],
    }

    await createOrder(SLUG, input)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 120.0, // 40 × 3
        }),
      })
    )
  })
})

// ─── Cupom ────────────────────────────────────────────────────────────────────

describe('createOrder — cupom', () => {
  const mockCouponPercentage = {
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

  it('aplica desconto percentual corretamente', async () => {
    setupDefaultMocks()
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCouponPercentage)
    ;(mockPrisma.coupon.update as jest.Mock).mockResolvedValue(mockCouponPercentage)

    const input = { ...baseOrderInput, couponCode: 'PROMO10' }

    await createOrder(SLUG, input)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discount: 4.0, // 10% de 40
          total: 36.0,   // 40 - 4
        }),
      })
    )
  })

  it('aplica desconto fixo corretamente', async () => {
    setupDefaultMocks()
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCouponPercentage,
      type: 'FIXED',
      value: 10,
    })
    ;(mockPrisma.coupon.update as jest.Mock).mockResolvedValue({})

    const input = { ...baseOrderInput, couponCode: 'DESCONTO10' }

    await createOrder(SLUG, input)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discount: 10.0,
          total: 30.0, // 40 - 10
        }),
      })
    )
  })

  it('lança 422 quando cupom não existe ou está inativo', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    const input = { ...baseOrderInput, couponCode: 'INVALIDO' }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando cupom expirou', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCouponPercentage,
      expiresAt: new Date('2020-01-01'),
    })

    const input = { ...baseOrderInput, couponCode: 'PROMO10' }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando cupom atingiu o limite de usos', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCouponPercentage,
      maxUses: 5,
      usedCount: 5,
    })

    const input = { ...baseOrderInput, couponCode: 'PROMO10' }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando subtotal é menor que o pedido mínimo do cupom', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct)
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCouponPercentage,
      minOrder: 100,
    })

    const input = { ...baseOrderInput, couponCode: 'PROMO10' }

    await expect(createOrder(SLUG, input)).rejects.toMatchObject({ status: 422 })
  })

  it('incrementa usedCount do cupom na transação', async () => {
    setupDefaultMocks()
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCouponPercentage)
    const mockUpdate = jest.fn().mockResolvedValue({})
    ;(mockPrisma.coupon as any).update = mockUpdate

    const input = { ...baseOrderInput, couponCode: 'PROMO10' }

    await createOrder(SLUG, input)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      })
    )
  })
})

// ─── Taxa de entrega (por distância) ──────────────────────────────────────────

describe('createOrder — taxa de entrega por distância', () => {
  function mockStoreWithCoords() {
    // store.findUnique é usado várias vezes. setupDefaultMocks já cobre o 1º uso (loja abre).
    // Pro calculateDeliveryFee, o service chama novamente e precisa de lat/lng.
    ;(mockPrisma.store.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockStore)
      .mockResolvedValueOnce({ latitude: -23.55, longitude: -46.63 })
  }

  it('aplica fee baseado na faixa de distância que contém a distância calculada', async () => {
    setupDefaultMocks()
    mockStoreWithCoords()
    const { geocodeAddress } = jest.requireMock('../geocoding.service')
    ;(geocodeAddress as jest.Mock).mockResolvedValue({ latitude: -23.55, longitude: -46.63 })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', storeId: STORE_ID, minKm: 0, maxKm: 50, fee: 5.0 },
    ])

    await createOrder(SLUG, baseOrderInput)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryFee: 5.0,
          total: 45.0,
        }),
      })
    )
  })

  it('lança 422 quando cliente fica fora de todas as faixas', async () => {
    setupDefaultMocks()
    mockStoreWithCoords()
    const { geocodeAddress } = jest.requireMock('../geocoding.service')
    ;(geocodeAddress as jest.Mock).mockResolvedValue({ latitude: -22.9, longitude: -43.1 })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', storeId: STORE_ID, minKm: 0, maxKm: 5, fee: 5.0 },
    ])

    await expect(createOrder(SLUG, baseOrderInput)).rejects.toMatchObject({ status: 422 })
  })

  it('aplica taxa zero quando loja não tem faixas configuradas', async () => {
    setupDefaultMocks()
    mockStoreWithCoords()
    const { geocodeAddress } = jest.requireMock('../geocoding.service')
    ;(geocodeAddress as jest.Mock).mockResolvedValue({ latitude: -23.55, longitude: -46.63 })
    ;(mockPrisma.deliveryDistance.findMany as jest.Mock).mockResolvedValue([])

    await createOrder(SLUG, baseOrderInput)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryFee: 0 }),
      })
    )
  })

  it('não geocodifica nem calcula entrega em pedidos PICKUP', async () => {
    setupDefaultMocks()
    const { geocodeAddress } = jest.requireMock('../geocoding.service')
    ;(geocodeAddress as jest.Mock).mockClear()

    const pickupInput = {
      ...baseOrderInput,
      type: 'PICKUP' as const,
      address: undefined,
    }

    await createOrder(SLUG, pickupInput)

    expect(geocodeAddress).not.toHaveBeenCalled()
    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryFee: 0 }),
      })
    )
  })
})

// ─── Status baseado no método de pagamento ────────────────────────────────────

describe('createOrder — status por método de pagamento', () => {
  it('cria pedido com status WAITING_PAYMENT_PROOF quando PIX', async () => {
    setupDefaultMocks()

    await createOrder(SLUG, { ...baseOrderInput, paymentMethod: 'PIX' })

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WAITING_PAYMENT_PROOF' }),
      })
    )
  })

  it('cria pedido com status WAITING_CONFIRMATION quando CASH_ON_DELIVERY', async () => {
    setupDefaultMocks()

    await createOrder(SLUG, { ...baseOrderInput, paymentMethod: 'CASH_ON_DELIVERY' })

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WAITING_CONFIRMATION' }),
      })
    )
  })
})

// ─── Cliente — criar ou encontrar ─────────────────────────────────────────────

describe('createOrder — cliente', () => {
  it('reutiliza cliente existente por WhatsApp', async () => {
    setupDefaultMocks()
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(mockClient)

    await createOrder(SLUG, baseOrderInput)

    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('cria novo cliente quando WhatsApp não cadastrado', async () => {
    setupDefaultMocks()
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue(mockClient)

    await createOrder(SLUG, baseOrderInput)

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          whatsapp: baseOrderInput.clientWhatsapp,
          role: 'CLIENT',
          storeId: STORE_ID,
        }),
      })
    )
  })

  it('atualiza nome do cliente quando cliente existe sem nome', async () => {
    setupDefaultMocks()
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ ...mockClient, name: null })
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(mockClient)

    await createOrder(SLUG, baseOrderInput)

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: baseOrderInput.clientName },
      })
    )
  })
})

// ─── Número sequencial do pedido ──────────────────────────────────────────────

describe('createOrder — número sequencial por loja', () => {
  it('número do pedido é lastOrder.number + 1', async () => {
    setupDefaultMocks()
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ number: 42 })

    await createOrder(SLUG, baseOrderInput)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 43 }),
      })
    )
  })

  it('número do primeiro pedido da loja é 1', async () => {
    setupDefaultMocks()
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)

    await createOrder(SLUG, baseOrderInput)

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 1 }),
      })
    )
  })
})

// ─── Retorno e side-effects ───────────────────────────────────────────────────

describe('createOrder — retorno e side-effects', () => {
  it('retorna orderId, orderNumber, token, total e status', async () => {
    setupDefaultMocks()

    const result = await createOrder(SLUG, baseOrderInput)

    expect(result).toMatchObject({
      orderId: expect.any(String),
      orderNumber: expect.any(Number),
      token: 'mock-jwt-token',
      total: expect.any(Number),
      status: expect.any(String),
    })
  })

  it('retorna pixKey e pixKeyType quando pagamento é PIX', async () => {
    setupDefaultMocks()

    const result = await createOrder(SLUG, { ...baseOrderInput, paymentMethod: 'PIX' })

    expect(result.pixKey).toBe(mockStore.pixKey)
    expect(result.pixKeyType).toBe(mockStore.pixKeyType)
  })

  it('não retorna pixKey quando pagamento é CASH_ON_DELIVERY', async () => {
    setupDefaultMocks()

    const result = await createOrder(SLUG, { ...baseOrderInput, paymentMethod: 'CASH_ON_DELIVERY' })

    expect(result.pixKey).toBeUndefined()
    expect(result.pixKeyType).toBeUndefined()
  })

  it('invalida cache do menu após criar pedido', async () => {
    const { cache } = await import('../../../shared/redis/redis')
    setupDefaultMocks()

    await createOrder(SLUG, baseOrderInput)

    expect(cache.del).toHaveBeenCalledWith(`menu:${STORE_ID}`)
  })

  it('emite socket.io order:new para o admin', async () => {
    const { emit } = await import('../../../shared/socket/socket')
    setupDefaultMocks()

    await createOrder(SLUG, baseOrderInput)

    expect(emit.orderNew).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ id: 'order-1' }))
  })
})

// ─── C-002/C-022: Mesa via QR code ────────────────────────────────────────────

describe('createOrder — mesa via QR code (C-002/C-022)', () => {
  it('lança 422 quando type=TABLE e nem tableId nem tableNumber são informados', async () => {
    setupDefaultMocks()

    await expect(
      createOrder(SLUG, { ...baseOrderInput, type: 'TABLE' as const })
    ).rejects.toMatchObject({ status: 422 })
  })

  it('lança 404 quando tableNumber não existe na loja', async () => {
    setupDefaultMocks()
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      createOrder(SLUG, { ...baseOrderInput, type: 'TABLE' as const, tableNumber: 99 })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('resolve tableNumber → tableId, cria pedido e marca mesa como ocupada', async () => {
    setupDefaultMocks()
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue({
      id: 'table-uuid-1',
      storeId: STORE_ID,
      number: 5,
      isOccupied: false,
    })

    await createOrder(SLUG, { ...baseOrderInput, type: 'TABLE' as const, tableNumber: 5 })

    expect(mockPrisma.table.findUnique).toHaveBeenCalledWith({
      where: { storeId_number: { storeId: STORE_ID, number: 5 } },
    })
    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tableId: 'table-uuid-1', type: 'TABLE' }),
      })
    )
    expect(mockPrisma.table.update).toHaveBeenCalledWith({
      where: { id: 'table-uuid-1' },
      data: { isOccupied: true },
    })
  })
})

// ─── C-027: Blacklist bloqueia "Pagar na entrega" ────────────────────────────

describe('createOrder — blacklist (C-027)', () => {
  it('lança 422 quando cliente está na blacklist e tenta pagar com CASH_ON_DELIVERY', async () => {
    setupDefaultMocks()
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue({
      id: 'access-1',
      type: 'BLACKLIST',
      storeId: STORE_ID,
      clientId: CLIENT_ID,
    })

    await expect(
      createOrder(SLUG, { ...baseOrderInput, paymentMethod: 'CASH_ON_DELIVERY' as const })
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.order.create).not.toHaveBeenCalled()
  })

  it.each([
    'CREDIT_ON_DELIVERY' as const,
    'DEBIT_ON_DELIVERY' as const,
    'PIX_ON_DELIVERY' as const,
  ])('lança 422 quando cliente está na blacklist e tenta pagar com %s', async (method) => {
    setupDefaultMocks()
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue({
      id: 'access-1',
      type: 'BLACKLIST',
      storeId: STORE_ID,
      clientId: CLIENT_ID,
    })

    await expect(
      createOrder(SLUG, { ...baseOrderInput, paymentMethod: method })
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.order.create).not.toHaveBeenCalled()
  })

  it('permite CASH_ON_DELIVERY quando cliente não está em blacklist', async () => {
    setupDefaultMocks() // clientPaymentAccess.findFirst → null por default

    await createOrder(SLUG, { ...baseOrderInput, paymentMethod: 'CASH_ON_DELIVERY' as const })

    expect(mockPrisma.order.create).toHaveBeenCalled()
  })
})
