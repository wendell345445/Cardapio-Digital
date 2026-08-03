import { Router } from 'express'

import { asaasWebhookController } from './asaas.webhook'
import { ifoodWebhookController } from './ifood.webhook'

export const webhookRouter = Router()

// Asaas envia JSON normal (sem HMAC/raw body). Autenticação por header
// `asaas-access-token`, validado dentro do controller.
webhookRouter.post('/asaas', asaasWebhookController)

// iFood: eventos de pedido em tempo real. Assinatura HMAC-SHA256 validada sobre o
// raw body (rota recebe express.raw em app.ts, ANTES do express.json global). Loja
// resolvida pelo merchantId do evento.
webhookRouter.post('/ifood', ifoodWebhookController)
