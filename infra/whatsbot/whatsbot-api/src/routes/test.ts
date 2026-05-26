import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { buildSystemPrompt } from '../prompts.js'
import {
  bumpProfileCounter,
  getProfile,
  getRecentMessages,
  insertMemory,
  searchSimilar,
} from '../services/memory.js'
import { chat, embed } from '../services/ollama.js'
import { scheduleProfileRefresh } from '../services/profile-updater.js'
import { env } from '../env.js'

// ─── Rota pública temporária pra testar o whatsbot sem mTLS ──────────────
// Acessível em https://whatsbot.menupanda.com.br/test (HTML estático) e
// /test/chat (endpoint JSON). Faz proxy pra menu público da Railway pra
// montar o contexto da loja a partir do slug informado.
// REMOVER quando a integração oficial estiver pronta.

const MENU_API_BASE = process.env.MENU_API_BASE ?? 'https://api.menupanda.com.br/api/v1'

const chatSchema = z.object({
  slug: z.string().min(1).max(60),
  customerPhone: z.string().min(5).max(30),
  message: z.string().min(1).max(2000),
})

type MenuApiStore = {
  id?: string
  name?: string
  slug?: string
  address?: string | null
  phone?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  prepTimeMin?: number | null
  // O Railway já calcula isso pra gente (calcStoreStatus em menu.service).
  // É a fonte da verdade — não tentar recalcular na VM.
  storeStatus?: 'open' | 'closed' | 'paused' | string | null
  nextOpenLabel?: string | null
}

interface MenuApiProduct {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  basePrice?: number | null
  variations?: Array<{ id: string; name: string; price: number }>
  addons?: Array<{ addon: { id: string; name: string; price: number } }>
}

type MenuApiResponse = {
  success?: boolean
  data?: {
    store?: MenuApiStore
    categories?: Array<{ name: string; products: MenuApiProduct[] }>
  }
  store?: MenuApiStore
  categories?: unknown
}

export interface ProductLite {
  id: string
  name: string
  imageUrl: string | null
  basePrice: number | null
  description: string | null
  category: string
}

export interface ProductCard {
  productId: string
  imageUrl: string
  caption: string
}

