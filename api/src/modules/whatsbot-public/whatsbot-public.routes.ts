import { Router } from 'express'

import { prisma } from '../../shared/prisma/prisma'

// ─── Endpoints públicos consumidos pelo whatsbot self-hosted (VM GCP) ────
// Servem APENAS pra alimentar a página de teste em whatsbot.menupanda.com.br
// (sem mTLS). Não exigem auth porque retornam só slug+name, sem dados
// sensíveis. Quando a integração oficial estiver em produção, podemos
// proteger por API key ou remover.

export const whatsbotPublicRouter = Router()

// CORS específico: só whatsbot.menupanda.com.br consome.
whatsbotPublicRouter.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && /^https:\/\/whatsbot(\.|$)/.test(origin.replace('https://', ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://whatsbot.menupanda.com.br')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

/**
 * GET /api/v1/whatsbot-public/stores
 *
 * Lista lojas ACTIVE com whatsappMode=WHATSAPP_AI pra popular o select
 * de teste do whatsbot. Filtra também por plan=PREMIUM (única que paga
 * o whatsbot AI).
 */
whatsbotPublicRouter.get('/stores', async (_req, res, next) => {
  try {
    const stores = await prisma.store.findMany({
      where: {
        status: 'ACTIVE',
        // Mantém amplo no teste — sem filtrar por plan/whatsappMode, pra você
        // poder testar contra qualquer loja PROD ativa. Apertar quando virar
        // endpoint oficial.
      },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: stores })
  } catch (err) {
    next(err)
  }
})
