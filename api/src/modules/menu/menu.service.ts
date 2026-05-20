import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { getActiveProductPromos } from '../admin/coupons.service'

// ─── TASK-060: Menu Público ───────────────────────────────────────────────────

type StoreStatus = 'open' | 'closed' | 'suspended'

type BusinessHour = {
  dayOfWeek: number
  openTime: string | null
  closeTime: string | null
  isClosed: boolean
}

const DAY_LABELS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// Monta o endereço de exibição (2 linhas) a partir dos campos estruturados.
// Retorna null se não tiver dados suficientes — o caller usa fallback no
// campo legado `Store.address`.
function formatStoreAddress(s: {
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  cep?: string | null
}): string | null {
  const street = (s.street ?? '').trim()
  if (!street) return null

  const number = (s.number ?? '').trim()
  const neighborhood = (s.neighborhood ?? '').trim()
  const city = (s.city ?? '').trim()
  const state = (s.state ?? '').trim()
  const cep = (s.cep ?? '').trim()

  // Linha 1: "Rua, número - Bairro" (omite parts vazias).
  const line1Parts: string[] = []
  line1Parts.push(number ? `${street}, ${number}` : street)
  if (neighborhood) line1Parts.push(neighborhood)
  const line1 = line1Parts.join(' - ')

  // Linha 2: "Cidade UF CEP" (qualquer combinação que não fique vazia).
  const line2 = [city && state ? `${city} ${state}` : city || state, cep].filter(Boolean).join(' ')

  return [line1, line2].filter(Boolean).join('\n')
}

function nowBrt(): Date {
  const now = new Date()
  return new Date(now.getTime() - 3 * 60 * 60 * 1000)
}

// Cardápio público só fica "open" se AS DUAS condições baterem:
//   1) manualOpen === true (owner abriu o caixa no admin)
//   2) horário atual dentro de businessHours do dia
// Owner fechar o caixa OU sair do horário → 'closed'.
function calcStoreStatus(store: {
  status: string
  manualOpen: boolean
  businessHours: BusinessHour[]
}): StoreStatus {
  if (store.status === 'SUSPENDED') return 'suspended'
  if (!store.manualOpen) return 'closed'

  const brt = nowBrt()
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

// Procura o próximo horário de abertura nos próximos 7 dias e devolve label
// pronto pro frontend ("hoje às 18:00", "amanhã às 18:00", "sexta às 18:00").
// Retorna null se caixa fechado (sem ETA — owner reabre quando quiser) ou se
// nenhum dia da semana tem horário válido.
function calcNextOpenLabel(
  manualOpen: boolean,
  businessHours: BusinessHour[],
): string | null {
  if (!manualOpen) return null
  if (businessHours.length === 0) return null

  const brt = nowBrt()
  const todayDow = brt.getUTCDay()
  const currentTime = `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`

  for (let offset = 0; offset < 7; offset++) {
    const dow = (todayDow + offset) % 7
    const bh = businessHours.find((h) => h.dayOfWeek === dow)
    if (!bh || bh.isClosed || !bh.openTime || !bh.closeTime) continue

    // Hoje, mas o horário de abertura ainda não chegou → conta.
    // Hoje, mas já passou da abertura → pula (ou já estaria aberta, ou fechou).
    if (offset === 0 && currentTime >= bh.openTime) continue

    const prefix = offset === 0 ? 'hoje' : offset === 1 ? 'amanhã' : DAY_LABELS[dow]
    return `${prefix} às ${bh.openTime}`
  }

  return null
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
      primaryColor: true,
      secondaryColor: true,
      // Campo legado (v2.5 deprecated) — usado como fallback se a loja
      // ainda não migrou pros campos estruturados.
      address: true,
      // addressLabel: string formatado salvo pelo Google Places em "Entregas →
      // Localização da loja" (ex: "R. Sebastião dos Santos, 384 - Parque
      // Continental I, Guarulhos - SP, 07077-190"). Tem prioridade no header.
      addressLabel: true,
      cep: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      phone: true,
      pixKey: true,
      pixKeyType: true,
      allowCashOnDelivery: true,
      allowPickup: true,
      allowDelivery: true,
      deliveryByDistanceEnabled: true,
      deliveryByNeighborhoodEnabled: true,
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

  const nextOpenLabel =
    storeStatus === 'closed' ? calcNextOpenLabel(store.manualOpen, store.businessHours) : null

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
          // v2.9: adicionais via ProductAddon (N:N). Filtra Addon ativo + AddonCategory ativa.
          // Frontend agrupa por addon.category.id no render.
          addons: {
            where: { addon: { isActive: true, category: { isActive: true } } },
            orderBy: [{ order: 'asc' }],
            include: {
              addon: { include: { category: true } },
            },
          },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  const { businessHours: _bh, ...storeData } = store

  // Endereço pra exibição no header do cardápio. Ordem de prioridade:
  //  1. addressLabel (string formatada do Google Places — fluxo atual)
  //  2. campos estruturados cep/street/number/etc compostos
  //  3. campo legado `address` (v2.5 deprecated) como último recurso
  const composedAddress = formatStoreAddress(storeData)
  const finalAddress =
    storeData.addressLabel?.trim() || composedAddress || storeData.address || null

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
    store: { ...storeData, address: finalAddress, storeStatus, nextOpenLabel },
    categories: categoriesWithPromos,
  }

  // Salva no cache com TTL de 5 minutos
  await cache.setMenu(store.id, result)

  return result
}
