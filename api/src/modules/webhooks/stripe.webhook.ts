import { NextFunction, Request, Response } from 'express'

import { sendPaymentFailedEmail, sendTrialEndingEmail } from '../../shared/email/email.service'
import { stripeLogger } from '../../shared/logger/logger'
import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import {
  constructWebhookEvent,
  payInvoice,
  PLAN_PRICE_IDS,
  retrieveSubscription,
  setSubscriptionDefaultPaymentMethod,
  type StripeEvent,
} from '../../shared/stripe/stripe.service'

// Grace period após `invoice.payment_failed` antes da suspensão automática.
// Cron `trial-suspension.job` varre lojas com `stripeTrialEndsAt < NOW()` e suspende.
const GRACE_PERIOD_DAYS = Number(process.env.STRIPE_GRACE_PERIOD_DAYS ?? 1)

const PLAN_FEATURES: Record<string, object> = {
  PROFESSIONAL: {
    pixPayment: true,
    whatsappNotifications: true,
    aiAssistant: false,
    deliveryZones: false,
    coupons: false,
    analytics: false,
    ranking: false,
    scheduling: false,
  },
  PREMIUM: {
    pixPayment: true,
    whatsappNotifications: true,
    aiAssistant: true,
    deliveryZones: true,
    coupons: true,
    analytics: true,
    ranking: true,
    scheduling: true,
  },
}

function planFromPriceId(priceId: string): string | undefined {
  return Object.entries(PLAN_PRICE_IDS).find(([, id]) => id === priceId)?.[0]
}

async function findStoreByCustomerId(customerId: string) {
  return prisma.store.findFirst({
    where: { stripeCustomerId: customerId },
    include: { users: { where: { role: 'ADMIN' }, select: { email: true } } },
  })
}

/**
 * Reativa loja SUSPENDED após cliente anexar PaymentMethod via Customer Portal.
 *
 * Contexto: o Customer Portal só anexa o PM ao customer (eventos
 * `payment_method.attached` + `setup_intent.succeeded` + `customer.updated`).
 * Stripe NÃO auto-retenta subscriptions em estado `incomplete` quando um PM
 * é anexado — o admin teria que abrir a invoice no Portal e pagar manualmente.
 *
 * Esse helper fecha o gap: detecta SUSPENDED, busca o estado real da sub no
 * Stripe e (1) sincroniza local se a sub já está ativa, ou (2) seta o PM como
 * default na sub e força o pagamento da invoice em aberto. Em ambos os casos,
 * o handler `customer.subscription.updated` (já existente) recebe o status
 * `active` subsequente e completa a transição local.
 */
async function reactivateSuspendedStoreFromPaymentMethod(
  store: NonNullable<Awaited<ReturnType<typeof findStoreByCustomerId>>>,
  newDefaultPaymentMethod: string
): Promise<void> {
  if (!store.stripeSubscriptionId) {
    stripeLogger.warn(
      { storeId: store.id },
      'reactivate: SUSPENDED store has no stripeSubscriptionId — cannot recover via webhook'
    )
    return
  }

  const sub = await retrieveSubscription(store.stripeSubscriptionId)
  stripeLogger.info(
    { storeId: store.id, subscriptionId: sub.id, subStatus: sub.status },
    'reactivate: retrieved subscription state'
  )

  // Caso 1: Sub já está ativa em Stripe — só sincronizar status local
  if (sub.status === 'active' || sub.status === 'trialing') {
    await prisma.store.update({
      where: { id: store.id },
      data: { status: 'ACTIVE', stripeTrialEndsAt: null },
    })
    await prisma.auditLog.create({
      data: {
        storeId: store.id,
        userId: null,
        action: 'store.reactivated',
        entity: 'Store',
        entityId: store.id,
        data: {
          reason: 'pm-attached-sub-already-active',
          subStatus: sub.status,
          newDefaultPaymentMethod,
        },
      },
    })
    stripeLogger.info(
      { storeId: store.id, subStatus: sub.status },
      'reactivate: store ACTIVE (synced from Stripe)'
    )
    return
  }

  // Caso 2: Sub está incomplete/past_due e tem invoice em aberto — pagar
  if (['incomplete', 'past_due'].includes(sub.status)) {
    // Setar o PM como default na própria sub (Customer Portal só seta no customer)
    await setSubscriptionDefaultPaymentMethod(sub.id, newDefaultPaymentMethod)
    stripeLogger.info(
      { storeId: store.id, subscriptionId: sub.id, newDefaultPaymentMethod },
      'reactivate: set default PM on subscription'
    )

    if (!sub.latest_invoice) {
      stripeLogger.warn(
        { storeId: store.id, subscriptionId: sub.id, subStatus: sub.status },
        'reactivate: subscription has no latest_invoice to pay'
      )
      return
    }

    try {
      const invoice = await payInvoice(sub.latest_invoice)
      stripeLogger.info(
        { storeId: store.id, invoiceId: invoice.id, paid: invoice.paid },
        'reactivate: invoice paid — Stripe will dispatch customer.subscription.updated next'
      )
      // Não atualizamos status local aqui — `customer.subscription.updated`
      // com `status: active` chegará logo em seguida e fará a transição
      // (mantém o fluxo unificado num único ponto de mudança).
    } catch (err) {
      stripeLogger.error(
        { err, storeId: store.id, invoiceId: sub.latest_invoice },
        'reactivate: failed to pay invoice'
      )
      // Não relançamos — o webhook deve responder 200 mesmo em falha de
      // recovery, senão Stripe retenta indefinidamente.
    }
    return
  }

  // Caso 3: Sub canceled/incomplete_expired — não dá pra recuperar via update
  stripeLogger.warn(
    { storeId: store.id, subscriptionId: sub.id, subStatus: sub.status },
    'reactivate: subscription in unrecoverable state — admin needs new subscription'
  )
}

