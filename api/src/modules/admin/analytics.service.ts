import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'

import type { RankingQuery, SalesQuery, TopProductsQuery } from './analytics.schema'

// ─── TASK-093: Serviço de Analytics ──────────────────────────────────────────

const CACHE_TTL = 10 * 60 // 10 min

const BRT_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export async function invalidateAnalyticsCache(storeId: string): Promise<void> {
  await Promise.all([
    cache.del(`analytics:sales:${storeId}:day`),
    cache.del(`analytics:sales:${storeId}:week`),
    cache.del(`analytics:sales:${storeId}:month`),
    cache.del(`analytics:top-products:${storeId}:day:4`),
    cache.del(`analytics:top-products:${storeId}:week:4`),
    cache.del(`analytics:top-products:${storeId}:month:4`),
    cache.del(`analytics:peak-hours:${storeId}`),
  ])
}

type SalesSummaryResult = {
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  cancelledCount: number
  timeline: { date: string; revenue: number; orders: number }[]
}

type TopProductsResult = {
  rank: number
  productId: string
  name: string
  quantity: number
  revenue: number
}[]

type PeakHoursResult = { hour: number; count: number }[]

type ClientRankingResult = {
  clients: {
    position: number
    clientId: string
    whatsapp: string
    name: string | null
    totalOrders: number
    totalSpent: number
    lastOrderAt: Date
  }[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** Retorna meia-noite BRT (03:00 UTC) de hoje */
function midnightBRT(): Date {
  const since = new Date()
  since.setUTCHours(3, 0, 0, 0)
  if (new Date() < since) since.setUTCDate(since.getUTCDate() - 1)
  return since
}

function getPeriodStart(period: string): Date {
  switch (period) {
    case 'day':
      return midnightBRT()
    case 'week': {
      const d = midnightBRT()
      d.setUTCDate(d.getUTCDate() - 7)
      return d
    }
    case 'month': {
      const d = midnightBRT()
      d.setUTCDate(d.getUTCDate() - 30)
      return d
    }
    default:
      return midnightBRT()
  }
}

export async function getSalesSummary(storeId: string, query: SalesQuery): Promise<SalesSummaryResult> {
  const cacheKey = `analytics:sales:${storeId}:${query.period}`
  const cached = await cache.get<SalesSummaryResult>(cacheKey)
  if (cached) return cached

  const since = getPeriodStart(query.period)

  const [orders, cancelledCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
        createdAt: { gte: since },
      },
      select: { total: true, createdAt: true },
    }),
    prisma.order.count({
      where: { storeId, status: 'CANCELLED', createdAt: { gte: since } },
    }),
  ])

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
  const totalOrders = orders.length
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Group by date for line chart (BRT timezone — evita split de pedidos feitos após 21h BRT)
  const byDate: Record<string, { revenue: number; orders: number }> = {}
  for (const order of orders) {
    const date = BRT_DATE_FORMAT.format(order.createdAt)
    if (!byDate[date]) byDate[date] = { revenue: 0, orders: 0 }
    byDate[date].revenue += order.total
    byDate[date].orders += 1
  }

  const timeline = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }))

  const result: SalesSummaryResult = { totalRevenue, totalOrders, averageTicket, cancelledCount, timeline }
  await cache.set(cacheKey, result, CACHE_TTL)
  return result
}

export async function getTopProducts(storeId: string, query: TopProductsQuery): Promise<TopProductsResult> {
  const cacheKey = `analytics:top-products:${storeId}:${query.period}:${query.limit}`
  const cached = await cache.get<TopProductsResult>(cacheKey)
  if (cached) return cached

  const since = getPeriodStart(query.period)

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        storeId,
        status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
        createdAt: { gte: since },
      },
    },
    select: { productName: true, quantity: true, totalPrice: true, productId: true },
  })

  const productMap: Record<string, { productId: string; name: string; quantity: number; revenue: number }> = {}
  for (const item of items) {
    if (!productMap[item.productId]) {
      productMap[item.productId] = { productId: item.productId, name: item.productName, quantity: 0, revenue: 0 }
    }
    productMap[item.productId].quantity += item.quantity
    productMap[item.productId].revenue += item.totalPrice
  }

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, query.limit)
    .map((p, i) => ({ rank: i + 1, ...p }))

  await cache.set(cacheKey, topProducts, CACHE_TTL)
  return topProducts
}

