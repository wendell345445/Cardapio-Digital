import { hash } from 'bcrypt'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import type { CreateMotoboyInput, UpdateMotoboyInput } from './motoboys.schema'

// ─── TASK-053: Cadastro de Motoboys ───────────────────────────────────────────
// ─── A-032/Entregas: disponibilidade diária (lazy reset) + round-robin ────────

// Lazy reset diário: motoboy é considerado disponível hoje se availableAt
// caiu em "hoje" (timezone do servidor). Meia-noite já invalida naturalmente,
// sem cron — dono precisa reativar cada dia.
export function isAvailableToday(availableAt: Date | null | undefined): boolean {
  if (!availableAt) return false
  const now = new Date()
  return (
    availableAt.getFullYear() === now.getFullYear() &&
    availableAt.getMonth() === now.getMonth() &&
    availableAt.getDate() === now.getDate()
  )
}

export async function listMotoboys(storeId: string) {
  const motoboys = await prisma.user.findMany({
    where: { storeId, role: 'MOTOBOY' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      email: true,
      isActive: true,
      storeId: true,
      availableAt: true,
      lastAssignedAt: true,
    },
  })
  return motoboys.map(({ availableAt, ...m }) => ({
    ...m,
    availableAt,
    availableToday: isAvailableToday(availableAt),
  }))
}

export async function setMotoboyAvailability(
  storeId: string,
  motoboyId: string,
  available: boolean,
  userId: string,
  ip?: string
) {
  const current = await prisma.user.findUnique({ where: { id: motoboyId } })

  if (!current || current.storeId !== storeId || current.role !== 'MOTOBOY') {
    throw new AppError('Motoboy não encontrado', 404)
  }

  const updated = await prisma.user.update({
    where: { id: motoboyId },
    data: { availableAt: available ? new Date() : null },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      email: true,
      isActive: true,
      storeId: true,
      availableAt: true,
      lastAssignedAt: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'motoboy.availability',
      entity: 'User',
      entityId: motoboyId,
      data: { available },
      ip,
    },
  })

  return { ...updated, availableToday: isAvailableToday(updated.availableAt) }
}

export async function createMotoboy(
  storeId: string,
  data: CreateMotoboyInput,
  userId: string,
  ip?: string
) {
  // Validate at least one contact method
  if (!data.email && !data.whatsapp) {
    throw new AppError('Informe email ou WhatsApp', 422)
  }

  // Unicidade global de email: o mesmo email não pode ser User em nenhuma outra
  // role/loja — senão login OAuth fica ambíguo (ver findOrCreateOAuthUser).
  if (data.email) {
    const existing = await prisma.user.findFirst({ where: { email: data.email } })
    if (existing) {
      throw new AppError('Email já cadastrado no sistema', 422)
    }
  }

  // Whatsapp pode repetir entre lojas (cliente pode pedir em várias), mas não
  // dentro da mesma loja onde já tem role MOTOBOY/ADMIN.
  if (data.whatsapp) {
    const existing = await prisma.user.findFirst({
      where: {
        whatsapp: data.whatsapp,
        storeId,
        role: { in: ['MOTOBOY', 'ADMIN'] },
      },
    })
    if (existing) {
      throw new AppError('Já existe um motoboy com esse WhatsApp nesta loja', 422)
    }
  }

  const passwordHash = await hash(data.password, 12)

  const motoboy = await prisma.user.create({
    data: {
      name: data.name,
      whatsapp: data.whatsapp,
      email: data.email,
      passwordHash,
      role: 'MOTOBOY',
      storeId,
    },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      email: true,
      isActive: true,
      storeId: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'motoboy.create',
      entity: 'User',
      entityId: motoboy.id,
      data: { name: data.name, email: data.email, whatsapp: data.whatsapp },
      ip,
    },
  })

  return motoboy
}

export async function updateMotoboy(
  storeId: string,
  motoboyId: string,
  data: UpdateMotoboyInput,
  userId: string,
  ip?: string
) {
  const current = await prisma.user.findUnique({ where: { id: motoboyId } })

  if (!current || current.storeId !== storeId || current.role !== 'MOTOBOY') {
    throw new AppError('Motoboy não encontrado', 404)
  }

  if (data.email !== undefined && data.email !== null && data.email !== current.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, storeId, NOT: { id: motoboyId } },
    })
    if (existing) {
      throw new AppError('Já existe um motoboy com esse email nesta loja', 422)
    }
  }

  if (data.whatsapp !== undefined && data.whatsapp !== null && data.whatsapp !== current.whatsapp) {
    const existing = await prisma.user.findFirst({
      where: { whatsapp: data.whatsapp, storeId, NOT: { id: motoboyId } },
    })
    if (existing) {
      throw new AppError('Já existe um motoboy com esse WhatsApp nesta loja', 422)
    }
  }

  const nextEmail = data.email === undefined ? current.email : data.email
  const nextWhatsapp = data.whatsapp === undefined ? current.whatsapp : data.whatsapp
  if (!nextEmail && !nextWhatsapp) {
    throw new AppError('Informe email ou WhatsApp', 422)
  }

  const updateData: {
    name?: string
    email?: string | null
    whatsapp?: string | null
    passwordHash?: string
  } = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.email !== undefined) updateData.email = data.email
  if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp
  if (data.password) updateData.passwordHash = await hash(data.password, 12)

  const updated = await prisma.user.update({
    where: { id: motoboyId },
    data: updateData,
    select: {
      id: true,
      name: true,
      whatsapp: true,
      email: true,
      isActive: true,
      storeId: true,
    },
  })

  if (data.password) {
    await prisma.refreshToken.deleteMany({ where: { userId: motoboyId } })
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'motoboy.update',
      entity: 'User',
      entityId: motoboyId,
      data: {
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp,
        passwordChanged: !!data.password,
      },
      ip,
    },
  })

  return updated
}

export async function deleteMotoboy(
  storeId: string,
  motoboyId: string,
  userId: string,
  ip?: string
) {
  const motoboy = await prisma.user.findUnique({ where: { id: motoboyId } })

  if (!motoboy || motoboy.storeId !== storeId || motoboy.role !== 'MOTOBOY') {
    throw new AppError('Motoboy não encontrado', 404)
  }

  // RefreshToken has onDelete: Cascade, but explicitly delete to be safe
  await prisma.refreshToken.deleteMany({ where: { userId: motoboyId } })

  await prisma.user.delete({ where: { id: motoboyId } })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'motoboy.delete',
      entity: 'User',
      entityId: motoboyId,
      data: { name: motoboy.name, email: motoboy.email, whatsapp: motoboy.whatsapp },
      ip,
    },
  })
}
