// ─── Customers Service — Unit Tests ────────────────────────────────────────
// Cobre: getCustomerDetail (merge Order + Customer, fallback para último pedido)
//        upsertCustomer (transação replace-all addresses/phones + validação primary)

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customerAddress: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    customerPhone: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: {
    delPattern: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { getCustomerDetail, getCustomerOrders, upsertCustomer } from '../customers.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const STORE_ID = 'store-1'
const WHATSAPP = '5511999990001'

beforeEach(() => {
  jest.clearAllMocks()
  // $transaction executa o callback recebido com o mesmo prisma mockado
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
    return cb(mockPrisma)
  })
})

// ─── getCustomerDetail ─────────────────────────────────────────────────────

describe('getCustomerDetail', () => {
  it('lança 404 quando cliente não tem pedidos nem perfil', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getCustomerDetail(STORE_ID, WHATSAPP)).rejects.toThrow('Cliente não encontrado')
  })

  it('agrega totais dos pedidos (orders, spent, ticket médio)', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        total: 100,
        createdAt: new Date('2026-04-10'),
        clientName: 'Ana',
        address: null,
      },
      {
        total: 60,
        createdAt: new Date('2026-04-01'),
        clientName: 'Ana',
        address: null,
      },
    ])
    ;(mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getCustomerDetail(STORE_ID, WHATSAPP)

    expect(result.totalOrders).toBe(2)
    expect(result.totalSpent).toBe(160)
    expect(result.averageTicket).toBe(80)
    expect(result.firstOrderAt).toEqual(new Date('2026-04-01'))
    expect(result.lastOrderAt).toEqual(new Date('2026-04-10'))
  })

  it('deriva endereço do pedido mais recente quando não há perfil', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        total: 50,
        createdAt: new Date('2026-04-10'),
        clientName: 'Ana',
        address: {
          street: 'Rua Teste',
          number: '123',
          neighborhood: 'Centro',
          city: 'SP',
          state: 'SP',
          zipCode: '01000-000',
        },
      },
    ])
    ;(mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getCustomerDetail(STORE_ID, WHATSAPP)

    expect(result.hasProfile).toBe(false)
    expect(result.addresses).toHaveLength(1)
    expect(result.addresses[0]).toMatchObject({
      street: 'Rua Teste',
      number: '123',
      zipCode: '01000-000',
      isPrimary: true,
    })
  })

  it('usa Customer.name e endereços do perfil quando existe', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        total: 50,
        createdAt: new Date('2026-04-10'),
        clientName: 'Nome Antigo',
        address: { street: 'Rua Velha', number: '1' },
      },
    ])
    ;(mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'cust-1',
      name: 'Ana Editada',
      addresses: [
        {
          id: 'addr-1',
          isPrimary: true,
          zipCode: '01310100',
          street: 'Av. Paulista',
          number: '1000',
          complement: 'Apto 12',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          reference: null,
        },
      ],
      phones: [
        { id: 'ph-1', isPrimary: true, phone: '5511999999999', label: null },
      ],
    })

    const result = await getCustomerDetail(STORE_ID, WHATSAPP)

    expect(result.name).toBe('Ana Editada')
    expect(result.hasProfile).toBe(true)
    expect(result.addresses[0].street).toBe('Av. Paulista')
    expect(result.phones[0].phone).toBe('5511999999999')
  })
})

// ─── upsertCustomer ────────────────────────────────────────────────────────

