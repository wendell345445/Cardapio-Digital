import { AppError } from '../../../shared/middleware/error.middleware'
import { prisma } from '../../../shared/prisma/prisma'
import { getMerchant, listMerchants } from '../../../shared/ifood/ifood.service'

// ─── Conexão iFood (Fase 1) ───────────────────────────────────────────────────
// Modelo Centralizado: 1 clientId da plataforma → N merchants. O lojista autoriza
// o app "Menu Panda" no Portal do Parceiro iFood (logado na conta iFood DELE);
// daí o merchant passa a aparecer em listMerchants().
//
// ⚠️ ISOLAMENTO MULTI-TENANT: listMerchants() é GLOBAL (retorna todos os merchants
// que autorizaram o app, de TODAS as lojas). Por isso NÃO expomos essa lista pro
// lojista escolher (vazaria razão social de terceiros e permitiria reivindicar o
// merchant órfão de outro). Em vez disso, o lojista INFORMA o merchantId da própria
// loja (UUID que só ele vê no Portal dele). Validamos que o merchant existe na lista
// autorizada e que não está vinculado a outra loja (@@unique como defesa extra).
// O userCode (prova de posse forte) NÃO funciona no app Centralizado — confirmado
// ao vivo: "grant type not authorized". Ver ADR-0xx-ifood-tenant-isolation.

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

export interface MerchantPreview {
  id: string
  name: string
  corporateName: string | null
  city: string | null
  state: string | null
}

/**
 * Valida um merchantId que o LOJISTA informou (copiado do Portal dele) e devolve os
 * dados da loja pra ele conferir antes de vincular. NÃO lista os merchants dos outros
 * — o lojista precisa saber o próprio UUID. Já barra merchant vinculado a outra loja.
 */
export async function previewMerchant(storeId: string, merchantId: string): Promise<MerchantPreview> {
  // Existe na lista autorizada deste app? (o dono precisa ter autorizado o app no Portal)
  const merchants = await listMerchants()
  const inList = merchants.find((m) => m.id === merchantId)
  if (!inList) {
    throw new AppError(
      'Loja iFood não encontrada. Confirme o ID e que você autorizou o app "Menu Panda" no Portal do Parceiro iFood.',
      422
    )
  }

  // Já vinculado a outra loja MenuPanda?
  const conflict = await prisma.store.findFirst({
    where: { ifoodMerchantId: merchantId, id: { not: storeId } },
    select: { id: true },
  })
  if (conflict) {
    throw new AppError('Esta loja iFood já está vinculada a outra loja no Menu Panda', 422)
  }

  // Detalhes pra conferência (best-effort — se getMerchant falhar, usa o resumo da lista).
  let detail: Awaited<ReturnType<typeof getMerchant>> | null = null
  try {
    detail = await getMerchant(merchantId)
  } catch {
    /* usa o resumo da lista */
  }
  const address = (detail as { address?: { city?: string; state?: string } } | null)?.address
  return {
    id: merchantId,
    name: inList.name,
    corporateName: inList.corporateName ?? detail?.corporateName ?? null,
    city: address?.city ?? null,
    state: address?.state ?? null,
  }
}

/** Vincula um merchant iFood a esta loja (merchantId informado pelo lojista). */
export async function linkMerchant(storeId: string, merchantId: string, userId?: string): Promise<IFoodConnectionStatus> {
  // Valida que o merchant realmente pertence a este app (está na lista autorizada).
  const merchants = await listMerchants()
  const merchant = merchants.find((m) => m.id === merchantId)
  if (!merchant) {
    throw new AppError(
      'Loja iFood não encontrada. Confirme o ID e que você autorizou o app "Menu Panda" no Portal do Parceiro iFood.',
      422
    )
  }

  // Impede vincular um merchant já usado por outra loja (o @@unique também protege).
  const conflict = await prisma.store.findFirst({
    where: { ifoodMerchantId: merchantId, id: { not: storeId } },
    select: { id: true },
  })
  if (conflict) {
    throw new AppError('Esta loja iFood já está vinculada a outra loja no Menu Panda', 422)
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
