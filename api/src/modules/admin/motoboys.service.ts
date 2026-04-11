import { hash } from 'bcrypt'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import type { CreateMotoboyInput } from './motoboys.schema'

// ─── TASK-053: Cadastro de Motoboys ───────────────────────────────────────────

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
    },
  })
  return motoboys
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

  // Check uniqueness constraints
  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, storeId },
    })
    if (existing) {
      throw new AppError('Já existe um motoboy com esse email nesta loja', 422)
    }
  }

  if (data.whatsapp) {
    const existing = await prisma.user.findFirst({
      where: { whatsapp: data.whatsapp, storeId },
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
