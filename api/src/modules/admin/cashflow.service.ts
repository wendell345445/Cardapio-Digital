import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'

import type {
  AdjustmentInput,
  CloseCashFlowInput,
  OpenCashFlowInput,
  UpdateInitialAmountInput,
} from './cashflow.schema'

// ─── TASK-095: Serviço de Controle de Caixa ──────────────────────────────────

async function requireOpenCashFlow(storeId: string, cashFlowId: string) {
  const cf = await prisma.cashFlow.findUnique({ where: { id: cashFlowId } })
  if (!cf || cf.storeId !== storeId) throw new AppError('Caixa não encontrado', 404)
  if (cf.status !== 'OPEN') throw new AppError('Caixa já está fechado', 422)
  return cf
}

export async function listCashFlows(storeId: string) {
  return prisma.cashFlow.findMany({
    where: { storeId },
    orderBy: { openedAt: 'desc' },
    include: {
      adjustments: { orderBy: { createdAt: 'asc' } },
      _count: { select: { items: true } },
    },
  })
}

export async function getCurrentCashFlow(storeId: string) {
  return prisma.cashFlow.findFirst({
    where: { storeId, status: 'OPEN' },
    include: {
      adjustments: { orderBy: { createdAt: 'asc' } },
      items: { include: { order: { select: { number: true, paymentMethod: true, total: true } } } },
    },
  })
}

export async function openCashFlow(
  storeId: string,
  input: OpenCashFlowInput,
  userId: string,
  ip?: string
) {
  const existing = await prisma.cashFlow.findFirst({ where: { storeId, status: 'OPEN' } })
  if (existing) throw new AppError('Já existe um caixa aberto', 422)

  const [cashFlow] = await prisma.$transaction([
    prisma.cashFlow.create({
      data: {
        storeId,
        openedAt: new Date(),
        initialAmount: input.initialAmount,
        status: 'OPEN',
      },
    }),
    // Caixa aberto = cardápio público fica online
    prisma.store.update({ where: { id: storeId }, data: { manualOpen: true } }),
  ])

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'cashflow.open',
      entity: 'CashFlow',
      entityId: cashFlow.id,
      data: { initialAmount: input.initialAmount },
      ip,
    },
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)
  emit.cashFlowUpdated(storeId, { type: 'opened', cashFlowId: cashFlow.id })
  return cashFlow
}

export async function updateInitialAmount(
  storeId: string,
  cashFlowId: string,
  input: UpdateInitialAmountInput,
  userId: string,
  ip?: string
) {
  const cf = await requireOpenCashFlow(storeId, cashFlowId)

  const updated = await prisma.cashFlow.update({
    where: { id: cashFlowId },
    data: { initialAmount: input.initialAmount },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'cashflow.update_initial_amount',
      entity: 'CashFlow',
      entityId: cashFlowId,
      data: { previous: cf.initialAmount, new: input.initialAmount },
      ip,
    },
  })

  return updated
}

export async function addAdjustment(
  storeId: string,
  cashFlowId: string,
  input: AdjustmentInput,
  userId: string,
  ip?: string
) {
  await requireOpenCashFlow(storeId, cashFlowId)

  const adjustment = await prisma.cashFlowAdjustment.create({
    data: {
      cashFlowId,
      type: input.type,
      amount: input.amount,
      notes: input.notes,
      userId,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: `cashflow.${input.type.toLowerCase()}`,
      entity: 'CashFlowAdjustment',
      entityId: adjustment.id,
      data: { type: input.type, amount: input.amount, notes: input.notes },
      ip,
    },
  })

  emit.cashFlowUpdated(storeId, { type: 'adjustment', cashFlowId, adjustment })
  return adjustment
}

