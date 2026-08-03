import { Router } from 'express'

import { asaasWebhookController } from './asaas.webhook'
import { ifoodWebhookController } from './ifood.webhook'

export const webhookRouter = Router()

// Asaas envia JSON normal (sem HMAC/raw body). Autenticação por header
// `asaas-access-token`, validado dentro do controller.
webhookRouter.post('/asaas', asaasWebhookController)

// iFood: eventos de pedido em tempo real. Auth por segredo no header; loja resolvida
// pelo merchantId do evento. JSON normal (express.json global).
webhookRouter.post('/ifood', ifoodWebhookController)