export async function stripeWebhookController(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['stripe-signature'] as string

  if (!signature) {
    stripeLogger.warn('webhook: missing stripe-signature header')
    return next(new AppError('Missing stripe-signature header', 400))
  }

  let event: StripeEvent
  try {
    event = constructWebhookEvent(req.body as Buffer, signature)
  } catch (err) {
    stripeLogger.error({ err: (err as Error).message }, 'webhook: signature verification failed')
    return next(new AppError(`Webhook signature invalid: ${(err as Error).message}`, 400))
  }

  stripeLogger.info({ eventId: event.id, eventType: event.type }, 'webhook received')

  try {
    const obj = event.data.object as Record<string, string | number | boolean | null | undefined | Record<string, unknown> | unknown[]>

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const customerId = typeof obj['customer'] === 'string' ? obj['customer'] : null
        if (!customerId) break

        const store = await findStoreByCustomerId(customerId)
        if (!store) {
          stripeLogger.warn({ customerId, eventType: event.type }, 'store not found for customer')
          break
        }

        await prisma.store.update({ where: { id: store.id }, data: { status: 'ACTIVE' } })
        await prisma.auditLog.create({
          data: {
            storeId: store.id,
            userId: null,
            action: 'store.payment.succeeded',
            entity: 'Store',
            entityId: store.id,
            data: { paymentIntentId: String(obj['id'] ?? '') },
          },
        })
        stripeLogger.info({ storeId: store.id, customerId }, 'store activated after payment success')
        break
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe dispara ~3 dias antes do fim do trial — enviamos aviso proativo pro admin.
        const customerId = typeof obj['customer'] === 'string' ? obj['customer'] : null
        if (!customerId) break

        const store = await findStoreByCustomerId(customerId)
        if (!store) {
          stripeLogger.warn({ customerId, eventType: event.type }, 'store not found for customer')
          break
        }

        const trialEndUnix = typeof obj['trial_end'] === 'number' ? (obj['trial_end'] as number) : null
        const trialEndsAt = trialEndUnix ? new Date(trialEndUnix * 1000) : null

        await prisma.auditLog.create({
          data: {
            storeId: store.id,
            userId: null,
            action: 'store.trial.ending',
            entity: 'Store',
            entityId: store.id,
            data: { subscriptionId: String(obj['id'] ?? ''), trialEndsAt: trialEndsAt?.toISOString() ?? null },
          },
        })

        const adminEmail = store.users[0]?.email
        if (adminEmail && trialEndsAt) {
          await sendTrialEndingEmail({ adminEmail, storeName: store.name, trialEndsAt }).catch(
            (err) => stripeLogger.error({ err, storeId: store.id }, 'failed to send trial-ending email')
          )
          stripeLogger.info({ storeId: store.id, adminEmail, trialEndsAt }, 'trial-ending email sent')
        }
        break
      }

      case 'invoice.payment_failed': {
        const customerId = typeof obj['customer'] === 'string' ? obj['customer'] : null
        if (!customerId) break

        const store = await findStoreByCustomerId(customerId)
        if (!store) {
          stripeLogger.warn({ customerId, eventType: event.type }, 'store not found for customer')
          break
        }

        const suspendAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)

        await prisma.store.update({
          where: { id: store.id },
          data: { stripeTrialEndsAt: suspendAt },
        })

        await prisma.auditLog.create({
          data: {
            storeId: store.id,
            userId: null,
            action: 'store.payment.failed',
            entity: 'Store',
            entityId: store.id,
            data: { invoiceId: String(obj['id'] ?? ''), suspendAt: suspendAt.toISOString(), graceDays: GRACE_PERIOD_DAYS },
          },
        })

        const adminEmail = store.users[0]?.email
        if (adminEmail) {
          await sendPaymentFailedEmail({
            adminEmail,
            storeName: store.name,
            graceDays: GRACE_PERIOD_DAYS,
          }).catch((err) =>
            stripeLogger.error({ err, storeId: store.id }, 'failed to send payment-failed email')
          )
        }
        stripeLogger.info(
          { storeId: store.id, customerId, suspendAt, graceDays: GRACE_PERIOD_DAYS },
          'payment failed — grace period started'
        )
        break
      }

      case 'customer.subscription.updated': {
        const customerId = typeof obj['customer'] === 'string' ? obj['customer'] : null
        if (!customerId) break

        const items = obj['items'] as { data: { price: { id: string } }[] } | undefined
        const priceId = items?.data[0]?.price?.id
        const plan = priceId ? planFromPriceId(priceId) : undefined
        if (!plan) break

        const store = await findStoreByCustomerId(customerId)
        if (!store) {
          stripeLogger.warn({ customerId, eventType: event.type }, 'store not found for customer')
          break
        }

        const subStatus = typeof obj['status'] === 'string' ? obj['status'] : ''

        await prisma.store.update({
          where: { id: store.id },
          data: {
            plan: plan as 'PROFESSIONAL' | 'PREMIUM',
            features: PLAN_FEATURES[plan],
            ...(subStatus === 'active' ? { status: 'ACTIVE' } : {}),
          },
        })

        await prisma.auditLog.create({
          data: {
            storeId: store.id,
            userId: null,
            action: 'store.subscription.updated',
            entity: 'Store',
            entityId: store.id,
            data: { subscriptionId: String(obj['id'] ?? ''), plan, status: subStatus },
          },
        })
        stripeLogger.info({ storeId: store.id, plan, status: subStatus }, 'subscription updated')
        break
      }

      case 'customer.subscription.deleted': {
        const customerId = typeof obj['customer'] === 'string' ? obj['customer'] : null
        if (!customerId) break

        const store = await findStoreByCustomerId(customerId)
        if (!store) {
          stripeLogger.warn({ customerId, eventType: event.type }, 'store not found for customer')
          break
        }

        await prisma.store.update({ where: { id: store.id }, data: { status: 'SUSPENDED' } })
        await prisma.auditLog.create({
          data: {
            storeId: store.id,
            userId: null,
            action: 'store.subscription.deleted',
            entity: 'Store',
            entityId: store.id,
            data: { subscriptionId: String(obj['id'] ?? '') },
          },
        })
        stripeLogger.info({ storeId: store.id, customerId }, 'store suspended after subscription deleted')
        break
      }

      case 'customer.updated': {
        // Disparado quando o admin anexa um PaymentMethod via Customer Portal
        // (junto com `payment_method.attached` e `setup_intent.succeeded`).
        // Detectamos a mudança em `invoice_settings.default_payment_method` e
        // tentamos recuperar lojas SUSPENDED — fechando o gap em que sub
        // `incomplete` (criada via dev tool ou trial sem PM) não retentaria
        // sozinha após o admin adicionar cartão. Ver v2.5.7.
        const customerId = typeof obj['id'] === 'string' ? obj['id'] : null
        if (!customerId) break

        const invoiceSettings = obj['invoice_settings'] as
          | { default_payment_method?: string | null }
          | null
          | undefined
        const newDefaultPM = invoiceSettings?.default_payment_method ?? null

        const prevAttrs = event.data.previous_attributes as
          | { invoice_settings?: { default_payment_method?: string | null } }
          | undefined
        const oldDefaultPM = prevAttrs?.invoice_settings?.default_payment_method ?? null

        // Só agimos se um PM novo foi setado E é diferente do anterior.
        // Sem essa guarda, qualquer customer.updated (mudança de email, etc)
        // dispararia uma chamada Stripe + query ao banco desnecessariamente.
        if (!newDefaultPM || newDefaultPM === oldDefaultPM) {
          stripeLogger.debug(
            { customerId, newDefaultPM, oldDefaultPM },
            'customer.updated: no relevant default PM change'
          )
          break
        }

        const store = await findStoreByCustomerId(customerId)
        if (!store) {
          stripeLogger.warn({ customerId, eventType: event.type }, 'store not found for customer')
          break
        }

        if (store.status !== 'SUSPENDED') {
          stripeLogger.debug(
            { storeId: store.id, status: store.status },
            'customer.updated: store not SUSPENDED, no recovery needed'
          )
          break
        }

        await reactivateSuspendedStoreFromPaymentMethod(store, newDefaultPM)
        break
      }

      default:
        stripeLogger.debug({ eventType: event.type }, 'webhook event ignored (unhandled type)')
        break
    }

    res.json({ received: true })
  } catch (err) {
    stripeLogger.error({ err, eventId: event.id, eventType: event.type }, 'webhook handler threw')
    next(err)
  }
}
