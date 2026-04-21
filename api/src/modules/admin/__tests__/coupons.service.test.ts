// ─── TASK-090: Cupons — Unit Tests ────────────────────────────────────────────
// Cobre: validateCoupon (público) + CRUD admin (listCoupons, createCoupon, updateCoupon, deleteCoupon, getCoupon)

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    coupon: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      aggregate: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} from '../coupons.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const STORE_ID = 'store-1'
const USER_ID = 'admin-1'
const COUPON_ID = 'coupon-1'
const IP = '127.0.0.1'

const mockCoupon = {
  id: COUPON_ID,
  storeId: STORE_ID,
  code: 'PROMO10',
  type: 'PERCENTAGE' as const,
  value: 10,
  isActive: true,
  expiresAt: null,
  maxUses: null,
  usedCount: 0,
  minOrder: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: nenhum pedido com cupom → economia total = 0.
  // Testes específicos de totalSavings sobrescrevem isso.
  ;(mockPrisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { discount: null } })
})

// ─── listCoupons ──────────────────────────────────────────────────────────────

describe('listCoupons', () => {
  it('retorna todos os cupons da loja ordenados por createdAt desc', async () => {
    ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([mockCoupon])

    const result = await listCoupons(STORE_ID, {})

    expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID },
        orderBy: { createdAt: 'desc' },
      })
    )
    expect(result).toHaveLength(1)
  })

  it('filtra por isActive=true quando passado', async () => {
    ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([mockCoupon])

    await listCoupons(STORE_ID, { isActive: true })

    expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID, isActive: true },
      })
    )
  })

  it('filtra por isActive=false quando passado', async () => {
    ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([])

    await listCoupons(STORE_ID, { isActive: false })

    expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID, isActive: false },
      })
    )
  })

  it('não aplica filtro de isActive quando não passado', async () => {
    ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([])

    await listCoupons(STORE_ID, {})

    expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID },
      })
    )
    const call = (mockPrisma.coupon.findMany as jest.Mock).mock.calls[0][0]
    expect(call.where.isActive).toBeUndefined()
  })
})

// ─── getCoupon ────────────────────────────────────────────────────────────────

describe('getCoupon', () => {
  it('retorna cupom quando encontrado na loja', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)

    const result = await getCoupon(STORE_ID, COUPON_ID)

    expect(result.id).toBe(COUPON_ID)
  })

  it('lança 404 quando cupom não existe', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getCoupon(STORE_ID, 'nao-existe')).rejects.toMatchObject({ status: 404 })
  })

  it('lança 404 quando cupom pertence a outra loja (isolamento multi-tenant)', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      storeId: 'outra-loja',
    })

    await expect(getCoupon(STORE_ID, COUPON_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── createCoupon ─────────────────────────────────────────────────────────────

describe('createCoupon', () => {
  const createInput = {
    code: 'PROMO10',
    type: 'PERCENTAGE' as const,
    value: 10,
  }

  it('cria cupom e registra AuditLog', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.coupon.create as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await createCoupon(STORE_ID, createInput, USER_ID, IP)

    expect(result.id).toBe(COUPON_ID)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'coupon.create',
          entity: 'Coupon',
          entityId: COUPON_ID,
        }),
      })
    )
  })

  it('lança 409 quando código já existe na loja', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)

    await expect(
      createCoupon(STORE_ID, createInput, USER_ID)
    ).rejects.toMatchObject({ status: 409 })

    expect(mockPrisma.coupon.create).not.toHaveBeenCalled()
  })

  it('cria cupom com campos opcionais (minOrder, maxUses, expiresAt)', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.coupon.create as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      minOrder: 50,
      maxUses: 100,
      expiresAt: new Date('2030-12-31'),
    })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await createCoupon(
      STORE_ID,
      { ...createInput, minOrder: 50, maxUses: 100, expiresAt: new Date('2030-12-31') },
      USER_ID
    )

    expect(mockPrisma.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          minOrder: 50,
          maxUses: 100,
        }),
      })
    )
  })
})

// ─── updateCoupon ─────────────────────────────────────────────────────────────

describe('updateCoupon', () => {
  it('atualiza cupom e registra AuditLog', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.coupon.update as jest.Mock).mockResolvedValue({ ...mockCoupon, value: 20 })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateCoupon(STORE_ID, COUPON_ID, { value: 20 }, USER_ID)

    expect(result.value).toBe(20)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'coupon.update' }),
      })
    )
  })

  it('lança 404 quando cupom não existe', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      updateCoupon(STORE_ID, COUPON_ID, { value: 20 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança 409 quando novo código já existe na loja', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockCoupon)          // find para verificar existência
      .mockResolvedValueOnce({ ...mockCoupon, id: 'outro-coupon', code: 'NOVO20' }) // código duplicado

    await expect(
      updateCoupon(STORE_ID, COUPON_ID, { code: 'NOVO20' }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('não verifica duplicidade quando código não muda', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.coupon.update as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await updateCoupon(STORE_ID, COUPON_ID, { value: 15 }, USER_ID)

    // Só uma chamada de findUnique (para verificar existência)
    expect(mockPrisma.coupon.findUnique).toHaveBeenCalledTimes(1)
  })

  it('pode desativar cupom via isActive=false', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.coupon.update as jest.Mock).mockResolvedValue({ ...mockCoupon, isActive: false })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    const result = await updateCoupon(STORE_ID, COUPON_ID, { isActive: false }, USER_ID)

    expect(result.isActive).toBe(false)
  })
})

