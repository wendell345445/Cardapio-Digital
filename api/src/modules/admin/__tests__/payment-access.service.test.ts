// ─── TASK-054: Blacklist e Whitelist de Clientes — Unit Tests ─────────────────

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    order: { findFirst: jest.fn() },
    store: { findUnique: jest.fn() },
    clientPaymentAccess: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  listStoreClients,
  addPaymentAccess,
  removePaymentAccess,
  getPaymentMethodsForClient,
} from '../payment-access.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const STORE_ID = 'store-1'
const USER_ID = 'admin-1'
const CLIENT_ID = 'client-1'
const IP = '127.0.0.1'

const mockStore = {
  id: STORE_ID,
  allowCashOnDelivery: true,
  allowPickup: false,
  features: { allowPix: true },
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

// ─── listStoreClients ─────────────────────────────────────────────────────────

describe('listStoreClients', () => {
  it('lista clientes que fizeram pedido na loja com accessType atual', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: CLIENT_ID,
        name: 'João Cliente',
        email: 'joao@email.com',
        whatsapp: '5548999990002',
        clientAccessLists: [{ id: 'access-1', type: 'BLACKLIST' }],
      },
    ])

    const result = await listStoreClients(STORE_ID)

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'CLIENT' }),
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].accessType).toBe('BLACKLIST')
    expect(result[0].accessId).toBe('access-1')
  })

  it('retorna accessType=null para clientes sem entrada na lista', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: CLIENT_ID,
        name: 'Maria',
        email: null,
        whatsapp: '5548999990003',
        clientAccessLists: [],
      },
    ])

    const result = await listStoreClients(STORE_ID)

    expect(result[0].accessType).toBeNull()
    expect(result[0].accessId).toBeNull()
  })

  it('retorna lista vazia quando nenhum cliente fez pedido na loja', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([])

    const result = await listStoreClients(STORE_ID)

    expect(result).toHaveLength(0)
  })
})

// ─── addPaymentAccess ─────────────────────────────────────────────────────────

describe('addPaymentAccess', () => {
  const mockAccess = { id: 'access-1', storeId: STORE_ID, clientId: CLIENT_ID, type: 'BLACKLIST' as const }

  it('adiciona cliente à BLACKLIST com AuditLog', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockClient)
    ;(mockPrisma.clientPaymentAccess.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.clientPaymentAccess.create as jest.Mock).mockResolvedValue(mockAccess)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await addPaymentAccess(
      STORE_ID,
      { clientId: CLIENT_ID, type: 'BLACKLIST' },
      USER_ID,
      IP
    )

    expect(result.type).toBe('BLACKLIST')
    expect(mockPrisma.clientPaymentAccess.deleteMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, clientId: CLIENT_ID },
    })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'store.payment-access.add',
          entity: 'ClientPaymentAccess',
        }),
      })
    )
  })

  it('adiciona cliente à WHITELIST', async () => {
    const whitelistAccess = { ...mockAccess, type: 'WHITELIST' as const }
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockClient)
    ;(mockPrisma.clientPaymentAccess.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.clientPaymentAccess.create as jest.Mock).mockResolvedValue(whitelistAccess)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await addPaymentAccess(
      STORE_ID,
      { clientId: CLIENT_ID, type: 'WHITELIST' },
      USER_ID
    )

    expect(result.type).toBe('WHITELIST')
  })

  it('lança 422 quando cliente não tem histórico na loja', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      addPaymentAccess(STORE_ID, { clientId: CLIENT_ID, type: 'BLACKLIST' }, USER_ID)
    ).rejects.toMatchObject({ status: 422 })

    expect(mockPrisma.clientPaymentAccess.create).not.toHaveBeenCalled()
  })

  it('lança 404 quando cliente não existe ou não tem role CLIENT', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      addPaymentAccess(STORE_ID, { clientId: CLIENT_ID, type: 'BLACKLIST' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando usuário existe mas não tem role CLIENT', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockClient, role: 'ADMIN' })

    await expect(
      addPaymentAccess(STORE_ID, { clientId: CLIENT_ID, type: 'BLACKLIST' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('remove entrada anterior antes de criar nova (garante unicidade de tipo)', async () => {
    ;(mockPrisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockClient)
    ;(mockPrisma.clientPaymentAccess.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.clientPaymentAccess.create as jest.Mock).mockResolvedValue(mockAccess)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await addPaymentAccess(STORE_ID, { clientId: CLIENT_ID, type: 'BLACKLIST' }, USER_ID)

    expect(mockPrisma.clientPaymentAccess.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.clientPaymentAccess.create).toHaveBeenCalled()
  })
})

// ─── removePaymentAccess ──────────────────────────────────────────────────────

describe('removePaymentAccess', () => {
  const mockAccess = { id: 'access-1', storeId: STORE_ID, clientId: CLIENT_ID, type: 'BLACKLIST' as const }

  it('remove cliente da lista e registra AuditLog', async () => {
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(mockAccess)
    ;(mockPrisma.clientPaymentAccess.delete as jest.Mock).mockResolvedValue(mockAccess)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await removePaymentAccess(STORE_ID, CLIENT_ID, USER_ID, IP)

    expect(mockPrisma.clientPaymentAccess.delete).toHaveBeenCalledWith({
      where: { id: 'access-1' },
    })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'store.payment-access.remove' }),
      })
    )
  })

  it('lança 404 quando entrada não existe', async () => {
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      removePaymentAccess(STORE_ID, CLIENT_ID, USER_ID)
    ).rejects.toMatchObject({ status: 404 })

    expect(mockPrisma.clientPaymentAccess.delete).not.toHaveBeenCalled()
  })
})