export async function getPeakHours(storeId: string): Promise<PeakHoursResult> {
  const cacheKey = `analytics:peak-hours:${storeId}`
  const cached = await cache.get<PeakHoursResult>(cacheKey)
  if (cached) return cached

  // Last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
      createdAt: { gte: since },
    },
    select: { createdAt: true },
  })

  // Count orders by hour (0-23) em BRT (UTC-3)
  const hourCounts = new Array(24).fill(0)
  for (const order of orders) {
    const utcHour = order.createdAt.getUTCHours()
    const brtHour = (utcHour - 3 + 24) % 24
    hourCounts[brtHour] += 1
  }

  const result: PeakHoursResult = hourCounts.map((count, hour) => ({ hour, count }))
  await cache.set(cacheKey, result, CACHE_TTL)
  return result
}

// ─── TASK-094: Ranking de Clientes ───────────────────────────────────────────

export async function getClientRanking(storeId: string, query: RankingQuery): Promise<ClientRankingResult> {
  const cacheKey = `analytics:ranking:${storeId}:${query.period}:${query.page}:${query.limit}:${query.search ?? ''}`
  const cached = await cache.get<ClientRankingResult>(cacheKey)
  if (cached) return cached

  const since =
    query.period === 'all'
      ? undefined
      : new Date(
          Date.now() -
            parseInt(query.period) * 24 * 60 * 60 * 1000
        )

  const whereOrder: Record<string, unknown> = {
    storeId,
    status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
  }
  if (since) whereOrder.createdAt = { gte: since }

  const orders = await prisma.order.findMany({
    where: whereOrder,
    select: {
      clientWhatsapp: true,
      clientName: true,
      total: true,
      createdAt: true,
      clientId: true,
    },
  })

  // Group by clientWhatsapp
  const clientMap: Record<
    string,
    { clientWhatsapp: string; name: string | null; orderCount: number; totalSpent: number; lastOrderAt: Date }
  > = {}

  for (const order of orders) {
    const key = order.clientWhatsapp
    if (!clientMap[key]) {
      clientMap[key] = {
        clientWhatsapp: key,
        name: order.clientName,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: order.createdAt,
      }
    }
    clientMap[key].orderCount += 1
    clientMap[key].totalSpent += order.total
    if (order.createdAt > clientMap[key].lastOrderAt) {
      clientMap[key].lastOrderAt = order.createdAt
    }
  }

  let ranked = Object.values(clientMap).sort((a, b) => b.totalSpent - a.totalSpent)

  if (query.search) {
    const q = query.search.toLowerCase()
    ranked = ranked.filter(
      (c) =>
        c.clientWhatsapp.includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    )
  }

  const total = ranked.length
  const totalPages = Math.max(1, Math.ceil(total / query.limit))
  const paginated = ranked
    .slice((query.page - 1) * query.limit, query.page * query.limit)
    .map((c, i) => ({
      position: (query.page - 1) * query.limit + i + 1,
      clientId: c.clientWhatsapp,
      whatsapp: c.clientWhatsapp,
      name: c.name,
      totalOrders: c.orderCount,
      totalSpent: c.totalSpent,
      lastOrderAt: c.lastOrderAt,
    }))

  const result: ClientRankingResult = {
    clients: paginated,
    total,
    page: query.page,
    limit: query.limit,
    totalPages,
  }
  await cache.set(cacheKey, result, 60) // 1 min cache for ranking
  return result
}

// ─── A-008: Detalhe do cliente (para modal) ──────────────────────────────────

type ClientDetailResult = {
  whatsapp: string
  name: string | null
  lastAddress: Record<string, unknown> | null
  totalOrders: number
  totalSpent: number
  averageTicket: number
  firstOrderAt: string | null
  lastOrderAt: string | null
}

export async function getClientDetail(storeId: string, whatsapp: string): Promise<ClientDetailResult> {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      clientWhatsapp: whatsapp,
      status: { notIn: ['CANCELLED', 'PENDING', 'WAITING_PAYMENT_PROOF'] },
    },
    select: {
      total: true,
      createdAt: true,
      clientName: true,
      address: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (orders.length === 0) {
    throw new AppError('Cliente não encontrado', 404)
  }

  const totalOrders = orders.length
  const totalSpent = orders.reduce((s, o) => s + o.total, 0)
  const averageTicket = totalOrders > 0 ? totalSpent / totalOrders : 0

  const latest = orders[0]
  const earliest = orders[orders.length - 1]

  return {
    whatsapp,
    name: latest.clientName ?? null,
    lastAddress: (latest.address as Record<string, unknown> | null) ?? null,
    totalOrders,
    totalSpent,
    averageTicket,
    firstOrderAt: earliest.createdAt.toISOString(),
    lastOrderAt: latest.createdAt.toISOString(),
  }
}
