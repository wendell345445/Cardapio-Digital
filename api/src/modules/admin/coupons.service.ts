import { randomUUID } from 'crypto'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'

import type { CreateCouponInput, ListCouponsInput, UpdateCouponInput } from './coupons.schema'

// ─── TASK-090: Serviço de Cupons Admin ───────────────────────────────────────

export async function listCoupons(storeId: string, filters: ListCouponsInput) {
  const coupons = await prisma.coupon.findMany({
    where: {
      storeId,
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.productId !== undefined ? { productId: filters.productId } : {}),
    },
    include: {
      product: { select: { id: true, name: true, imageUrl: true, basePrice: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return Promise.all(coupons.map(async (c) => ({ ...c, totalSavings: await sumSavings(c.id) })))
}

export async function getCoupon(storeId: string, couponId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!coupon || coupon.storeId !== storeId) throw new AppError('Cupom não encontrado', 404)
  return { ...coupon, totalSavings: await sumSavings(coupon.id) }
}

// Soma o Order.discount de todos os pedidos que usaram o cupom, ignorando
// pedidos cancelados (economia não se concretizou). Usa _sum.discount direto
// do agregado do Prisma — não carrega os pedidos pra memória.
async function sumSavings(couponId: string): Promise<number> {
  const agg = await prisma.order.aggregate({
    _sum: { discount: true },
    where: { couponId, status: { not: 'CANCELLED' } },
  })
  return agg._sum.discount ?? 0
}

// Gera código único pra promo por produto. Não é usado em checkout, mas o
// schema do DB exige code e @@unique([storeId, code]).
function autoGeneratePromoCode(): string {
  return `PROMO_${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

export async function createCoupon(
  storeId: string,
  input: CreateCouponInput,
  userId: string,
  ip?: string
) {
  const isProductPromo = !!input.productId

  // Promo por produto: valida produto e auto-gera code. type/value ficam como
  // placeholders (não usados nesse modo).
  if (isProductPromo) {
    const product = await prisma.product.findUnique({ where: { id: input.productId! } })
    if (!product || product.storeId !== storeId) {
      throw new AppError('Produto não encontrado', 404)
    }
  } else {
    const existing = await prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: input.code! } },
    })
    if (existing) throw new AppError('Código de cupom já existe nesta loja', 409)
  }

  const code = isProductPromo ? autoGeneratePromoCode() : input.code!
  const type = isProductPromo ? 'FIXED' : input.type!
  const value = isProductPromo ? 0 : input.value!

  const coupon = await prisma.coupon.create({
    data: {
      storeId,
      code,
      type,
      value,
      minOrder: input.minOrder ?? null,
      maxUses: input.maxUses ?? null,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      productId: input.productId ?? null,
      promoPrice: input.promoPrice ?? null,
    },
  })

  if (isProductPromo) {
    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: isProductPromo ? 'coupon.create_promo' : 'coupon.create',
      entity: 'Coupon',
      entityId: coupon.id,
      data: {
        code: coupon.code,
        productId: coupon.productId,
        promoPrice: coupon.promoPrice,
        type: coupon.type,
        value: coupon.value,
      },
      ip,
    },
  })

  return coupon
}

export async function updateCoupon(
  storeId: string,
  couponId: string,
  input: UpdateCouponInput,
  userId: string,
  ip?: string
) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!coupon || coupon.storeId !== storeId) throw new AppError('Cupom não encontrado', 404)

  if (input.code && input.code !== coupon.code) {
    const existing = await prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: input.code } },
    })
    if (existing) throw new AppError('Código de cupom já existe nesta loja', 409)
  }

  const updated = await prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.minOrder !== undefined ? { minOrder: input.minOrder } : {}),
      ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.promoPrice !== undefined ? { promoPrice: input.promoPrice } : {}),
    },
  })

  if (coupon.productId || updated.productId) {
    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'coupon.update',
      entity: 'Coupon',
      entityId: couponId,
      data: input,
      ip,
    },
  })

  return updated
}

export async function deleteCoupon(
  storeId: string,
  couponId: string,
  userId: string,
  ip?: string
) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!coupon || coupon.storeId !== storeId) throw new AppError('Cupom não encontrado', 404)

  await prisma.coupon.delete({ where: { id: couponId } })

  if (coupon.productId) {
    await cache.del(`menu:${storeId}`)
    emit.menuUpdated(storeId)
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'coupon.delete',
      entity: 'Coupon',
      entityId: couponId,
      data: { code: coupon.code, productId: coupon.productId },
      ip,
    },
  })
}

// ─── TASK-090: Validação pública de cupom ────────────────────────────────────

export async function validateCoupon(storeId: string, code: string, subtotal?: number) {
  const coupon = await prisma.coupon.findUnique({
    where: { storeId_code: { storeId, code: code.toUpperCase() } },
  })

  // Promos por produto não podem ser aplicadas via código no checkout.
  if (!coupon || !coupon.isActive || coupon.productId) {
    throw new AppError('Cupom inválido ou expirado', 422)
  }
  if (coupon.startsAt && coupon.startsAt > new Date()) throw new AppError('Cupom ainda não está ativo', 422)
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Cupom expirado', 422)
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new AppError('Limite de usos do cupom atingido', 422)
  }
  if (subtotal !== undefined && coupon.minOrder !== null && subtotal < coupon.minOrder) {
    throw new AppError(`Pedido mínimo para este cupom: R$ ${coupon.minOrder.toFixed(2)}`, 422)
  }

  const discount =
    coupon.type === 'PERCENTAGE' ? (subtotal ?? 0) * (coupon.value / 100) : coupon.value

  return { coupon, discount: Math.min(discount, subtotal ?? discount) }
}

// ─── Promoções por produto: helper consultado pelo menu público ─────────────

/**
 * Retorna mapa productId → promoPrice para todas as promoções ATIVAS agora.
 * "Ativa" = isActive=true e data atual dentro da janela [startsAt, expiresAt).
 */
export async function getActiveProductPromos(storeId: string): Promise<Map<string, {
  promoPrice: number
  startsAt: Date | null
  expiresAt: Date | null
}>> {
  const now = new Date()
  const promos = await prisma.coupon.findMany({
    where: {
      storeId,
      isActive: true,
      productId: { not: null },
      promoPrice: { not: null },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    select: { productId: true, promoPrice: true, startsAt: true, expiresAt: true },
  })

  const map = new Map<string, { promoPrice: number; startsAt: Date | null; expiresAt: Date | null }>()
  for (const p of promos) {
    if (p.productId && p.promoPrice != null) {
      map.set(p.productId, {
        promoPrice: p.promoPrice,
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
      })
    }
  }
  return map
}