describe('upsertCustomer', () => {
  const validInput = {
    name: 'Ana Silva',
    primaryPhone: '5511999990001',
    addresses: [
      {
        isPrimary: true,
        zipCode: '01310100',
        street: 'Av. Paulista',
        number: '1000',
        complement: null,
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        reference: null,
      },
    ],
    secondaryPhones: [],
  }

  beforeEach(() => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'cust-1',
      name: 'Ana Silva',
      addresses: [],
      phones: [],
    })
  })

  it('cria Customer quando não existe e grava endereço + telefone principal', async () => {
    ;(mockPrisma.customer.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // dentro da transação
      .mockResolvedValue({
        // chamada final no getCustomerDetail
        id: 'cust-1',
        name: 'Ana Silva',
        addresses: [],
        phones: [],
      })
    ;(mockPrisma.customer.create as jest.Mock).mockResolvedValue({ id: 'cust-1' })

    await upsertCustomer(STORE_ID, WHATSAPP, validInput)

    expect(mockPrisma.customer.create).toHaveBeenCalledWith({
      data: { storeId: STORE_ID, whatsapp: WHATSAPP, name: 'Ana Silva' },
      select: { id: true },
    })
    expect(mockPrisma.customerAddress.createMany).toHaveBeenCalled()
    expect(mockPrisma.customerPhone.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ phone: '5511999990001', isPrimary: true }),
      ]),
    })
  })

  it('atualiza Customer existente (delete + recreate addresses/phones)', async () => {
    await upsertCustomer(STORE_ID, WHATSAPP, validInput)

    expect(mockPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { name: 'Ana Silva' },
    })
    expect(mockPrisma.customerAddress.deleteMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1' },
    })
    expect(mockPrisma.customerPhone.deleteMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1' },
    })
  })

  it('rejeita quando nenhum endereço é principal', async () => {
    const input = {
      ...validInput,
      addresses: [
        { ...validInput.addresses[0], isPrimary: false },
        { ...validInput.addresses[0], isPrimary: false },
      ],
    }

    await expect(upsertCustomer(STORE_ID, WHATSAPP, input)).rejects.toThrow(
      'Exatamente 1 endereço deve ser marcado como principal'
    )
  })

  it('rejeita quando mais de um endereço é principal', async () => {
    const input = {
      ...validInput,
      addresses: [
        { ...validInput.addresses[0], isPrimary: true },
        { ...validInput.addresses[0], isPrimary: true },
      ],
    }

    await expect(upsertCustomer(STORE_ID, WHATSAPP, input)).rejects.toThrow(
      'Exatamente 1 endereço deve ser marcado como principal'
    )
  })

  it('grava telefones secundários quando fornecidos', async () => {
    await upsertCustomer(STORE_ID, WHATSAPP, {
      ...validInput,
      secondaryPhones: [{ phone: '5511888887777', label: 'Trabalho' }],
    })

    const call = (mockPrisma.customerPhone.createMany as jest.Mock).mock.calls[0][0]
    expect(call.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isPrimary: true, phone: '5511999990001' }),
        expect.objectContaining({ isPrimary: false, phone: '5511888887777', label: 'Trabalho' }),
      ])
    )
  })
})

// ─── getCustomerOrders ────────────────────────────────────────────────────

describe('getCustomerOrders', () => {
  const mockItems1 = [
    { productName: 'Pizza Margherita', variationName: null, quantity: 2, unitPrice: 35, totalPrice: 70 },
    { productName: 'Coca-Cola', variationName: '600ml', quantity: 1, unitPrice: 10, totalPrice: 10 },
  ]
  const mockItems2 = [
    { productName: 'Hambúrguer', variationName: 'Duplo', quantity: 1, unitPrice: 45, totalPrice: 45 },
  ]
  const mockOrders = [
    {
      id: 'order-1',
      number: 42,
      type: 'DELIVERY',
      status: 'DELIVERED',
      paymentMethod: 'PIX',
      subtotal: 80,
      deliveryFee: 10,
      discount: 0,
      total: 90,
      createdAt: new Date('2026-04-15'),
      items: mockItems1,
    },
    {
      id: 'order-2',
      number: 38,
      type: 'PICKUP',
      status: 'CONFIRMED',
      paymentMethod: 'CREDIT_ON_DELIVERY',
      subtotal: 50,
      deliveryFee: 0,
      discount: 5,
      total: 45,
      createdAt: new Date('2026-04-10'),
      items: mockItems2,
    },
  ]

  it('retorna pedidos paginados com total e totalPages', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders)
    ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(15)

    const result = await getCustomerOrders(STORE_ID, WHATSAPP, 1, 10)

    expect(result.orders).toHaveLength(2)
    expect(result.total).toBe(15)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(10)
    expect(result.totalPages).toBe(2)
  })

  it('mapeia campos corretamente incluindo items', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([mockOrders[0]])
    ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(1)

    const result = await getCustomerOrders(STORE_ID, WHATSAPP)

    const order = result.orders[0]
    expect(order.id).toBe('order-1')
    expect(order.number).toBe(42)
    expect(order.type).toBe('DELIVERY')
    expect(order.status).toBe('DELIVERED')
    expect(order.total).toBe(90)
    expect(order.items).toHaveLength(2)
    expect(order.items[0]).toEqual({
      productName: 'Pizza Margherita',
      variationName: null,
      quantity: 2,
      unitPrice: 35,
      totalPrice: 70,
    })
    expect(order.items[1].variationName).toBe('600ml')
  })

  it('filtra por storeId e clientWhatsapp', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(0)

    await getCustomerOrders(STORE_ID, WHATSAPP, 2, 5)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID, clientWhatsapp: WHATSAPP },
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
      })
    )
    expect(mockPrisma.order.count).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, clientWhatsapp: WHATSAPP },
    })
  })

  it('retorna lista vazia quando cliente não tem pedidos', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(0)

    const result = await getCustomerOrders(STORE_ID, WHATSAPP)

    expect(result.orders).toEqual([])
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
  })

  it('usa defaults page=1 e limit=10 quando não informados', async () => {
    ;(mockPrisma.order.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(0)

    await getCustomerOrders(STORE_ID, WHATSAPP)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    )
  })
})
