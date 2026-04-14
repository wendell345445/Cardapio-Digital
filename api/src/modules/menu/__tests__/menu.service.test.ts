// ─── TASK-060/062: Menu Público — Unit Tests ──────────────────────────────────
// Cobre: getMenu, calcStoreStatus (status manual + horário + suspensão)

jest.mock('../../../shared/prisma/prisma', () => ({
  prisma: {
    store: { findUnique: jest.fn() },
    category: { findMany: jest.fn() },
    coupon: { findMany: jest.fn() },
  },
}))

jest.mock('../../../shared/redis/redis', () => ({
  cache: {
    get: jest.fn(),
    setMenu: jest.fn(),
    del: jest.fn(),
  },
}))

import { prisma } from '../../../shared/prisma/prisma'
import { cache } from '../../../shared/redis/redis'
import { getMenu } from '../menu.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockCache = cache as jest.Mocked<typeof cache>

const SLUG = 'pizzaria-do-ze'
const STORE_ID = 'store-1'

// Horário que cobre toda a semana (sempre aberto nos testes)
const openAllWeekHours = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  openTime: '00:00',
  closeTime: '23:59',
  isClosed: false,
}))

const mockStore = {
  id: STORE_ID,
  name: 'Pizzaria do Zé',
  slug: SLUG,
  description: 'As melhores pizzas',
  logo: null,
  address: 'Rua A, 123',
  phone: '5548999990000',
  pixKey: null,
  pixKeyType: null,
  allowCashOnDelivery: true,
  allowPickup: false,
  manualOpen: null,
  features: { allowPix: true },
  plan: 'PROFESSIONAL',
  status: 'ACTIVE',
  businessHours: openAllWeekHours,
}

const mockCategories = [
  {
    id: 'cat-1',
    storeId: STORE_ID,
    name: 'Pizzas',
    order: 0,
    isActive: true,
    products: [],
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  // Default: nenhuma promoção ativa (getActiveProductPromos vai retornar []).
  ;(mockPrisma.coupon.findMany as jest.Mock).mockResolvedValue([])
})

// ─── getMenu — cache hit ───────────────────────────────────────────────────────

describe('getMenu — cache', () => {
  it('retorna resultado do cache sem chamar o banco', async () => {
    const cached = { store: { id: STORE_ID }, categories: [] }
    ;(mockCache.get as jest.Mock).mockResolvedValue(cached)

    const result = await getMenu(SLUG)

    expect(mockCache.get).toHaveBeenCalledWith(`menu:${SLUG}`)
    expect(result).toBe(cached)
    expect(mockPrisma.store.findUnique).not.toHaveBeenCalled()
  })
})

// ─── getMenu — banco + cache miss ─────────────────────────────────────────────

describe('getMenu — banco', () => {
  beforeEach(() => {
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(mockStore)
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories)
    ;(mockCache.setMenu as jest.Mock).mockResolvedValue(undefined)
  })

  it('retorna store + categories e salva no cache', async () => {
    const result = await getMenu(SLUG) as any

    expect(mockPrisma.store.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: SLUG } })
    )
    expect(result.store.id).toBe(STORE_ID)
    expect(result.categories).toHaveLength(1)
    expect(mockCache.setMenu).toHaveBeenCalledWith(STORE_ID, result)
  })

  it('lança 404 quando loja não existe', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(getMenu(SLUG)).rejects.toMatchObject({ status: 404 })

    expect(mockCache.setMenu).not.toHaveBeenCalled()
  })

  it('não expõe businessHours na resposta (campo interno removido)', async () => {
    const result = await getMenu(SLUG) as any

    expect(result.store.businessHours).toBeUndefined()
  })

  it('filtra apenas categorias ativas com produtos ativos', async () => {
    await getMenu(SLUG)

    expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: STORE_ID, isActive: true },
        include: expect.objectContaining({
          products: expect.objectContaining({
            where: { isActive: true },
          }),
        }),
      })
    )
  })
})

// ─── calcStoreStatus — via getMenu (status no retorno) ────────────────────────

describe('calcStoreStatus — integrado via getMenu', () => {
  // Tempo fixo: terça-feira 15:00 BRT (= 18:00 UTC). Longe de meia-noite,
  // evita flakiness por TZ ou borda de dia. brt.getUTCDay() = 2.
  const FIXED_DAY_OF_WEEK = 2

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-14T18:00:00.000Z'))
    ;(mockCache.get as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockCache.setMenu as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('retorna "suspended" quando store.status=SUSPENDED (ignora manualOpen e horário)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      status: 'SUSPENDED',
      manualOpen: true, // mesmo com manualOpen=true, suspensão prevalece
    })

    const result = await getMenu(SLUG) as any

    expect(result.store.storeStatus).toBe('suspended')
  })

  it('retorna "closed" quando manualOpen=false (ignora horário)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: false,
      businessHours: openAllWeekHours, // horário diz aberto, mas manual fecha
    })

    const result = await getMenu(SLUG) as any

    expect(result.store.storeStatus).toBe('closed')
  })

  it('retorna "open" quando manualOpen=true (ignora horário)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: true,
      businessHours: [], // sem horário configurado, mas manual abre
    })

    const result = await getMenu(SLUG) as any

    expect(result.store.storeStatus).toBe('open')
  })

  it('retorna "closed" quando isClosed=true para o dia atual', async () => {
    const closedHours = openAllWeekHours.map((h) =>
      h.dayOfWeek === FIXED_DAY_OF_WEEK ? { ...h, isClosed: true } : h
    )

    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: null,
      businessHours: closedHours,
    })

    const result = await getMenu(SLUG) as any

    expect(result.store.storeStatus).toBe('closed')
  })

  it('retorna "closed" quando não há horário configurado para hoje', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: null,
      businessHours: [], // nenhum horário configurado
    })

    const result = await getMenu(SLUG) as any

    expect(result.store.storeStatus).toBe('closed')
  })

  it('retorna "closed" quando openTime/closeTime são nulos', async () => {
    const nullTimeHours = openAllWeekHours.map((h) =>
      h.dayOfWeek === FIXED_DAY_OF_WEEK
        ? { ...h, isClosed: false, openTime: null, closeTime: null }
        : h
    )

    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: null,
      businessHours: nullTimeHours,
    })

    const result = await getMenu(SLUG) as any

    expect(result.store.storeStatus).toBe('closed')
  })

  it('retorna "open" quando manualOpen=null e horário cobre toda a semana (00:00-23:59)', async () => {
    ;(mockPrisma.store.findUnique as jest.Mock).mockResolvedValue({
      ...mockStore,
      manualOpen: null,
      businessHours: openAllWeekHours,
    })

    const result = await getMenu(SLUG) as any

    expect(result.store.storeStatus).toBe('open')
  })
})