// ─── getPaymentMethodsForClient ───────────────────────────────────────────────

describe('getPaymentMethodsForClient', () => {
  it('cliente sem restrição vê pagar na entrega quando allowCashOnDelivery=true', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getPaymentMethodsForClient(CLIENT_ID, STORE_ID)

    expect(result.cashOnDelivery).toBe(true)
    expect(result.pix).toBe(true)
    expect(result.pickup).toBe(false)
  })

  it('cliente BLACKLISTED não vê pagar na entrega mesmo com allowCashOnDelivery=true', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowCashOnDelivery: true,
    })
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue({
      id: 'access-1',
      type: 'BLACKLIST',
    })

    const result = await getPaymentMethodsForClient(CLIENT_ID, STORE_ID)

    expect(result.cashOnDelivery).toBe(false)
    expect(result.pix).toBe(true)
  })

  it('cliente WHITELISTED vê pagar na entrega mesmo com allowCashOnDelivery=false', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowCashOnDelivery: false,
    })
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue({
      id: 'access-1',
      type: 'WHITELIST',
    })

    const result = await getPaymentMethodsForClient(CLIENT_ID, STORE_ID)

    expect(result.cashOnDelivery).toBe(true)
  })

  it('cliente sem histórico (não na whitelist) não vê pagar na entrega quando allowCashOnDelivery=false', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowCashOnDelivery: false,
    })
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getPaymentMethodsForClient(CLIENT_ID, STORE_ID)

    expect(result.cashOnDelivery).toBe(false)
  })

  it('cliente desconhecido (null) não vê pagar na entrega quando allowCashOnDelivery=false', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowCashOnDelivery: false,
    })

    const result = await getPaymentMethodsForClient(null, STORE_ID)

    expect(result.cashOnDelivery).toBe(false)
    expect(mockPrisma.clientPaymentAccess.findFirst).not.toHaveBeenCalled()
  })

  it('cliente desconhecido (null) vê pagar na entrega quando allowCashOnDelivery=true', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowCashOnDelivery: true,
    })
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getPaymentMethodsForClient(null, STORE_ID)

    expect(result.cashOnDelivery).toBe(true)
  })

  it('allowPix=false nas features desabilita pix', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      features: { allowPix: false },
    })
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getPaymentMethodsForClient(CLIENT_ID, STORE_ID)

    expect(result.pix).toBe(false)
  })

  it('features sem allowPix (padrão) mantém pix habilitado', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      features: {},
    })
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getPaymentMethodsForClient(CLIENT_ID, STORE_ID)

    expect(result.pix).toBe(true)
  })

  it('allowPickup=true reflete corretamente', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      allowPickup: true,
    })
    ;(mockPrisma.clientPaymentAccess.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await getPaymentMethodsForClient(CLIENT_ID, STORE_ID)

    expect(result.pickup).toBe(true)
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      getPaymentMethodsForClient(CLIENT_ID, STORE_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})
