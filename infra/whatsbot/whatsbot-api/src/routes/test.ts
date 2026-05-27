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
  // customDomain define o host público da loja quando ela tem domínio próprio.
  // Quando preenchido, a loja é acessível APENAS via {customDomain}, não via
  // {slug}.menupanda.com.br (o middleware bloqueia).
  customDomain?: string | null
  // O Railway já calcula isso pra gente (calcStoreStatus em menu.service).
  // É a fonte da verdade — não tentar recalcular na VM.
  storeStatus?: 'open' | 'closed' | 'paused' | string | null
  nextOpenLabel?: string | null
  businessHours?: Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }>
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
  businessHours: string | null
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
    lines.push(`\n[${c.name}]`)
    for (const p of c.products ?? []) {
      const price = p.basePrice != null ? `R$ ${Number(p.basePrice).toFixed(2)}` : ''
      // Linha compacta: nome + preço + descrição curta (corta em 80 chars)
      const desc = p.description ? ` — ${p.description.slice(0, 80)}` : ''
      lines.push(`• ${p.name} ${price}${desc}`)
      // Variations e addons só inline se existirem (formato enxuto)
      if (p.variations?.length) {
        const vs = p.variations.map((v) => `${v.name} R$${Number(v.price).toFixed(2)}`).join(' / ')
        lines.push(`  tamanhos: ${vs}`)
      }
      if (p.addons?.length) {
        const as = p.addons.map((a) => `${a.addon.name} +R$${Number(a.addon.price).toFixed(2)}`).join(' / ')
        lines.push(`  adicionais: ${as}`)
      }
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
  // customDomain tem prioridade sobre subdomain — a loja é acessível APENAS
  // pelo domínio próprio quando preenchido (middleware bloqueia o subdomain).
  const menuUrl = store.customDomain
    ? `https://${store.customDomain}`
    : `https://${slug}.menupanda.com.br`

  return {
    storeId: store.id,
    storeName: store.name,
    address: store.address ?? null,
    phone: store.phone ?? null,
    menuUrl,
    isOpenNow,
    nextOpenLabel: store.nextOpenLabel ?? null,
    prepTimeMin: store.prepTimeMin ?? null,
    businessHours: formatBusinessHours(store.businessHours),
    menu: lines.join('\n'),
    products,
  }
}

// Formata businessHours em quadro semanal legível pela IA.
//   Domingo: 18:00–23:00
//   Segunda: 11:00–23:00
//   ...
//   Quarta: fechado
function formatBusinessHours(
  hours?: Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }>
): string | null {
  if (!hours?.length) return null
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const byDay = new Map<number, { open: string | null; close: string | null; closed: boolean }>()
  for (const h of hours) {
    byDay.set(h.dayOfWeek, { open: h.openTime, close: h.closeTime, closed: h.isClosed })
  }
  const lines: string[] = []
  for (let d = 0; d < 7; d++) {
    const h = byDay.get(d)
    if (!h || h.closed || !h.open || !h.close) {
      lines.push(`${dayNames[d]}: fechado`)
    } else {
      lines.push(`${dayNames[d]}: ${h.open} às ${h.close}`)
    }
  }
  return lines.join('\n')
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

// Stopwords descartadas no matching (palavras genéricas que aparecem em
// muitos produtos e não ajudam a distinguir). Mantém termos descritivos.
const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'com', 'sem', 'a', 'o', 'as', 'os',
  'um', 'uma', 'no', 'na', 'para', 'por', 'em',
])

function tokenize(s: string): string[] {
  return norm(s).split(' ').filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
}

