import { randomBytes } from 'crypto'

import { hash } from 'bcrypt'

import { createCustomer, updateSubscription } from '../../shared/asaas/asaas.service'
import {
  PLAN_FEATURES,
  PLAN_VALUES,
  trialEndsAtFromNow,
} from '../../shared/billing/plans'
import { sendPlanChangeEmail, sendWelcomeEmail } from '../../shared/email/email.service'
import { getTrialSuspensionQueue } from '../../jobs/trial-suspension.job'
import { asaasLogger } from '../../shared/logger/logger'
import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import type { CreateStoreInput, UpdateStoreInput, UpdateStorePlanInput } from './owner.schema'

// Alias local pra manter a leitura do cálculo de MRR (valor mensal por plano).
const PLAN_MRR = PLAN_VALUES

// ─── TASK-020: Listar lojas ───────────────────────────────────────────────────

export async function listStores(status?: string) {
  const stores = await prisma.store.findMany({
    where: status ? { status: status as any } : undefined,
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      createdAt: true,
      asaasSubscriptionId: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const activeCount = stores.filter((s) => s.status === 'ACTIVE').reduce(
    (acc, s) => acc + (PLAN_MRR[s.plan] ?? 0),
    0
  )

  return {
    stores: stores.map((s) => ({
      ...s,
      planMrr: s.status === 'ACTIVE' ? PLAN_MRR[s.plan] ?? 0 : 0,
    })),
    mrr: activeCount,
  }
}

// ─── TASK-021: Criar loja ─────────────────────────────────────────────────────

export async function createStore(data: CreateStoreInput, ownerId: string, ip?: string) {
  // RN-001: slug único global
  const existingSlug = await prisma.store.findUnique({ where: { slug: data.slug } })
  if (existingSlug) throw new AppError('Slug já em uso', 422)

  // RN-002: email de admin não pode estar em outra loja
  const existingEmail = await prisma.user.findFirst({ where: { email: data.adminEmail } })
  if (existingEmail) throw new AppError('Email já cadastrado em outra loja', 422)

  // Gerar senha temporária
  const tempPassword = randomBytes(6).toString('hex')
  const passwordHash = await hash(tempPassword, 12)

  // Criar Asaas Customer. A assinatura (cartão/PIX Automático) é criada depois pelo lojista.
  const asaasCustomer = await createCustomer({ name: data.name, email: data.adminEmail, phone: data.whatsapp })
  const trialEndsAt = trialEndsAtFromNow()

  // Criar Store + User + BusinessHours em transação
  const store = await prisma.$transaction(async (tx) => {
    const newStore = await tx.store.create({
      data: {
        name: data.name,
        slug: data.slug,
        plan: data.plan as any,
        status: 'TRIAL',
        phone: data.whatsapp,
        features: PLAN_FEATURES[data.plan],
        whatsappMode: (data.whatsappMode ?? 'WHATSAPP') as any,
        asaasCustomerId: asaasCustomer.id,
        trialEndsAt,
      },
    })

    await tx.user.create({
      data: {
        email: data.adminEmail,
        name: data.adminName ?? data.name,
        role: 'ADMIN',
        storeId: newStore.id,
        passwordHash,
        isActive: true,
      },
    })

    // BusinessHours padrão: Seg-Dom 18h-23h
    await tx.businessHour.createMany({
      data: Array.from({ length: 7 }, (_, i) => ({
        storeId: newStore.id,
        dayOfWeek: i,
        openTime: '18:00',
        closeTime: '23:00',
        isClosed: false,
      })),
    })

    await tx.auditLog.create({
      data: {
        storeId: newStore.id,
        userId: ownerId,
        action: 'store.create',
        entity: 'Store',
        entityId: newStore.id,
        data: { name: data.name, slug: data.slug, plan: data.plan },
        ip,
      },
    })

    return newStore
  })

  // Enviar email de boas-vindas — loginUrl derivada do PUBLIC_ROOT_DOMAIN (mesma lógica do auto-cadastro).
  // FRONTEND_URL era um env legado duplicado do WEB_URL — removido em favor de derivar do PUBLIC_ROOT_DOMAIN.
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.ai'
  const protocol = rootDomain.endsWith('.test') || rootDomain === 'localhost' ? 'http' : 'https'
  const loginUrl = `${protocol}://${rootDomain}/login`
  await sendWelcomeEmail({
    adminEmail: data.adminEmail,
    adminName: data.adminName ?? data.name,
    storeName: data.name,
    tempPassword,
    loginUrl,
  }).catch((err) => console.error('[EMAIL] Failed to send welcome email:', err))

  return store
}

// ─── TASK-022: Detalhes + Editar + Cancelar loja ──────────────────────────────

export async function getStore(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      users: {
        where: { role: 'ADMIN' },
        select: { id: true, email: true, name: true },
      },
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
    },
  })

  if (!store) throw new AppError('Loja não encontrada', 404)

  return store
}

export async function updateStore(
  storeId: string,
  data: UpdateStoreInput,
  ownerId: string,
  ip?: string
) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)

  const updated = await prisma.store.update({
    where: { id: storeId },
    data,
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId: ownerId,
      action: 'store.update',
      entity: 'Store',
      entityId: storeId,
      data,
      ip,
    },
  })

  return updated
}

