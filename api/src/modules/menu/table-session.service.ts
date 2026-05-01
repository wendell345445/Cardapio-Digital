import { randomBytes } from 'node:crypto'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function openOrJoinSession(
  storeId: string,
  accessToken: string
): Promise<{ token: string; tableNumber: number; status: 'OPEN'; isNew: boolean }> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { allowTable: true },
  })
  if (!store?.allowTable) {
    throw new AppError('Atendimento em mesa desativado nesta loja', 422)
  }

  // v2.7: lookup pelo accessToken (hash não-adivinhável). Se a mesa pertence
  // a outra loja, isolamento por subdomínio + filtro storeId garante 404.
  const table = await prisma.table.findUnique({
    where: { accessToken },
  })
  if (!table || table.storeId !== storeId) {
    throw new AppError('Mesa não encontrada — peça ao garçom o QR code atualizado', 404)
  }

  const existing = await prisma.tableSession.findFirst({
    where: { tableId: table.id, status: 'OPEN' },
  })
  if (existing) {
    return { token: existing.token, tableNumber: table.number, status: 'OPEN', isNew: false }
  }

  const token = generateToken()
  await prisma.$transaction([
    prisma.tableSession.create({
      data: { storeId, tableId: table.id, token, status: 'OPEN' },
    }),
    prisma.table.update({ where: { id: table.id }, data: { isOccupied: true } }),
  ])

  return { token, tableNumber: table.number, status: 'OPEN', isNew: true }
}

// v2.7: resolve hash → info pública da mesa (sem abrir sessão). Frontend usa
// pra validar que o link /mesa/:hash é válido e mostrar "Mesa N" antes do
// cliente confirmar nome.
export async function getTableByAccessToken(
  storeId: string,
  accessToken: string
): Promise<{ tableNumber: number }> {
  const table = await prisma.table.findUnique({
    where: { accessToken },
    select: { storeId: true, number: true },
  })
  if (!table || table.storeId !== storeId) {
    throw new AppError('Mesa não encontrada', 404)
  }
  return { tableNumber: table.number }
}

export async function getSession(
  storeId: string,
  token: string
): Promise<{ tableNumber: number; status: 'OPEN'; storeSlug: string }> {
  const session = await prisma.tableSession.findUnique({
    where: { token },
    include: { table: true, store: { select: { slug: true } } },
  })
  if (!session || session.storeId !== storeId) {
    throw new AppError('Sessão de mesa não encontrada', 404)
  }
  if (session.status !== 'OPEN') {
    throw new AppError('Esta mesa já foi fechada', 410)
  }
  return {
    tableNumber: session.table.number,
    status: 'OPEN',
    storeSlug: session.store.slug,
  }
}
