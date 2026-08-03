import { NextFunction, Request, Response } from 'express'

import { asaasLogger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { verifyWebhookSignature, type IFoodEvent } from '../../shared/ifood/ifood.service'
import { processIFoodEvent } from '../ifood/ingest.service'

/**
 * Webhook do iFood (fonte primária de eventos; o poller é a rede de segurança).
 *
 * A rota usa `express.raw` (ver app.ts) → `req.body` é o Buffer cru. A assinatura
 * HMAC-SHA256 (X-IFood-Signature) é validada sobre esses bytes ANTES de qualquer
 * parse (obrigatório pra homologação: iFood testa mandando assinatura errada).
 * Só então faz JSON.parse manual. Resolve a loja pelo merchantId do evento →
 * Store.ifoodMerchantId. Sempre responde 200 no caminho feliz (molde asaas.webhook).
 */
export async function ifoodWebhookController(req: Request, res: Response, _next: NextFunction) {
  const signature = req.headers['x-ifood-signature'] as string | undefined
  const rawBody = Buffer.isBuffer(req.body) ? (req.body as Buffer) : undefined

  if (!verifyWebhookSignature(rawBody, signature)) {
    asaasLogger.warn('ifood webhook: invalid signature')
    return res.status(401).json({ error: 'invalid signature' })
  }

  // Parse manual do Buffer cru (assinatura já validada).
  let body: IFoodEvent | IFoodEvent[]
  try {
    body = JSON.parse((rawBody as Buffer).toString('utf8'))
  } catch {
    asaasLogger.warn('ifood webhook: body inválido (não é JSON)')
    return res.status(400).json({ error: 'invalid body' })
  }

  const events = Array.isArray(body) ? body : [body]

  try {
    for (const event of events) {
      // KEEPALIVE/heartbeat de presença ({ code, fullCode, id }) não tem merchantId —
      // só confirma que a conexão está viva. Ignora sem ruído.
      if (!event?.merchantId) continue
      const store = await prisma.store.findFirst({
        where: { ifoodMerchantId: event.merchantId },
        select: { id: true, autoConfirmOrders: true },
      })
      if (!store) {
        asaasLogger.warn({ merchantId: event.merchantId }, 'ifood webhook: store not found for merchant')
        continue
      }
      asaasLogger.info(
        { merchantId: event.merchantId, code: event.fullCode ?? event.code, orderId: event.orderId },
        'ifood webhook: evento recebido'
      )
      await processIFoodEvent(store, event)
    }
  } catch (err) {
    // Sempre 200 pra evitar retries; o poller pega o que faltar.
    asaasLogger.error({ err }, 'ifood webhook handler error')
  }

  return res.json({ received: true })
}
