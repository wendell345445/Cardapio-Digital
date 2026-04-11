import { hash } from 'bcrypt'
import { z } from 'zod'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

// ─── TASK-0910: Admins Adicionais por Loja ───────────────────────────────────

const MAX_ADMINS_PER_STORE = 5

export const createStoreAdminSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

export type CreateStoreAdminInput = z.infer<typeof createStoreAdminSchema>

export async function listStoreAdmins(storeId: string) {
  const admins = await prisma.user.findMany({
    where: { storeId, role: 'ADMIN', isActive: true },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return admins
}

export async function createStoreAdmin(storeId: string, data: CreateStoreAdminInput) {
  // Verificar limite
  const count = await prisma.user.count({ where: { storeId, role: 'ADMIN', isActive: true } })
  if (count >= MAX_ADMINS_PER_STORE) {
    throw new AppError(`Limite de ${MAX_ADMINS_PER_STORE} admins por loja atingido`, 422)
  }

  // Verificar email duplicado
  const existing = await prisma.user.findFirst({ where: { email: data.email } })
  if (existing) {
    throw new AppError('Email já cadastrado', 422)
  }

  const passwordHash = await hash(data.password, 12)

  const admin = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'ADMIN',
      storeId,
      isActive: true,
    },
    select: { id: true, name: true, email: true, createdAt: true },
  })

  return admin
}

export async function removeStoreAdmin(storeId: string, userId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      users: {
        where: { role: 'ADMIN', isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  if (!store) throw new AppError('Loja não encontrada', 404)

  // RN: não pode remover o admin original (o mais antigo)
  const originalAdminId = store.users[0]?.id
  if (originalAdminId === userId) {
    throw new AppError('Não é possível remover o admin principal da loja', 403)
  }

  const admin = await prisma.user.findFirst({
    where: { id: userId, storeId, role: 'ADMIN' },
  })
  if (!admin) throw new AppError('Admin não encontrado nesta loja', 404)

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  })
}
