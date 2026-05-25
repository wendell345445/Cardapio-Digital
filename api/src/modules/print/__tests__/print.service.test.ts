// Cobre os endpoints novos do módulo print consumidos pelo Menuziprinter:
// printerLogin, verifyPrinterToken, listPendingPrintJobs, markPrintJobPrinted,
// cleanupOldPrintJobs.

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn() },
    printJob: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('../../auth/auth.service', () => ({
  validateCredentials: jest.fn(),
}))

import { sign } from 'jsonwebtoken'

import { prisma } from '../../../shared/prisma/prisma'
import { validateCredentials } from '../../auth/auth.service'
import {
  cleanupOldPrintJobs,
  listPendingPrintJobs,
  markPrintJobPrinted,
  printerLogin,
  verifyPrinterToken,
} from '../print.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockValidateCredentials = validateCredentials as jest.Mock

const STORE_ID = 'store-1'
const USER_ID = 'user-1'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret'
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('printerLogin', () => {
  it('retorna token JWT scope=print e dados do restaurante quando credenciais válidas', async () => {
    mockValidateCredentials.mockResolvedValue({ id: USER_ID, role: 'OWNER', storeId: STORE_ID })
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: STORE_ID,
      name: 'Pizzaria do Zé',
    })

    const result = await printerLogin('dono@loja.com', 'senha123')

    expect(result.restaurant).toEqual({ id: STORE_ID, name: 'Pizzaria do Zé' })
    expect(result.token).toBeTruthy()

    const decoded = verifyPrinterToken(result.token)
    expect(decoded.scope).toBe('print')
    expect(decoded.storeId).toBe(STORE_ID)
    expect(decoded.userId).toBe(USER_ID)
  })

  it('rejeita login de MOTOBOY (conta de entregador não conecta impressora)', async () => {
    mockValidateCredentials.mockResolvedValue({ id: USER_ID, role: 'MOTOBOY', storeId: STORE_ID })

    await expect(printerLogin('moto@loja.com', 'senha123')).rejects.toMatchObject({
      status: 403,
      code: 'WRONG_SCOPE',
    })
  })

  it('rejeita usuário sem storeId associado', async () => {
    mockValidateCredentials.mockResolvedValue({ id: USER_ID, role: 'OWNER', storeId: null })

    await expect(printerLogin('user@loja.com', 'senha123')).rejects.toMatchObject({ status: 403 })
  })
})

describe('verifyPrinterToken', () => {
  it('aceita token JWT com scope=print', () => {
    const token = sign({ userId: USER_ID, storeId: STORE_ID, scope: 'print' }, 'test-secret', {
      expiresIn: '1h',
    })

    expect(verifyPrinterToken(token)).toMatchObject({
      userId: USER_ID,
      storeId: STORE_ID,
      scope: 'print',
    })
  })

  it('rejeita token com escopo diferente (impede uso de token admin no printer)', () => {
    const token = sign({ userId: USER_ID, role: 'ADMIN' }, 'test-secret', { expiresIn: '1h' })

    expect(() => verifyPrinterToken(token)).toThrowError(
      expect.objectContaining({ status: 403 })
    )
  })

  it('rejeita token inválido', () => {
    expect(() => verifyPrinterToken('not-a-jwt')).toThrowError(
      expect.objectContaining({ status: 401 })
    )
  })
})