export async function cancelStore(storeId: string, ownerId: string, ip?: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)
  if (store.status === 'CANCELLED') throw new AppError('Loja já está cancelada', 422)

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: { status: 'CANCELLED' },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId: ownerId,
      action: 'store.cancel',
      entity: 'Store',
      entityId: storeId,
      data: { previousStatus: store.status },
      ip,
    },
  })

  return updated
}

// ─── TASK-023: Upgrade/Downgrade plano ────────────────────────────────────────

export async function updateStorePlan(
  storeId: string,
  data: UpdateStorePlanInput,
  ownerId: string,
  ip?: string
) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      users: { where: { role: 'ADMIN' }, select: { email: true, name: true } },
    },
  })

  if (!store) throw new AppError('Loja não encontrada', 404)
  if (store.plan === data.plan) throw new AppError('Loja já está neste plano', 422)

  // Asaas: se a loja assinou por CARTÃO (tem asaasSubscriptionId), atualiza o valor
  // da assinatura no Asaas. Se assinou por PIX Automático (asaasPixAuthId) ou ainda
  // está em trial sem assinatura, só troca plano/features local — a nova cobrança usa
  // o valor do novo plano no próximo ciclo (PIX Auto não tem update de valor simples;
  // troca de valor exige cancelar+recriar a autorização, feito pelo lojista via aba
  // Assinatura). Best-effort no update do cartão — falha não bloqueia a troca local.
  if (store.asaasSubscriptionId) {
    try {
      await updateSubscription(store.asaasSubscriptionId, PLAN_VALUES[data.plan])
    } catch (err) {
      asaasLogger.warn(
        { err, storeId, subscriptionId: store.asaasSubscriptionId },
        'updateSubscription falhou — seguindo com update local do plano'
      )
    }
  }

  // RN: downgrade para PROFESSIONAL → rebaixar whatsappMode para WHATSAPP
  const whatsappModeUpdate =
    data.plan === 'PROFESSIONAL' ? { whatsappMode: 'WHATSAPP' as const } : {}

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      plan: data.plan as any,
      features: PLAN_FEATURES[data.plan],
      ...whatsappModeUpdate,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId: ownerId,
      action: 'store.plan.update',
      entity: 'Store',
      entityId: storeId,
      data: { oldPlan: store.plan, newPlan: data.plan },
      ip,
    },
  })

  const adminUser = store.users[0]
  if (adminUser?.email) {
    await sendPlanChangeEmail({
      adminEmail: adminUser.email,
      adminName: adminUser.name ?? store.name,
      storeName: store.name,
      oldPlan: store.plan,
      newPlan: data.plan,
    }).catch((err) => console.error('[EMAIL] Failed to send plan change email:', err))
  }

  return updated
}

// ─── OWNER TOOL: Encerrar trial agora ─────────────────────────────────────────
//
// Endpoint operacional do Owner — disponível em todos os ambientes (dev e prod).
// Encerra o trial de uma loja imediatamente sem esperar o ciclo natural de 7 dias,
// útil pra validar o fluxo end-to-end ou pra agir sobre uma loja específica.
//
// Fluxo disparado:
//   1) `trialEndsAt = NOW - 1s` no DB local — sobrescreve o end-date original pra fazer
//      o sweep enxergar a loja como expirada imediatamente. Como o trial é 100% local
//      no Asaas, este é o único passo que importa (não há chamada ao provedor).
//   2) Enfileira sweep one-shot no `trial-suspension.job` queue (não-repetível) pra
//      não esperar o cron diário das 03:00. O sweep encontra a loja, muda pra
//      SUSPENDED e dispara o email `trial-suspended.html`.
//
// Resultado: ciclo trial → trialEndsAt no passado → sweep → SUSPENDED → email
// em ~2-5s. Exercita o mesmo code path do sweep diário em produção.

export async function endTrialNow(storeId: string, ownerId: string, ip?: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)
  if (store.status !== 'TRIAL') {
    throw new AppError(`Loja não está em trial (status atual: ${store.status})`, 422)
  }

  // 1) Sobrescreve trialEndsAt no passado → torna a loja elegível pra suspensão
  //    imediata no próximo sweep. Trial é local, então não há chamada ao Asaas.
  await prisma.store.update({
    where: { id: storeId },
    data: { trialEndsAt: new Date(Date.now() - 1000) },
  })

  // 3) Enfileira sweep one-shot pra não esperar o cron diário
  await getTrialSuspensionQueue().add(
    {},
    { removeOnComplete: true, removeOnFail: true }
  )

  // 4) Audit log — rastreabilidade do uso do dev tool
  await prisma.auditLog.create({
    data: {
      storeId,
      userId: ownerId,
      action: 'store.trial.ended.dev',
      entity: 'Store',
      entityId: storeId,
      data: { reason: 'owner-dev-tool', asaasSubscriptionId: store.asaasSubscriptionId },
      ip,
    },
  })

  return { ok: true, storeId, message: 'Trial encerrado e sweep enfileirado' }
}

// ─── TASK-024: Audit Logs ─────────────────────────────────────────────────────

export async function getAuditLogs(
  storeId: string,
  params: { page: number; limit: number; action?: string; userId?: string; from?: Date; to?: Date }
) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)

  const where: any = { storeId }
  if (params.action) where.action = { contains: params.action }
  if (params.userId) where.userId = params.userId
  if (params.from || params.to) {
    where.createdAt = {}
    if (params.from) where.createdAt.gte = params.from
    if (params.to) where.createdAt.lte = params.to
  }

  const skip = (params.page - 1) * params.limit

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      pages: Math.ceil(total / params.limit),
    },
  }
}
