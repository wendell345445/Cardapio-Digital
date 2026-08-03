import { NextFunction, Request, Response } from 'express'

import { asaasLogger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { verifyWebhookSecret, type IFoodEvent } from '../../shared/ifood/ifood.service'
import { processIFoodEvent } from '../ifood/ingest.service'

/**
 * Webhook do iFood (fonte primária de eventos; o poller é a rede de segurança).
 * Resolve a loja pelo merchantId do evento → Store.ifoodMerchantId. Sempre responde 200
 * (molde asaas.webhook) e reusa 100% o ingest.service (dedup + lock por loja).
 */
export async function ifoodWebhookController(req: Request, res: Response, _next: NextFunction) {
  const secret = (req.headers['x-ifood-signature'] || req.headers['x-webhook-secret']) as string | undefined
  if (!verifyWebhookSecret(secret)) {
    asaasLogger.warn('ifood webhook: invalid secret')
    return res.status(401).json({ error: 'invalid secret' })
  }

  // O iFood pode mandar um evento único ou uma lista.
  const body = req.body as IFoodEvent | IFoodEvent[]
  const events = Array.isArray(body) ? body : [body]

  try {
    for (const event of events) {
      if (!event?.merchantId) continue
      const store = await prisma.store.findFirst({
        where: { ifoodMerchantId: event.merchantId },
        select: { id: true, autoConfirmOrders: true },
      })
      if (!store) {
        asaasLogger.warn({ merchantId: event.merchantId }, 'ifood webhook: store not found for merchant')
        continue
      }
      await processIFoodEvent(store, event)
    }
  } catch (err) {
    // Sempre 200 pra evitar retries; o poller pega o que faltar.
    asaasLogger.error({ err }, 'ifood webhook handler error')
  }

  return res.json({ received: true })
}
