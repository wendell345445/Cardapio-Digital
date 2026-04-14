import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { getActiveProductPromos } from '../admin/coupons.service'

// ─── TASK-060: Menu Público ───────────────────────────────────────────────────

type StoreStatus = 'open' | 'closed' | 'suspended'

function calcStoreStatus(store: {
  status: string
  manualOpen: boolean | null
  businessHours: Array<{
    dayOfWeek: number
    openTime: string | null
    closeTime: string | null
    isClosed: boolean
  }>
}): StoreStatus {
  if (store.status === 'SUSPENDED') return 'suspended'

  if (store.manualOpen === false) return 'closed'
  if (store.manualOpen === true) return 'open'

  // manualOpen === null → verifica horário de funcionamento (UTC-3 = BRT)
  const now = new Date()
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const dayOfWeek = brt.getUTCDay()
  const hh = String(brt.getUTCHours()).padStart(2, '0')
  const mm = String(brt.getUTCMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  const todayHour = store.businessHours.find((bh) => bh.dayOfWeek === dayOfWeek)

  if (!todayHour || todayHour.isClosed) return 'closed'
  if (!todayHour.openTime || !todayHour.closeTime) return 'closed'

  if (currentTime >= todayHour.openTime && currentTime <= todayHour.closeTime) {
    return 'open'
  }

  return 'closed'
}

export async function getMenu(slug: string) {
  // Tenta cache primeiro
  const cached = await cache.get<unknown>(`menu:${slug}`)
  if (cached) return cached

  // Busca store pelo slug
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logo: true,
      address: true,
      phone: true,
      pixKey: true,
      pixKeyType: true,
      allowCashOnDelivery: true,
      allowPickup: true,
      allowCreditCard: true,
      manualOpen: true,
      features: true,
      plan: true,
      status: true,
      businessHours: {
        select: {
          dayOfWeek: true,
          openTime: true,
          closeTime: true,
          isClosed: true,
        },
      },
    },
  })

  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  const storeStatus = calcStoreStatus({
    status: store.status,
    manualOpen: store.manualOpen,
    businessHours: store.businessHours,
  })

  // Busca categorias ativas com produtos ativos
  const categories = await prisma.category.findMany({
    where: {
      storeId: store.id,
      isActive: true,
    },
    include: {
      products: {
        where: { isActive: true },
        include: {
          variations: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
          },
          additionals: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  const { businessHours: _bh, ...storeData } = store

  // Anexa preço promocional quando houver promo ativa pro produto.
  const promos = await getActiveProductPromos(store.id)
  const categoriesWithPromos = categories.map((cat) => ({
    ...cat,
    products: cat.products.map((p) => {
      const promo = promos.get(p.id)
      return promo
        ? {
            ...p,
            promoPrice: promo.promoPrice,
            promoStartsAt: promo.startsAt,
            promoExpiresAt: promo.expiresAt,
          }
        : p
    }),
  }))

  const result = {
    store: { ...storeData, storeStatus },
    categories: categoriesWithPromos,
  }

  // Salva no cache com TTL de 5 minutos
  await cache.setMenu(store.id, result)

  return result
}