async function fetchStoreContext(slug: string): Promise<{
  storeId: string
  storeName: string
  address: string | null
  phone: string | null
  menuUrl: string
  isOpenNow: boolean
  nextOpenLabel: string | null
  prepTimeMin: number | null
  menu: string
  products: ProductLite[]
}> {
  const res = await fetch(`${MENU_API_BASE}/menu`, {
    headers: { 'X-Tenant-Slug': slug, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`menu api ${res.status}: ${body.slice(0, 120)}`)
  }
  const json = (await res.json()) as MenuApiResponse
  const data = json.data ?? json
  const store = data.store as MenuApiStore | undefined
  const cats = (data.categories ?? []) as MenuApiResponse['data'] extends infer T ? (T extends { categories?: infer C } ? C : never) : never

  if (!store?.id || !store.name) throw new Error('menu api retornou loja inválida')

  const lines: string[] = []
  const products: ProductLite[] = []
  const categories = (cats as NonNullable<MenuApiResponse['data']>['categories']) ?? []
  for (const c of categories) {
    lines.push(`\n== ${c.name} ==`)
    for (const p of c.products ?? []) {
      const price = p.basePrice != null ? `R$ ${Number(p.basePrice).toFixed(2)}` : ''
      lines.push(`- ${p.name} ${price}`)
      if (p.description) lines.push(`  ${p.description}`)
      for (const v of p.variations ?? []) lines.push(`  Tamanho: ${v.name} — R$ ${Number(v.price).toFixed(2)}`)
      for (const a of p.addons ?? []) lines.push(`  Adicional: ${a.addon.name} — +R$ ${Number(a.addon.price).toFixed(2)}`)
      products.push({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl ?? null,
        basePrice: p.basePrice ?? null,
        description: p.description ?? null,
        category: c.name,
      })
    }
  }

  // O Railway calcula storeStatus (open/closed/paused) considerando
  // businessHours + manualOpen + status. Trust it; sem recalcular na VM.
  const isOpenNow = store.storeStatus === 'open'

  return {
    storeId: store.id,
    storeName: store.name,
    address: store.address ?? null,
    phone: store.phone ?? null,
    menuUrl: `https://${slug}.menupanda.com.br`,
    isOpenNow,
    nextOpenLabel: store.nextOpenLabel ?? null,
    prepTimeMin: store.prepTimeMin ?? null,
    menu: lines.join('\n'),
    products,
  }
}

// Normaliza pra comparação fuzzy: minúsculo, sem acento, sem pontuação.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Encontra produtos mencionados na resposta da IA. Estratégia simples:
// se o nome normalizado do produto aparece como substring na resposta
// normalizada, é match. Limita ao top-N pra não floodar o cliente com fotos.
function extractMatchedProducts(reply: string, products: ProductLite[], menuUrl: string): ProductCard[] {
  const normReply = norm(reply)
  const matches: Array<{ product: ProductLite; pos: number }> = []
  for (const p of products) {
    if (!p.imageUrl) continue
    const name = norm(p.name)
    // Evita match trivial (palavras únicas muito curtas tipo "x" ou "1L").
    if (name.length < 3) continue
    const pos = normReply.indexOf(name)
    if (pos !== -1) matches.push({ product: p, pos })
  }
  // Ordena pela ordem de aparição no texto e remove duplicados próximos.
  matches.sort((a, b) => a.pos - b.pos)

  const seen = new Set<string>()
  const out: ProductCard[] = []
  const MAX_CARDS = 3
  for (const { product } of matches) {
    if (seen.has(product.id)) continue
    seen.add(product.id)
    const price = product.basePrice != null ? ` — *R$ ${Number(product.basePrice).toFixed(2).replace('.', ',')}*` : ''
    const desc = product.description ? `\n\n${product.description}` : ''
    const caption = `*${product.name}*${price}${desc}\n\n📍 Ver no cardápio: ${menuUrl}`
    out.push({ productId: product.id, imageUrl: product.imageUrl!, caption })
    if (out.length >= MAX_CARDS) break
  }
  return out
}

export async function testRoutes(app: FastifyInstance): Promise<void> {
  // Serve a página HTML estática
  const here = dirname(fileURLToPath(import.meta.url))
  const htmlPath = join(here, '..', 'public', 'test.html')
  const html = readFileSync(htmlPath, 'utf8')

  app.get('/test', async (_req, reply) => {
    return reply.type('text/html; charset=utf-8').send(html)
  })

  // Proxy pro Railway: lista lojas PROD pra popular o select.
  app.get('/test/stores', async (_req, reply) => {
    try {
      const res = await fetch(`${MENU_API_BASE}/whatsbot-public/stores`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return reply.status(502).send({ error: 'upstream_failed', detail: body.slice(0, 200) })
      }
      const json = (await res.json()) as { success?: boolean; data?: Array<{ slug: string; name: string }> }
      return reply.send({ stores: json.data ?? [] })
    } catch (err) {
      return reply.status(502).send({ error: 'fetch_failed', detail: String(err) })
    }
  })

  app.post('/test/chat', async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid payload', issues: parsed.error.issues })
    }
    const { slug, customerPhone, message } = parsed.data
    const started = Date.now()

    let ctx
    try {
      ctx = await fetchStoreContext(slug)
    } catch (err) {
      return reply.status(404).send({ error: 'store_not_found', detail: String(err) })
    }

    let queryEmbedding: number[] | null = null
    try {
      queryEmbedding = await embed(message)
    } catch {
      // sem embedding, segue sem RAG
    }

    const [similar, recent, profile] = await Promise.all([
      queryEmbedding
        ? searchSimilar(ctx.storeId, customerPhone, queryEmbedding, env.RAG_TOP_K).catch(() => [])
        : Promise.resolve([]),
      getRecentMessages(ctx.storeId, customerPhone, env.RECENT_MSGS).catch(() => []),
      getProfile(ctx.storeId, customerPhone).catch(() => null),
    ])

    const systemPrompt = buildSystemPrompt(
      {
        store: {
          name: ctx.storeName,
          slug,
          address: ctx.address,
          phone: ctx.phone,
          menuUrl: ctx.menuUrl,
          isOpenNow: ctx.isOpenNow,
          nextOpenLabel: ctx.nextOpenLabel,
          prepTimeMin: ctx.prepTimeMin,
        },
        menu: ctx.menu,
      },
      profile?.summary ?? null,
      similar
    )

    const history = recent.map((m) => ({
      role: m.role === 'customer' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }))

    let replyText: string
    try {
      replyText = await chat([
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ])
    } catch (err) {
      app.log.error({ err: String(err) }, '[/test/chat] llm falhou')
      return reply.status(502).send({ error: 'llm_failure' })
    }

    void insertMemory(ctx.storeId, customerPhone, 'customer', message, queryEmbedding).catch(() => {})
    void insertMemory(ctx.storeId, customerPhone, 'bot', replyText, null).catch(() => {})

    const newCount = await bumpProfileCounter(ctx.storeId, customerPhone).catch(() => 0)
    if (newCount > 0 && newCount % env.PROFILE_REFRESH_EVERY === 0) {
      scheduleProfileRefresh(ctx.storeId, customerPhone)
    }

    const images = extractMatchedProducts(replyText, ctx.products, ctx.menuUrl)

    return reply.send({
      reply: replyText,
      images,
      latencyMs: Date.now() - started,
      memoryHits: similar.length,
      usedProfile: Boolean(profile?.summary),
      storeName: ctx.storeName,
      isOpenNow: ctx.isOpenNow,
    })
  })
}
