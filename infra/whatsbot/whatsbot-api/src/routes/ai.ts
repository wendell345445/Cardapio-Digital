import type { FastifyInstance } from 'fastify'

import { env } from '../env.js'
import { buildSystemPrompt } from '../prompts.js'
import { answerSchema } from '../schemas.js'
import {
  bumpProfileCounter,
  getProfile,
  getRecentMessages,
  insertMemory,
  searchSimilar,
} from '../services/memory.js'
import { chat, embed } from '../services/ollama.js'
import { scheduleProfileRefresh } from '../services/profile-updater.js'

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post('/ai/answer', async (request, reply) => {
    const parsed = answerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid payload', issues: parsed.error.issues })
    }
    const { storeId, customerPhone, message, context } = parsed.data
    const started = Date.now()

    // 1. Embedda a pergunta
    let queryEmbedding: number[] | null = null
    try {
      queryEmbedding = await embed(message)
    } catch (err) {
      app.log.warn({ err: String(err) }, 'embed falhou — seguindo sem RAG')
    }

    // 2. RAG: top-K memórias similares + recentes cronológicas + perfil
    const [similar, recent, profile] = await Promise.all([
      queryEmbedding
        ? searchSimilar(storeId, customerPhone, queryEmbedding, env.RAG_TOP_K).catch(() => [])
        : Promise.resolve([]),
      getRecentMessages(storeId, customerPhone, env.RECENT_MSGS).catch(() => []),
      getProfile(storeId, customerPhone).catch(() => null),
    ])

    // 3. Monta histórico do chat (cronológico) — passa as últimas como mensagens
    //    do role correto. As "memórias similares" entram embutidas no system prompt.
    const systemPrompt = buildSystemPrompt(context, profile?.summary ?? null, similar)
    const history = recent.map((m) => ({
      role: m.role === 'customer' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }))

    // 4. Chama Ollama chat
    let replyText: string
    try {
      replyText = await chat([
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ])
    } catch (err) {
      app.log.error({ err: String(err) }, 'chat falhou')
      return reply.status(502).send({ error: 'llm_failure' })
    }

    // 5. Grava memória (cliente + bot). Reaproveita embedding do cliente.
    //    Não embeda a resposta do bot (custo de inferência adicional não justifica).
    void insertMemory(storeId, customerPhone, 'customer', message, queryEmbedding).catch(() => {})
    void insertMemory(storeId, customerPhone, 'bot', replyText, null).catch(() => {})

    // 6. Contador de mensagens do cliente — se cruzar threshold, regenera perfil em bg
    const newCount = await bumpProfileCounter(storeId, customerPhone).catch(() => 0)
    if (newCount > 0 && newCount % env.PROFILE_REFRESH_EVERY === 0) {
      scheduleProfileRefresh(storeId, customerPhone)
    }

    return reply.send({
      reply: replyText,
      latencyMs: Date.now() - started,
      memoryHits: similar.length,
      usedProfile: Boolean(profile?.summary),
    })
  })
}
