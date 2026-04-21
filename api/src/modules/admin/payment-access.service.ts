import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import type { AddPaymentAccessByWhatsappInput, AddPaymentAccessInput } from './payment-access.schema'

// ─── TASK-054: Blacklist e Whitelist de Clientes ─────────────────────────────

/**
 * Lista clientes da loja que já fizeram pelo menos 1 pedido.
 * Inclui o tipo de acesso atual (BLACKLIST | WHITELIST | null).
 */
export async function listStoreClients(storeId: string) {
  const clients = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      OR: [
        { ordersAsClient: { some: { storeId } } },
        { clientAccessLists: { some: { storeId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      email: true,
      clientAccessLists: {
        where: { storeId },
        select: { id: true, type: true },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  })

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    whatsapp: c.whatsapp,
    email: c.email,
    accessType: c.clientAccessLists[0]?.type ?? null,
    accessId: c.clientAccessLists[0]?.id ?? null,
  }))
}

/**
 * Adiciona cliente à blacklist ou whitelist da loja.
 * Apenas clientes com histórico na loja podem ser adicionados.
 */
export async function addPaymentAccess(
  storeId: string,
  data: AddPaymentAccessInput,
  userId: string,
  ip?: string
) {
  const { clientId, type } = data

  // Verificar que o cliente tem histórico na loja
  const hasOrder = await prisma.order.findFirst({
    where: { storeId, clientId },
  })

  if (!hasOrder) {
    throw new AppError('Cliente não possui histórico nessa loja', 422)
  }

  // Verificar que o cliente existe com role CLIENT
  const client = await prisma.user.findUnique({ where: { id: clientId } })
  if (!client || client.role !== 'CLIENT') {
    throw new AppError('Cliente não encontrado', 404)
  }

  // Remover entrada anterior (se existir) para garantir unicidade de tipo
  await prisma.clientPaymentAccess.deleteMany({
    where: { storeId, clientId },
  })

  const access = await prisma.clientPaymentAccess.create({
    data: { storeId, clientId, type },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: `store.payment-access.add`,
      entity: 'ClientPaymentAccess',
      entityId: access.id,
      data: { clientId, type },
      ip,
    },
  })

  return access
}

/**
 * Remove cliente da blacklist/whitelist da loja.
 */
export async function removePaymentAccess(
  storeId: string,
  clientId: string,
  userId: string,
  ip?: string
) {
  const access = await prisma.clientPaymentAccess.findFirst({
    where: { storeId, clientId },
  })

  if (!access) {
    throw new AppError('Entrada não encontrada', 404)
  }

  await prisma.clientPaymentAccess.delete({ where: { id: access.id } })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.payment-access.remove',
      entity: 'ClientPaymentAccess',
      entityId: access.id,
      data: { clientId, type: access.type },
      ip,
    },
  })
}

/**
 * ADR-0002: adiciona cliente à blacklist/whitelist informando WhatsApp.
 * Cria um User CLIENT se não existir (storeId + whatsapp). Não exige histórico de pedido.
 */
export async function addPaymentAccessByWhatsapp(
  storeId: string,
  data: AddPaymentAccessByWhatsappInput,
  userId: string,
  ip?: string
) {
  const { whatsapp, name, type } = data

  let client = await prisma.user.findFirst({
    where: { whatsapp, storeId, role: 'CLIENT' },
  })

  const createdNewUser = !client

  if (!client) {
    const fallbackName = name?.trim() || `Cliente ${whatsapp.slice(-4)}`
    client = await prisma.user.create({
      data: {
        whatsapp,
        storeId,
        role: 'CLIENT',
        name: fallbackName,
        isActive: true,
      },
    })
  } else if (name?.trim() && !client.name) {
    client = await prisma.user.update({
      where: { id: client.id },
      data: { name: name.trim() },
    })
  }

  await prisma.clientPaymentAccess.deleteMany({
    where: { storeId, clientId: client.id },
  })

  const access = await prisma.clientPaymentAccess.create({
    data: { storeId, clientId: client.id, type },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'store.payment-access.add-by-whatsapp',
      entity: 'ClientPaymentAccess',
      entityId: access.id,
      data: { whatsapp, name: name ?? null, type, clientId: client.id, createdNewUser },
      ip,
    },
  })

  return { clientId: client.id, accessId: access.id, type, createdNewUser }
}

/**
 * Determina quais métodos de pagamento o cliente pode ver no checkout.
 * Regras:
 *  - allowCashOnDelivery=true + cliente em BLACKLIST → não vê "pagar na entrega"
 *  - allowCashOnDelivery=false + cliente em WHITELIST → vê "pagar na entrega"
 *  - allowCashOnDelivery=false + cliente não está em WHITELIST → não vê "pagar na entrega"
 */
export async function getPaymentMethodsForClient(clientId: string | null, storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      allowCashOnDelivery: true,
      allowPickup: true,
      features: true,
    },
  })

  if (!store) throw new AppError('Loja não encontrada', 404)

  const features = (store.features as Record<string, unknown>) ?? {}
  const allowPix = features.allowPix !== false // padrão: permitido

  let canPayOnDelivery = store.allowCashOnDelivery

  if (clientId) {
    const access = await prisma.clientPaymentAccess.findFirst({
      where: { storeId, clientId },
    })

    if (store.allowCashOnDelivery && access?.type === 'BLACKLIST') {
      canPayOnDelivery = false
    }

    if (!store.allowCashOnDelivery && access?.type === 'WHITELIST') {
      canPayOnDelivery = true
    }
  } else {
    // Cliente desconhecido: não está em whitelist
    if (!store.allowCashOnDelivery) {
      canPayOnDelivery = false
    }
  }

  return {
    pix: allowPix,
    cashOnDelivery: canPayOnDelivery,
    pickup: store.allowPickup,
  }
}
