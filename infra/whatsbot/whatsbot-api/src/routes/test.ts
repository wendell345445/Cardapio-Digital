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
  businessHours?: Array<{ dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null }>
}

type MenuApiResponse = {
  success?: boolean
  data?: {
    store?: MenuApiStore
    categories?: Array<{
      name: string
      products: Array<{
        id: string
        name: string
        description?: string | null
        basePrice?: number | null
        variations?: Array<{ id: string; name: string; price: number }>
        addons?: Array<{ addon: { id: string; name: string; price: number } }>
      }>
    }>
  }
  store?: MenuApiStore
  categories?: unknown
}

async function fetchStoreContext(slug: string): Promise<{
  storeId: string
  storeName: string
  address: string | null
  phone: string | null
  menuUrl: string
  isOpenNow: boolean
  prepTimeMin: number | null
  menu: string
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
  for (const c of (cats as NonNullable<MenuApiResponse['data']>['categories'] ?? []) ?? []) {
    lines.push(`\n== ${c.name} ==`)
    for (const p of c.products ?? []) {
      const price = p.basePrice != null ? `R$ ${Number(p.basePrice).toFixed(2)}` : ''
      lines.push(`- ${p.name} ${price}`)
      if (p.description) lines.push(`  ${p.description}`)
      for (const v of p.variations ?? []) lines.push(`  Tamanho: ${v.name} — R$ ${Number(v.price).toFixed(2)}`)
      for (const a of p.addons ?? []) lines.push(`  Adicional: ${a.addon.name} — +R$ ${Number(a.addon.price).toFixed(2)}`)
    }
  }

  const isOpenNow = computeIsOpenNow(store.businessHours ?? [])

  return {
    storeId: store.id,
    storeName: store.name,
    address: store.address ?? null,
    phone: store.phone ?? null,
    menuUrl: `https://${slug}.menupanda.com.br`,
    isOpenNow,
    prepTimeMin: store.prepTimeMin ?? null,
    menu: lines.join('\n'),
  }
}

function computeIsOpenNow(
  businessHours: Array<{ dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null }>
): boolean {
  // BRT (UTC-3)
  const now = new Date()
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const dayOfWeek = brt.getUTCDay()
  const mins = brt.getUTCHours() * 60 + brt.getUTCMinutes()
  const today = businessHours.find((h) => h.dayOfWeek === dayOfWeek && !h.isClosed)
  if (!today?.openTime || !today.closeTime) return false
  const [oh, om] = today.openTime.split(':').map(Number) as [number, number]
  const [ch, cm] = today.closeTime.split(':').map(Number) as [number, number]
  return mins >= oh * 60 + om && mins < ch * 60 + cm
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

    return reply.send({
      reply: replyText,
      latencyMs: Date.now() - started,
      memoryHits: similar.length,
      usedProfile: Boolean(profile?.summary),
      storeName: ctx.storeName,
      isOpenNow: ctx.isOpenNow,
    })
  })
}
