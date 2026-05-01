// Sessão de mesa — abre/entra/consulta.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn() },
    table: { findUnique: jest.fn(), update: jest.fn() },
    tableSession: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { getSession, getTableByAccessToken, openOrJoinSession } from '../table-session.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const STORE_ID = 'store-1'
const ACCESS_TOKEN = 'a1b2c3d4e5f6a7b8'

const mockTable = {
  id: 'table-uuid-1',
  storeId: STORE_ID,
  number: 5,
  isOccupied: false,
  createdAt: new Date(),
  accessToken: ACCESS_TOKEN,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ allowTable: true })
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (input) => {
    if (typeof input === 'function') return input(mockPrisma)
    return Promise.all(input)
  })
})

describe('openOrJoinSession', () => {
  it('throws 422 when store has allowTable=false', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({ allowTable: false })

    await expect(openOrJoinSession(STORE_ID, ACCESS_TOKEN)).rejects.toMatchObject({ status: 422 })
  })

  it('throws 404 when accessToken does not exist', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(openOrJoinSession(STORE_ID, 'invalidhash000000')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 when accessToken belongs to another store (cross-tenant guard)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue({
      ...mockTable,
      storeId: 'other-store',
    })

    await expect(openOrJoinSession(STORE_ID, ACCESS_TOKEN)).rejects.toMatchObject({ status: 404 })
  })

  it('returns existing token when there is already an OPEN session', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'sess-1',
      token: 'existing-token-abc',
      status: 'OPEN',
    })

    const result = await openOrJoinSession(STORE_ID, ACCESS_TOKEN)

    expect(result.token).toBe('existing-token-abc')
    expect(result.tableNumber).toBe(5)
    expect(result.isNew).toBe(false)
    expect(mockPrisma.tableSession.create).not.toHaveBeenCalled()
  })

  it('creates new session and marks table as occupied when none open', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(mockTable)
    ;(mockPrisma.tableSession.findFirst as jest.Mock).mockResolvedValue(null)

    const result = await openOrJoinSession(STORE_ID, ACCESS_TOKEN)

    expect(result.isNew).toBe(true)
    expect(result.tableNumber).toBe(5)
    expect(result.token.length).toBeGreaterThan(20)
    expect(result.status).toBe('OPEN')
    // transação contém o create da sessão e o update da mesa
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe('getTableByAccessToken', () => {
  it('retorna tableNumber quando hash existe na loja', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue({
      storeId: STORE_ID,
      number: 5,
    })
    const result = await getTableByAccessToken(STORE_ID, ACCESS_TOKEN)
    expect(result).toEqual({ tableNumber: 5 })
  })

  it('throws 404 quando hash não existe', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(getTableByAccessToken(STORE_ID, 'nope000000000000')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 quando hash é de outra loja (não vaza dados cross-tenant)', async () => {
    ;(mockPrisma.table.findUnique as jest.Mock).mockResolvedValue({
      storeId: 'other-store',
      number: 1,
    })
    await expect(getTableByAccessToken(STORE_ID, ACCESS_TOKEN)).rejects.toMatchObject({ status: 404 })
  })
})

describe('getSession', () => {
  it('throws 404 when token does not exist', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getSession(STORE_ID, 'no-token')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 404 when session belongs to another store', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess-1',
      storeId: 'other-store',
      status: 'OPEN',
      table: { number: 5 },
      store: { slug: 'other' },
    })

    await expect(getSession(STORE_ID, 'tk')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 410 when session is CLOSED', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess-1',
      storeId: STORE_ID,
      status: 'CLOSED',
      table: { number: 5 },
      store: { slug: 'minha-loja' },
    })

    await expect(getSession(STORE_ID, 'tk')).rejects.toMatchObject({ status: 410 })
  })

  it('returns table number, store slug and OPEN status when session is valid', async () => {
    ;(mockPrisma.tableSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess-1',
      storeId: STORE_ID,
      status: 'OPEN',
      table: { number: 5 },
      store: { slug: 'minha-loja' },
    })

    const result = await getSession(STORE_ID, 'tk')

    expect(result).toEqual({
      tableNumber: 5,
      status: 'OPEN',
      storeSlug: 'minha-loja',
    })
  })
})