describe('listPendingPrintJobs', () => {
  it('retorna apenas PrintJobs PENDING da loja com data estruturado (JSON)', async () => {
    ;(mockPrisma.printJob.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'job-1',
        orderId: 'order-1',
        order: {
          number: 42,
          createdAt: new Date('2026-05-20T18:00:00Z'),
          clientName: 'Cliente',
          clientWhatsapp: '11999999999',
          type: 'DELIVERY',
          paymentMethod: 'PIX',
          subtotal: 50,
          deliveryFee: 5,
          discount: 0,
          total: 55,
          notes: null,
          address: { street: 'Rua A', number: '100', neighborhood: 'Centro', city: 'SP' },
          items: [
            {
              productName: 'Pizza',
              variationName: 'Grande',
              quantity: 2,
              totalPrice: 50,
              notes: 'sem cebola',
              additionals: [{ name: 'Borda', price: 8 }],
            },
          ],
        },
      },
    ])

    const result = await listPendingPrintJobs(STORE_ID)

    expect(mockPrisma.printJob.findMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { order: { include: { items: { include: { additionals: true } } } } },
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'job-1', orderId: 'order-1', orderNumber: 42 })

    // Não há mais `receipt` string — só `data` estruturado.
    expect((result[0] as unknown as { receipt?: string }).receipt).toBeUndefined()
    expect(result[0].data).toMatchObject({
      orderNumber: 42,
      type: 'DELIVERY',
      typeLabel: 'Entrega',
      customerName: 'Cliente',
      customerPhone: '11999999999',
      customerAddress: 'Rua A, 100, Centro, SP',
      paymentMethod: 'PIX',
      paymentLabel: 'PIX',
      subtotal: 50,
      deliveryFee: 5,
      total: 55,
    })
    expect(result[0].data.items).toHaveLength(1)
    expect(result[0].data.items[0]).toMatchObject({
      name: 'Pizza (Grande)',
      quantity: 2,
      totalPrice: 50,
      notes: 'sem cebola',
      options: [{ name: 'Borda', price: 8 }],
    })
  })
})

describe('markPrintJobPrinted', () => {
  it('marca como PRINTED e seta printedAt', async () => {
    ;(mockPrisma.printJob.findUnique as jest.Mock).mockResolvedValue({
      orderId: 'order-1',
      storeId: STORE_ID,
      status: 'PENDING',
    })

    await markPrintJobPrinted(STORE_ID, 'order-1')

    expect(mockPrisma.printJob.update).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      data: { status: 'PRINTED', printedAt: expect.any(Date) },
    })
  })

  it('é idempotente quando já está PRINTED (Menuziprinter pode reenviar)', async () => {
    ;(mockPrisma.printJob.findUnique as jest.Mock).mockResolvedValue({
      orderId: 'order-1',
      storeId: STORE_ID,
      status: 'PRINTED',
    })

    await markPrintJobPrinted(STORE_ID, 'order-1')

    expect(mockPrisma.printJob.update).not.toHaveBeenCalled()
  })

  it('rejeita PrintJob de outra loja (tenant isolation)', async () => {
    ;(mockPrisma.printJob.findUnique as jest.Mock).mockResolvedValue({
      orderId: 'order-1',
      storeId: 'outra-loja',
      status: 'PENDING',
    })

    await expect(markPrintJobPrinted(STORE_ID, 'order-1')).rejects.toMatchObject({ status: 404 })
  })

  it('404 quando PrintJob não existe', async () => {
    ;(mockPrisma.printJob.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(markPrintJobPrinted(STORE_ID, 'order-x')).rejects.toMatchObject({ status: 404 })
  })
})

describe('cleanupOldPrintJobs', () => {
  it('remove PrintJobs PRINTED com mais de N dias', async () => {
    ;(mockPrisma.printJob.deleteMany as jest.Mock).mockResolvedValue({ count: 7 })

    const removed = await cleanupOldPrintJobs(30)

    expect(removed).toBe(7)
    expect(mockPrisma.printJob.deleteMany).toHaveBeenCalledWith({
      where: { status: 'PRINTED', printedAt: { lt: expect.any(Date) } },
    })

    const callArgs = (mockPrisma.printJob.deleteMany as jest.Mock).mock.calls[0][0]
    const cutoff = callArgs.where.printedAt.lt as Date
    const expectedCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    // Tolerância de 1s pra evitar flakiness por execução
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(1000)
  })
})
