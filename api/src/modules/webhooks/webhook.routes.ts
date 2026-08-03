import { Router } from 'express'

import { asaasWebhookController } from './asaas.webhook'

export const webhookRouter = Router()

// Asaas envia JSON normal (sem HMAC/raw body). Autenticação por header
// `asaas-access-token`, validado dentro do controller.
webhookRouter.post('/asaas', asaasWebhookController)