export async function getCashFlowSummary(storeId: string, cashFlowId: string) {
  const cf = await prisma.cashFlow.findUnique({
    where: { id: cashFlowId },
    include: {
      adjustments: true,
      items: {
        include: { order: { select: { paymentMethod: true, total: true } } },
      },
    },
  })

  if (!cf || cf.storeId !== storeId) throw new AppError('Caixa não encontrado', 404)

  const CASH_METHODS = ['CASH', 'CASH_ON_DELIVERY'] as const
  const PIX_METHODS = ['PIX', 'PIX_ON_DELIVERY'] as const
  const CARD_METHODS = ['CREDIT', 'DEBIT', 'CREDIT_ON_DELIVERY', 'DEBIT_ON_DELIVERY'] as const

  const totalCash = cf.items
    .filter((i) => (CASH_METHODS as readonly string[]).includes(i.order.paymentMethod))
    .reduce((s, i) => s + i.amount, 0)
  const totalPix = cf.items
    .filter((i) => (PIX_METHODS as readonly string[]).includes(i.order.paymentMethod))
    .reduce((s, i) => s + i.amount, 0)
  const totalCard = cf.items
    .filter((i) => (CARD_METHODS as readonly string[]).includes(i.order.paymentMethod))
    .reduce((s, i) => s + i.amount, 0)
  const totalOrders = cf.items.reduce((s, i) => s + i.amount, 0)

  const totalSupply = cf.adjustments
    .filter((a) => a.type === 'SUPPLY')
    .reduce((s, a) => s + a.amount, 0)
  const totalBleed = cf.adjustments
    .filter((a) => a.type === 'BLEED')
    .reduce((s, a) => s + a.amount, 0)

  // Saldo físico esperado na gaveta = inicial + dinheiro + suprimento - sangria.
  // Pix e cartão são receita mas não entram no caixa físico.
  const expectedCash = cf.initialAmount + totalCash + totalSupply - totalBleed

  return {
    cashFlow: cf,
    summary: {
      totalOrders,
      totalCash,
      totalPix,
      totalCard,
      totalSupply,
      totalBleed,
      expectedCash,
      orderCount: cf.items.length,
    },
  }
}

export async function closeCashFlow(
  storeId: string,
  cashFlowId: string,
  input: CloseCashFlowInput,
  userId: string,
  ip?: string
) {
  await requireOpenCashFlow(storeId, cashFlowId)

  const { summary } = await getCashFlowSummary(storeId, cashFlowId)
  const difference = input.countedAmount - summary.expectedCash

  if (Math.abs(difference) > 0.01 && !input.justification) {
    throw new AppError('Justificativa obrigatória quando há diferença de caixa', 422)
  }

  const [closed] = await prisma.$transaction([
    prisma.cashFlow.update({
      where: { id: cashFlowId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        countedAmount: input.countedAmount,
        closedDifference: difference,
        closedJustification: input.justification ?? null,
      },
      include: { adjustments: true, items: true },
    }),
    // Caixa fechado = cardápio público fica offline
    prisma.store.update({ where: { id: storeId }, data: { manualOpen: false } }),
  ])

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'cashflow.close',
      entity: 'CashFlow',
      entityId: cashFlowId,
      data: {
        countedAmount: input.countedAmount,
        expectedCash: summary.expectedCash,
        difference,
        justification: input.justification,
      },
      ip,
    },
  })

  await cache.del(`menu:${storeId}`)
  emit.menuUpdated(storeId)
  emit.cashFlowUpdated(storeId, { type: 'closed', cashFlowId })
  return { cashFlow: closed, summary: { ...summary, countedAmount: input.countedAmount, difference } }
}

/**
 * Links a confirmed order to the currently open cash flow.
 * Called internally when order status → CONFIRMED.
 */
export async function linkOrderToCashFlow(storeId: string, orderId: string) {
  const cashFlow = await prisma.cashFlow.findFirst({ where: { storeId, status: 'OPEN' } })
  if (!cashFlow) return // No open cash flow, skip

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { total: true, paymentMethod: true },
  })
  if (!order) return

  // Avoid duplicate
  const existing = await prisma.cashFlowItem.findUnique({ where: { orderId } })
  if (existing) return

  await prisma.cashFlowItem.create({
    data: {
      cashFlowId: cashFlow.id,
      orderId,
      amount: order.total,
      paymentMethod: order.paymentMethod,
    },
  })
}
