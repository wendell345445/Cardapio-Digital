// ─── Customers Service — Unit Tests ────────────────────────────────────────
// Cobre: getCustomerDetail (merge Order + Customer, fallback para último pedido)
//        upsertCustomer (transação replace-all addresses/phones + validação primary)

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
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
import { getCustomerDetail, upsertCustomer } from '../customers.service'

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
