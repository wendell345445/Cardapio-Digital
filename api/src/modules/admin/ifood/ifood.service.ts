import { AppError } from '../../../shared/middleware/error.middleware'
import { prisma } from '../../../shared/prisma/prisma'
import { getMerchant, listMerchants, type IFoodMerchant } from '../../../shared/ifood/ifood.service'

// ─── Conexão iFood (Fase 1) ───────────────────────────────────────────────────
// Modelo Centralizado: NÃO há userCode. O lojista autoriza o app "Menu Panda" no
// Portal do Parceiro iFood; daí o merchant aparece em listMerchants(). O fluxo aqui é:
// listar os merchants disponíveis → o lojista escolhe qual vincular a ESTA loja →
// gravamos o ifoodMerchantId. `@@unique` no schema impede vincular o mesmo merchant
// a duas lojas MenuPanda.

export interface IFoodConnectionStatus {
  status: 'DISCONNECTED' | 'CONNECTED'
  merchantId: string | null
  merchantName: string | null
  connectedAt: string | null
}

export async function getConnectionStatus(storeId: string): Promise<IFoodConnectionStatus> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ifoodMerchantId: true, ifoodStatus: true, ifoodConnectedAt: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)

  if (!store.ifoodMerchantId) {
    return { status: 'DISCONNECTED', merchantId: null, merchantName: null, connectedAt: null }
  }
  // Best-effort: busca o nome atual do merchant no iFood (não falha o status se der erro).
  let merchantName: string | null = null
  try {
    merchantName = (await getMerchant(store.ifoodMerchantId)).name
  } catch {
    /* mantém null — o vínculo continua válido */
  }
  return {
    status: 'CONNECTED',
    merchantId: store.ifoodMerchantId,
    merchantName,
    connectedAt: store.ifoodConnectedAt?.toISOString() ?? null,
  }
}

/**
 * Lista os merchants que o lojista já autorizou no Portal do Parceiro iFood.
 * Marca quais já estão vinculados a alguma loja MenuPanda (pra UI evitar duplicar).
 */
export async function listAvailableMerchants(
  storeId: string
): Promise<(IFoodMerchant & { linkedToThisStore: boolean; linkedElsewhere: boolean })[]> {
  const merchants = await listMerchants()
  if (merchants.length === 0) return []

  // Descobre quais merchantIds já estão em uso em qualquer loja.
  const ids = merchants.map((m) => m.id)
  const used = await prisma.store.findMany({
    where: { ifoodMerchantId: { in: ids } },
    select: { id: true, ifoodMerchantId: true },
  })
  const byMerchant = new Map(used.map((s) => [s.ifoodMerchantId, s.id]))

  return merchants.map((m) => ({
    ...m,
    linkedToThisStore: byMerchant.get(m.id) === storeId,
    linkedElsewhere: byMerchant.has(m.id) && byMerchant.get(m.id) !== storeId,
  }))
}

/** Vincula um merchant iFood a esta loja. */
export async function linkMerchant(storeId: string, merchantId: string, userId?: string): Promise<IFoodConnectionStatus> {
  // Valida que o merchant realmente pertence a este app (está na lista autorizada).
  const merchants = await listMerchants()
  const merchant = merchants.find((m) => m.id === merchantId)
  if (!merchant) {
    throw new AppError('Merchant não encontrado ou não autorizado no app iFood', 422)
  }

  // Impede vincular um merchant já usado por outra loja (o @@unique também protege).
  const conflict = await prisma.store.findFirst({
    where: { ifoodMerchantId: merchantId, id: { not: storeId } },
    select: { id: true },
  })
  if (conflict) {
    throw new AppError('Este merchant iFood já está vinculado a outra loja', 422)
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { ifoodMerchantId: merchantId, ifoodStatus: 'CONNECTED', ifoodConnectedAt: new Date() },
  })
  await prisma.auditLog.create({
    data: {
      storeId,
      userId: userId ?? null,
      action: 'store.ifood.connected',
      entity: 'Store',
      entityId: storeId,
      data: { merchantId, merchantName: merchant.name },
    },
  })

  return {
    status: 'CONNECTED',
    merchantId,
    merchantName: merchant.name,
    connectedAt: new Date().toISOString(),
  }
}

/** Desvincula o merchant iFood desta loja. */
export async function disconnect(storeId: string, userId?: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ifoodMerchantId: true } })
  if (!store) throw new AppError('Loja não encontrada', 404)

  await prisma.store.update({
    where: { id: storeId },
    data: { ifoodMerchantId: null, ifoodStatus: null, ifoodConnectedAt: null },
  })
  await prisma.auditLog.create({
    data: {
      storeId,
      userId: userId ?? null,
      action: 'store.ifood.disconnected',
      entity: 'Store',
      entityId: storeId,
      data: { merchantId: store.ifoodMerchantId },
    },
  })
}
