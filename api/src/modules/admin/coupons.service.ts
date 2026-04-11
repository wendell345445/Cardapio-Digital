import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import type { CreateCouponInput, ListCouponsInput, UpdateCouponInput } from './coupons.schema'

// ─── TASK-090: Serviço de Cupons Admin ───────────────────────────────────────

export async function listCoupons(storeId: string, filters: ListCouponsInput) {
  return prisma.coupon.findMany({
    where: {
      storeId,
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getCoupon(storeId: string, couponId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!coupon || coupon.storeId !== storeId) throw new AppError('Cupom não encontrado', 404)
  return coupon
}

export async function createCoupon(
  storeId: string,
  input: CreateCouponInput,
  userId: string,
  ip?: string
) {
  const existing = await prisma.coupon.findUnique({
    where: { storeId_code: { storeId, code: input.code } },
  })
  if (existing) throw new AppError('Código de cupom já existe nesta loja', 409)

  const coupon = await prisma.coupon.create({
    data: {
      storeId,
      code: input.code,
      type: input.type,
      value: input.value,
      minOrder: input.minOrder ?? null,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'coupon.create',
      entity: 'Coupon',
      entityId: coupon.id,
      data: { code: coupon.code, type: coupon.type, value: coupon.value },
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
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })

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

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'coupon.delete',
      entity: 'Coupon',
      entityId: couponId,
      data: { code: coupon.code },
      ip,
    },
  })
}

// ─── TASK-090: Validação pública de cupom ────────────────────────────────────

export async function validateCoupon(storeId: string, code: string, subtotal?: number) {
  const coupon = await prisma.coupon.findUnique({
    where: { storeId_code: { storeId, code: code.toUpperCase() } },
  })

  if (!coupon || !coupon.isActive) throw new AppError('Cupom inválido ou expirado', 422)
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Cupom expirado', 422)
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new AppError('Limite de usos do cupom atingido', 422)
  }
  if (subtotal !== undefined && coupon.minOrder !== null && subtotal < coupon.minOrder) {
    throw new AppError(`Pedido mínimo para este cupom: R$ ${coupon.minOrder.toFixed(2)}`, 422)
  }

  const discount =
    coupon.type === 'PERCENTAGE'
      ? (subtotal ?? 0) * (coupon.value / 100)
      : coupon.value

  return { coupon, discount: Math.min(discount, subtotal ?? discount) }
}
