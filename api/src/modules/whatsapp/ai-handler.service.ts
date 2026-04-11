import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { emit } from '../../shared/socket/socket'

import { sendMessage, sendMessageDirect } from './whatsapp.service'
import { classifyIntent, answerQuestion, suggestCartLink, type IntentType } from './ollama.service'
import { encodeCartHash } from './cart-hash.service'
import { validateSQL } from './sql-validator'
import { checkRateLimit, incrementRateLimit } from './rate-limit.service'

// ─── TASK-072: AI Incoming Message Handler ───────────────────────────────────
// ─── TASK-0911: NLP→SQL Pipeline + Rate Limit ────────────────────────────────

interface ConversationState {
  lastIntent?: IntentType
  pendingItems?: Array<{ productId: string; variationId?: string; qty: number }>
}

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
          additionals: { where: { isActive: true } },
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
      for (const a of p.additionals) {
        lines.push(`  Adicional: ${a.name} (ID: ${a.id}) — +R$ ${a.price.toFixed(2)}`)
      }
    }
  }

  const result = { text: lines.join('\n'), json: JSON.stringify(categories) }
  await cache.set(cacheKey, result, 10 * 60) // 10min TTL
  return result
}

/** Sends a WhatsApp message, saves it to the conversation, and emits a socket event.
 *  Uses replyJid directly when available (like personal-ai) for reliable delivery. */
async function replyAndSave(
  storeId: string,
  fromPhone: string,
  text: string,
  conversationId?: string,
  replyJid?: string
): Promise<void> {
  if (replyJid) {
    await sendMessageDirect(storeId, replyJid, text)
  } else {
    await sendMessage(storeId, fromPhone, text)
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
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) return

  // Verificar whatsappMode (v2.1) ou feature flag legada
  const features = store.features as Record<string, boolean>
  const isAiEnabled = (store as any).whatsappMode === 'WHATSAPP_AI' || features?.whatsappAI
  if (!isAiEnabled) return

  // Rate limit: máximo 5 mensagens/hora por número
  const rateLimitCheck = await checkRateLimit(storeId, fromPhone)
  if (!rateLimitCheck.allowed) {
    await sendMessage(
      storeId,
      fromPhone,
      '⏰ Você atingiu o limite de mensagens por hora. Tente novamente mais tarde.'
    )
    return
  }
  await incrementRateLimit(storeId, fromPhone)

  const stateKey = `wa-state:${storeId}:${fromPhone}`
  const state = (await cache.get<ConversationState>(stateKey)) ?? {}

  const menuCtx = await getMenuContext(storeId)

  let intent: IntentType
  try {
    intent = await classifyIntent(messageText)
  } catch {
    intent = 'other'
  }

  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.com.br'
  const menuUrl = `https://${slug}.${rootDomain}`

  try {
    // Fluxo de confirmação de carrinho pendente
    if (state.pendingItems && intent === 'confirm') {
      const hash = encodeCartHash(state.pendingItems)
      const cartUrl = `${menuUrl}/${slug}/carrinho/${hash}`
      await replyAndSave(storeId, fromPhone, `Ótimo! 🎉 Clique para abrir seu carrinho pré-montado:\n${cartUrl}`, conversationId, replyJid)
      await cache.del(stateKey)
      return
    }

    if (intent === 'order') {
      const { reply, cartItems } = await suggestCartLink(messageText, menuCtx.json)
      if (cartItems && cartItems.length > 0) {
        await cache.set(stateKey, { lastIntent: 'order', pendingItems: cartItems }, 10 * 60)
        await replyAndSave(
          storeId,
          fromPhone,
          `${reply}\n\nPosso adicionar ao carrinho para você? Responda "sim" para confirmar ou acesse o menu: ${menuUrl}`,
          conversationId,
          replyJid
        )
      } else {
        await replyAndSave(storeId, fromPhone, `${reply}\n\nVeja nosso cardápio completo: ${menuUrl}`, conversationId, replyJid)
      }
      return
    }

    if (intent === 'question') {
      const startMs = Date.now()
      let sqlGenerated: string | null = null
      let success = false
      let response = ''

      try {
        const answer = await answerQuestion(messageText, menuCtx.text, {
          name: store.name,
          address: store.address ?? undefined,
          phone: store.phone,
        })

        const sqlMatch = answer.match(/SELECT[\s\S]+?;/i)
        if (sqlMatch) {
          sqlGenerated = sqlMatch[0]
          const validation = validateSQL(sqlGenerated, storeId)

          if (validation.valid) {
            const rows = await prisma.$queryRawUnsafe(sqlGenerated) as unknown[]
            response = rows.length > 0
              ? `Encontrei ${rows.length} resultado(s) para sua consulta. ${answer.replace(sqlGenerated, '').trim()}`
              : `Não encontrei resultados para sua consulta. ${answer.replace(sqlGenerated, '').trim()}`
          } else {
            response = answer.replace(sqlGenerated, '').trim() || answer
          }
        } else {
          response = answer
        }

        success = true
      } catch (sqlErr) {
        response = `Olá! Veja nosso cardápio em: ${menuUrl}`
        success = false
      }

      await replyAndSave(storeId, fromPhone, response, conversationId, replyJid)

      await prisma.$executeRaw`
        INSERT INTO "AIInteractionLog" ("id", "storeId", "clientPhone", "question", "sqlGenerated", "response", "success", "latencyMs", "createdAt")
        VALUES (gen_random_uuid(), ${storeId}, ${fromPhone}, ${messageText}, ${sqlGenerated}, ${response}, ${success}, ${Date.now() - startMs}, now())
      `.catch(() => {})

      return
    }

    // other — fallback
    await replyAndSave(
      storeId,
      fromPhone,
      `Olá! 👋 Veja nosso cardápio completo em:\n${menuUrl}\n\nSe precisar de ajuda, responda com sua dúvida ou peça para falar com um atendente.`,
      conversationId,
      replyJid
    )
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg === 'TIMEOUT' || errMsg.includes('TIMEOUT')) {
      await replyAndSave(storeId, fromPhone, `Desculpe, não entendi. Acesse nosso cardápio em ${menuUrl}`, conversationId, replyJid)
    } else {
      console.error('[AI] Error handling message:', err)
      await replyAndSave(storeId, fromPhone, `Desculpe, não entendi. Acesse nosso cardápio em ${menuUrl}`, conversationId, replyJid)
    }
  }
}