// Encontra produtos mencionados na resposta da IA usando **bag-of-words match**:
// pra cada produto, conta quantas palavras significativas do nome aparecem na
// resposta. Se ≥50% das palavras casarem (mínimo 2), é match. Resolve casos como
// "Coca Diet" da IA casando com "Coca Cola Diet" do cadastro.
function extractMatchedProducts(reply: string, products: ProductLite[], menuUrl: string): ProductCard[] {
  const replyTokens = new Set(tokenize(reply))
  const normReply = norm(reply)

  type Scored = { product: ProductLite; score: number; pos: number; matched: number; total: number }
  const matches: Scored[] = []

  for (const p of products) {
    if (!p.imageUrl) continue
    const tokens = tokenize(p.name)
    if (tokens.length === 0) continue

    const matched = tokens.filter((t) => replyTokens.has(t))
    const matchedCount = matched.length
    if (matchedCount === 0) continue

    // Regras de aceite — ajustadas pra cobrir o caso "Coca Diet" → "Coca Cola Diet":
    //  - nome com 1 token: precisa do token exato e único o suficiente (>= 4 chars)
    //  - nome com 2+ tokens: precisa de ≥50% das palavras OU ≥2 palavras casadas
    const ratio = matchedCount / tokens.length
    const accept = tokens.length === 1
      ? tokens[0]!.length >= 4 && matchedCount === 1
      : matchedCount >= 2 || ratio >= 0.5
    if (!accept) continue

    // Posição da primeira palavra casada na reply (pra ordenar por ordem de aparição).
    let pos = Infinity
    for (const t of matched) {
      const p = normReply.indexOf(t)
      if (p !== -1 && p < pos) pos = p
    }

    // Score: mais palavras casadas + maior ratio = melhor. Empate vai pra
    // produto com mais palavras (mais específico).
    const score = matchedCount * 10 + ratio * 5 + tokens.length * 0.1
    matches.push({ product: p, score, pos, matched: matchedCount, total: tokens.length })
  }

  // Resolve conflito: 2 produtos casaram com a MESMA palavra → fica o mais
  // específico (mais tokens casados). Ex: "Coca Cola Lata" e "Coca Cola Diet"
  // ambos casam em "coca cola" → ganha quem também casa "diet" se "diet" está
  // na reply.
  matches.sort((a, b) => b.score - a.score)
  const claimed = new Set<string>() // palavras já "consumidas" por outro card

  const ordered: Scored[] = []
  for (const m of matches) {
    const tokens = tokenize(m.product.name)
    // Se TODAS as palavras dele já foram consumidas por outro produto com
    // score maior, pula (evita duplicar card pra mesma referência).
    const allClaimed = tokens.every((t) => claimed.has(t))
    if (allClaimed) continue
    tokens.forEach((t) => claimed.add(t))
    ordered.push(m)
  }

  // Reordena pela posição na resposta (segue a ordem que a IA falou).
  ordered.sort((a, b) => a.pos - b.pos)

  const out: ProductCard[] = []
  const MAX_CARDS = 3
  for (const { product } of ordered) {
    const price = product.basePrice != null ? ` — *R$ ${Number(product.basePrice).toFixed(2).replace('.', ',')}*` : ''
    const desc = product.description ? `\n\n${product.description}` : ''
    const productUrl = `${menuUrl}/produto/${product.id}`
    const caption = `*${product.name}*${price}${desc}\n\n📍 Ver no cardápio: ${productUrl}`
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

    // No /test/chat não fazemos RAG, então pulamos o embedding. Memória
    // ainda é gravada (sem vetor) pra a IA ter histórico cronológico.
    const queryEmbedding: number[] | null = null

    // Em CPU, cada token de prompt extra custa ~90ms. Em vez do top-5 do RAG
    // e 6 recentes (que aumentavam o prompt em ~400 tokens), passamos só 2
    // recentes (continuidade conversacional) e PULAMOS o RAG no /test/chat.
    // O RAG semântico continua existindo no /ai/answer (contrato oficial),
    // onde a integração Baileys pode trocar mais latência por contexto.
    const [recent, profile] = await Promise.all([
      getRecentMessages(ctx.storeId, customerPhone, 2).catch(() => []),
      getProfile(ctx.storeId, customerPhone).catch(() => null),
    ])
    const similar: typeof recent = []

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
          businessHours: ctx.businessHours,
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