// ─── deleteCoupon ─────────────────────────────────────────────────────────────

describe('deleteCoupon', () => {
  it('deleta cupom e registra AuditLog', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.coupon.delete as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({})

    await deleteCoupon(STORE_ID, COUPON_ID, USER_ID, IP)

    expect(mockPrisma.coupon.delete).toHaveBeenCalledWith({ where: { id: COUPON_ID } })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'coupon.delete', entity: 'Coupon' }),
      })
    )
  })

  it('lança 404 quando cupom não existe', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(deleteCoupon(STORE_ID, COUPON_ID, USER_ID)).rejects.toMatchObject({ status: 404 })

    expect(mockPrisma.coupon.delete).not.toHaveBeenCalled()
  })

  it('lança 404 quando cupom pertence a outra loja', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      storeId: 'outra-loja',
    })

    await expect(deleteCoupon(STORE_ID, COUPON_ID, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── totalSavings (A-076: rastreio de uso — economia total) ──────────────────

describe('totalSavings (rastreio de uso — A-076)', () => {
  it('listCoupons retorna totalSavings agregado por cupom, ignorando pedidos CANCELLED', async () => {
    ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([mockCoupon])
    ;(mockPrisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { discount: 42.5 } })

    const result = await listCoupons(STORE_ID, {})

    expect(result[0].totalSavings).toBe(42.5)
    expect(mockPrisma.order.aggregate).toHaveBeenCalledWith({
      _sum: { discount: true },
      where: { couponId: COUPON_ID, status: { not: 'CANCELLED' } },
    })
  })

  it('getCoupon retorna totalSavings=0 quando nenhum pedido usou o cupom', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { discount: null } })

    const result = await getCoupon(STORE_ID, COUPON_ID)

    expect(result.totalSavings).toBe(0)
  })

  it('getCoupon retorna totalSavings somado quando há pedidos não-cancelados', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)
    ;(mockPrisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { discount: 120 } })

    const result = await getCoupon(STORE_ID, COUPON_ID)

    expect(result.totalSavings).toBe(120)
  })
})

// ─── validateCoupon (público) ─────────────────────────────────────────────────

describe('validateCoupon', () => {
  it('retorna desconto percentual calculado sobre subtotal', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon) // 10%

    const result = await validateCoupon(STORE_ID, 'PROMO10', 100)

    expect(result.discount).toBe(10) // 10% de 100
    expect(result.coupon.id).toBe(COUPON_ID)
  })

  it('retorna desconto fixo independente do subtotal', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      type: 'FIXED',
      value: 15,
    })

    const result = await validateCoupon(STORE_ID, 'DESC15', 100)

    expect(result.discount).toBe(15)
  })

  it('desconto nunca excede o subtotal (cap em 100%)', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      type: 'FIXED',
      value: 200, // maior que o subtotal
    })

    const result = await validateCoupon(STORE_ID, 'SUPER', 50)

    expect(result.discount).toBe(50) // cap no subtotal
  })

  it('normaliza code para uppercase antes de buscar', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon)

    await validateCoupon(STORE_ID, 'promo10', 100)

    expect(mockPrisma.coupon.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId_code: { storeId: STORE_ID, code: 'PROMO10' } },
      })
    )
  })

  it('lança 422 quando cupom não existe', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(validateCoupon(STORE_ID, 'INVALIDO', 100)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando cupom está inativo', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      isActive: false,
    })

    await expect(validateCoupon(STORE_ID, 'PROMO10', 100)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando cupom expirou', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      expiresAt: new Date('2020-01-01'),
    })

    await expect(validateCoupon(STORE_ID, 'PROMO10', 100)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando atingiu limite de usos', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      maxUses: 10,
      usedCount: 10,
    })

    await expect(validateCoupon(STORE_ID, 'PROMO10', 100)).rejects.toMatchObject({ status: 422 })
  })

  it('lança 422 quando subtotal está abaixo do pedido mínimo', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      minOrder: 150,
    })

    await expect(validateCoupon(STORE_ID, 'PROMO10', 100)).rejects.toMatchObject({ status: 422 })
  })

  it('não verifica minOrder quando subtotal não informado', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      minOrder: 150,
    })

    // Sem subtotal: não deve lançar erro de minOrder
    const result = await validateCoupon(STORE_ID, 'PROMO10')

    expect(result.discount).toBe(0) // 10% de 0 (sem subtotal)
  })

  it('cupom válido com maxUses não atingido (usedCount < maxUses)', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      maxUses: 10,
      usedCount: 9,
    })

    const result = await validateCoupon(STORE_ID, 'PROMO10', 100)

    expect(result.discount).toBe(10)
  })

  it('cupom válido sem data de expiração', async () => {
    ;(mockPrisma.coupon.findUnique as jest.Mock).mockResolvedValue({
      ...mockCoupon,
      expiresAt: null,
    })

    const result = await validateCoupon(STORE_ID, 'PROMO10', 100)

    expect(result.discount).toBe(10)
  })
})
