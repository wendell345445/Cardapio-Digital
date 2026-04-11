import { Router } from 'express'
import express from 'express'

import { stripeWebhookController } from './stripe.webhook'

export const webhookRouter = Router()

// Stripe requires raw body for signature verification
webhookRouter.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookController
)
