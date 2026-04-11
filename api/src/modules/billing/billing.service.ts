import { stripeLogger } from '../../shared/logger/logger'
import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { createBillingPortalSession } from '../../shared/stripe/stripe.service'

/**
 * Cria uma Stripe Billing Portal Session para o admin da loja.
 * Retorna a URL pra onde o frontend deve redirecionar.
 *
 * A loja precisa ter `stripeCustomerId` — se não tiver (ex: loja legada criada antes do Stripe),
 * lança 422 pedindo contato com suporte.
 */
export async function createPortalSession(storeId: string, returnUrl: string): Promise<{ url: string }> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, stripeCustomerId: true },
  })

  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  if (!store.stripeCustomerId) {
    stripeLogger.warn({ storeId }, 'billing-portal: store has no stripe customer')
    throw new AppError('Loja sem customer Stripe vinculado — contate o suporte', 422)
  }

  const session = await createBillingPortalSession(store.stripeCustomerId, returnUrl)
  stripeLogger.info(
    { storeId, customerId: store.stripeCustomerId, sessionId: session.id },
    'billing-portal: session created'
  )

  return { url: session.url }
}
