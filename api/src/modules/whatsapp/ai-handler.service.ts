import { logger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'

import { askWhatsbot, type WhatsbotStoreContext } from './ollama.service'
import { checkRateLimit, incrementRateLimit } from './rate-limit.service'
import { isStoreOpenNow, sendMessage, sendMessageDirect } from './whatsapp.service'

// ─── AI Incoming Message Handler ─────────────────────────────────────────
// Encaminha mensagem do cliente pra VM whatsbot (Ollama + RAG self-hosted),
// que retorna a resposta pronta. A IA é APENAS informativa — nunca confirma
// pedido, sempre direciona o cliente pro link da loja.
// Se a VM cair, registra o erro e não envia nada (sem fallback de mensagem).

async function getMenuContext(storeId: string): Promise<{ text: string; json: string }> {
  const cacheKey = `menu-context:${storeId}`
  const cached = await cache.get<{ text: string; json: string }>(cacheKey)
  if (cached) return cached

  const categories = await prisma.category.findMany({
    where: { storeId, isActive: true },
    include: {
      products: {
        where: { isActive: true },
        include: {
          variations: { where: { isActive: true } },
          addons: {
            where: { addon: { isActive: true } },
            include: { addon: true },
          },
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  const lines: string[] = []
  for (const cat of categories) {
    lines.push(`\n== ${cat.name} ==`)
    for (const p of cat.products) {
      const price = p.basePrice ? `R$ ${p.basePrice.toFixed(2)}` : ''
      lines.push(`- ${p.name} (ID: ${p.id}) ${price}`)
      if (p.description) lines.push(`  Descrição: ${p.description}`)
      for (const v of p.variations) {
        lines.push(`  Tamanho: ${v.name} (ID: ${v.id}) — R$ ${v.price.toFixed(2)}`)
      }
      for (const link of p.addons) {
        const a = link.addon
        lines.push(`  Adicional: ${a.name} (ID: ${a.id}) — +R$ ${a.price.toFixed(2)}`)
      }
    }
  }

  const result = { text: lines.join('\n'), json: JSON.stringify(categories) }
  await cache.set(cacheKey, result, 10 * 60)
  return result
}

async function replyAndSave(
  storeId: string,
  fromPhone: string,
  text: string,
  conversationId?: string,
  replyJid?: string
): Promise<void> {
  const result = replyJid
    ? await sendMessageDirect(storeId, replyJid, text)
    : await sendMessage(storeId, fromPhone, text)

  if (!result.ok) {
    logger.warn({ storeId, fromPhone, reason: result.reason }, '[AI] envio falhou')
    return
  }

  if (!conversationId) return
  try {
    const saved = await prisma.conversationMessage.create({
      data: { conversationId, role: 'AI', content: text },
    })
    emit.conversationUpdated(storeId, { conversationId, message: saved })
  } catch {
    // não quebra o fluxo se falhar ao salvar
  }
}

export async function handleIncomingMessage(
  storeId: string,
  fromPhone: string,
  messageText: string,
  slug: string,
  conversationId?: string,
  replyJid?: string
): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { businessHours: true },
  })
  if (!store) return

  const features = store.features as Record<string, boolean>
  const isAiEnabled =
    (store as { whatsappMode?: string }).whatsappMode === 'WHATSAPP_AI' || features?.whatsappAI
  if (!isAiEnabled) return

  // Rate limit: 5 msgs/h por cliente×loja
  const rateLimitCheck = await checkRateLimit(storeId, fromPhone)
  if (!rateLimitCheck.allowed) {
    const result = await sendMessage(
      storeId,
      fromPhone,
      '⏰ Você atingiu o limite de mensagens por hora. Tente novamente mais tarde.'
    )
    if (!result.ok) {
      logger.warn({ storeId, fromPhone, reason: result.reason }, '[AI] rate-limit notice falhou')
    }
    return
  }
  await incrementRateLimit(storeId, fromPhone)

  const menuCtx = await getMenuContext(storeId)
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.com.br'
  const menuUrl = `https://${slug}.${rootDomain}`

  const storeContext: WhatsbotStoreContext = {
    name: store.name,
    slug,
    address: store.address ?? null,
    phone: store.phone,
    menuUrl,
    isOpenNow: isStoreOpenNow({ businessHours: store.businessHours }),
  }

  const started = Date.now()
  let reply: string | null = null
  let memoryHits = 0
  let usedProfile = false
  let success = false

  try {
    const res = await askWhatsbot({
      storeId,
      customerPhone: fromPhone,
      message: messageText,
      context: { store: storeContext, menu: menuCtx.text, menuJson: menuCtx.json },
    })
    reply = res.reply
    memoryHits = res.memoryHits
    usedProfile = res.usedProfile
    success = true
  } catch (err) {
    // Decisão de design: VM down → não envia nada ao cliente, só loga.
    logger.error(
      { storeId, fromPhone, err: String(err) },
      '[AI] whatsbot falhou — nenhuma resposta enviada ao cliente'
    )
  }

  if (success && reply) {
    await replyAndSave(storeId, fromPhone, reply, conversationId, replyJid)
  }

  await prisma.$executeRaw`
    INSERT INTO "AIInteractionLog" ("id", "storeId", "clientPhone", "question", "sqlGenerated", "response", "success", "latencyMs", "createdAt")
    VALUES (gen_random_uuid(), ${storeId}, ${fromPhone}, ${messageText}, ${null}, ${reply ?? ''}, ${success}, ${Date.now() - started}, now())
  `.catch(() => {})

  logger.info(
    { storeId, fromPhone, success, memoryHits, usedProfile, latencyMs: Date.now() - started },
    '[AI] interação concluída'
  )
}
