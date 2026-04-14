import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { reauth } from '../auth/auth.service'

import type {
  UpdateStoreInput,
  BusinessHourInput,
  UpdateStoreStatusInput,
  UpdateWhatsappInput,
  UpdatePixInput,
  UpdatePaymentSettingsInput,
} from './store.schema'

// ─── TASK-050: Configurações da Loja ─────────────────────────────────────────

const DEFAULT_HOURS: Omit<BusinessHourInput, 'dayOfWeek'>[] = [
  { openTime: '08:00', closeTime: '22:00', isClosed: false },
  { openTime: '08:00', closeTime: '22:00', isClosed: false },
  { openTime: '08:00', closeTime: '22:00', isClosed: false },
  { openTime: '08:00', closeTime: '22:00', isClosed: false },
  { openTime: '08:00', closeTime: '22:00', isClosed: false },
  { openTime: '08:00', closeTime: '22:00', isClosed: false },
  { openTime: '08:00', closeTime: '18:00', isClosed: false },
]

export async function getStore(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logo: true,
      address: true,
      phone: true,
      manualOpen: true,
      pixKey: true,
      pixKeyType: true,
      allowCashOnDelivery: true,
      allowPickup: true,
      allowCreditCard: true,
      serviceChargePercent: true,
      plan: true,
      status: true,
      stripeTrialEndsAt: true,
    },
  })

  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  return store
}

export async function updateStore(
  storeId: string,
  data: UpdateStoreInput,
  userId: string,
  ip?: string
) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })

  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.logo !== undefined && { logo: data.logo }),
      ...(data.address !== undefined && { address: data.address }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      address: true,
    },
  })

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.update',
      entity: 'Store',
      entityId: storeId,
      data,
      ip,
    },
  })

  return updated
}

export async function getBusinessHours(storeId: string) {
  const existing = await prisma.businessHour.findMany({
    where: { storeId },
    orderBy: { dayOfWeek: 'asc' },
  })

  // Retorna todos os 7 dias, usando defaults para os que não existem no DB
  const hoursMap = new Map(existing.map((h) => [h.dayOfWeek, h]))

  const hours = Array.from({ length: 7 }, (_, day) => {
    if (hoursMap.has(day)) {
      return hoursMap.get(day)!
    }

    const defaults = DEFAULT_HOURS[day]
    return {
      id: null,
      storeId,
      dayOfWeek: day,
      openTime: defaults.openTime ?? null,
      closeTime: defaults.closeTime ?? null,
      isClosed: defaults.isClosed,
    }
  })

  return hours
}

export async function updateBusinessHours(
  storeId: string,
  hours: BusinessHourInput[],
  userId: string,
  ip?: string
) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })

  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  const updated = await Promise.all(
    hours.map((hour) =>
      prisma.businessHour.upsert({
        where: {
          storeId_dayOfWeek: {
            storeId,
            dayOfWeek: hour.dayOfWeek,
          },
        },
        update: {
          openTime: hour.openTime ?? null,
          closeTime: hour.closeTime ?? null,
          isClosed: hour.isClosed,
        },
        create: {
          storeId,
          dayOfWeek: hour.dayOfWeek,
          openTime: hour.openTime ?? null,
          closeTime: hour.closeTime ?? null,
          isClosed: hour.isClosed,
        },
      })
    )
  )

  // Ordenar pelo dia da semana para resposta consistente
  updated.sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.hours.update',
      entity: 'BusinessHour',
      entityId: storeId,
      data: { hours },
      ip,
    },
  })

  return updated
}

export async function updateStoreStatus(
  storeId: string,
  data: UpdateStoreStatusInput,
  userId: string,
  ip?: string
) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })

  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      manualOpen: data.manualOpen,
    },
    select: {
      id: true,
      manualOpen: true,
    },
  })

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.status.update',
      entity: 'Store',
      entityId: storeId,
      data: { manualOpen: data.manualOpen },
      ip,
    },
  })

  return updated
}

// ─── TASK-051: WhatsApp e Pix (reauth) ───────────────────────────────────────

export async function updateWhatsapp(
  storeId: string,
  data: UpdateWhatsappInput,
  userId: string,
  ip?: string
) {
  await reauth(userId, data.password)

  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)

  const previousPhone = store.phone

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: { phone: data.phone },
    select: { id: true, phone: true },
  })

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.whatsapp.update',
      entity: 'Store',
      entityId: storeId,
      data: { previousPhone, newPhone: data.phone },
      ip,
    },
  })

  // TODO (Sprint 8): invalidar conexão Baileys atual e notificar admin para reconectar via QR Code

  return updated
}

export async function updatePix(
  storeId: string,
  data: UpdatePixInput,
  userId: string,
  ip?: string
) {
  await reauth(userId, data.password)

  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)

  const previousPixKey = store.pixKey
  const previousPixKeyType = store.pixKeyType

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      pixKey: data.pixKey,
      pixKeyType: data.pixKeyType,
    },
    select: { id: true, pixKey: true, pixKeyType: true },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.pix.update',
      entity: 'Store',
      entityId: storeId,
      data: { previousPixKey, previousPixKeyType, newPixKey: data.pixKey, newPixKeyType: data.pixKeyType },
      ip,
    },
  })

  return updated
}

// ─── TASK-052: Formas de Pagamento e Retirada ─────────────────────────────────

export async function updatePaymentSettings(
  storeId: string,
  data: UpdatePaymentSettingsInput,
  userId: string,
  ip?: string
) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)

  // allowPix fica no JSON features para não precisar de migration
  const currentFeatures = (store.features as Record<string, unknown>) ?? {}
  const newFeatures =
    data.allowPix !== undefined
      ? { ...currentFeatures, allowPix: data.allowPix }
      : currentFeatures

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(data.allowCashOnDelivery !== undefined && { allowCashOnDelivery: data.allowCashOnDelivery }),
      ...(data.allowPickup !== undefined && { allowPickup: data.allowPickup }),
      ...(data.allowCreditCard !== undefined && { allowCreditCard: data.allowCreditCard }),
      ...(data.serviceChargePercent !== undefined && { serviceChargePercent: data.serviceChargePercent }),
      ...(data.allowPix !== undefined && { features: newFeatures as Record<string, boolean> }),
    },
    select: {
      id: true,
      allowCashOnDelivery: true,
      allowPickup: true,
      allowCreditCard: true,
      serviceChargePercent: true,
      features: true,
    },
  })

  await cache.del(`menu:${storeId}`)

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.payment-settings.update',
      entity: 'Store',
      entityId: storeId,
      data,
      ip,
    },
  })

  return updated
}
