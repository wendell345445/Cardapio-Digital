import { NextFunction, Request, Response } from 'express'

import { PLAN_FEATURES } from '../../shared/billing/plans'
import { sendPaymentFailedEmail } from '../../shared/email/email.service'
import { asaasLogger } from '../../shared/logger/logger'
import { prisma } from '../../shared/prisma/prisma'
import { verifyWebhookToken, type AsaasWebhookEvent } from '../../shared/asaas/asaas.service'

// Grace period após falha/atraso de cobrança antes da suspensão automática.
// Cron `trial-suspension.job` varre lojas com `trialEndsAt < NOW()` e suspende.
const GRACE_PERIOD_DAYS = Number(process.env.GRACE_PERIOD_DAYS ?? 1)

type StoreWithAdmins = {
  id: string
  status: string
  plan: string
  pendingPlan: string | null
  users: { email: string | null }[]
} | null

/**
 * Localiza a loja a partir do evento. Ordem de tentativa (mais confiável → mais frouxa):
 *  1. `payment.externalReference` → `Store.id` (vem null no Checkout hospedado; volta a valer se criarmos a sub server-side).
 *  2. `payment.subscription` → `asaasSubscriptionId` (renovações mensais — asaasSubscriptionId já gravado na 1ª cobrança).
 *  3. `payment.checkoutSession` → `asaasCheckoutId` (1ª cobrança do Checkout — único elo disponível nela).
 *  4. `payment.customer` → `asaasCustomerId` (fallback; no Checkout hospedado o customer difere).
 *  5. PIX Auto: `authorization.id` (ou `paymentInstruction.authorization.id`) → `asaasPixAuthId`.
 */
// Traz os campos que o handler usa (id, status, plan/pendingPlan p/ aplicar downgrade agendado)
// + o email do admin p/ email de falha.
const storeSelect = {
  id: true,
  status: true,
  plan: true,
  pendingPlan: true,
  users: { where: { role: 'ADMIN' as const }, select: { email: true } },
}

async function findStore(event: AsaasWebhookEvent): Promise<StoreWithAdmins> {
  const externalRef = event.payment?.externalReference
  if (externalRef) {
    const store = await prisma.store.findUnique({ where: { id: externalRef }, select: storeSelect })
    if (store) return store
  }

  const subscriptionId = event.payment?.subscription
  if (subscriptionId) {
    const store = await prisma.store.findFirst({ where: { asaasSubscriptionId: subscriptionId }, select: storeSelect })
    if (store) return store
  }

  // 1ª cobrança do cartão (Checkout hospedado): externalReference vem null, o customer
  // é um cus_ novo do pagador e a subscription ainda não foi persistida — o único elo é
  // o checkoutSession, casado contra o asaasCheckoutId gravado na criação do checkout.
  // Nas renovações a via `subscription` acima já resolve (asaasSubscriptionId foi gravado aqui).
  const checkoutSession = event.payment?.checkoutSession
  if (checkoutSession) {
    const store = await prisma.store.findFirst({ where: { asaasCheckoutId: checkoutSession }, select: storeSelect })
    if (store) return store
  }

  const customerId = event.payment?.customer
  if (customerId) {
    const store = await prisma.store.findFirst({ where: { asaasCustomerId: customerId }, select: storeSelect })
    if (store) return store
  }

  const authId = event.authorization?.id ?? event.paymentInstruction?.authorization?.id
  if (authId) {
    const store = await prisma.store.findFirst({ where: { asaasPixAuthId: authId }, select: storeSelect })
    if (store) return store
  }

  return null
}

async function activateStore(store: NonNullable<StoreWithAdmins>, action: string, data: object) {
  // Não-regressivo: loja deliberadamente suspensa (refund/chargeback/cancelamento de
  // assinatura) NÃO deve ser reativada por um PAYMENT_CONFIRMED/RECEIVED atrasado ou
  // reentregue de uma cobrança antiga. Reativação de SUSPENDED só via nova assinatura
  // (fluxo de billing), não por webhook de pagamento pretérito.
  if (store.status === 'SUSPENDED') {
    asaasLogger.warn({ storeId: store.id, action }, 'store SUSPENDED — activation skipped (non-regressive)')
    return
  }
  await prisma.store.update({
    where: { id: store.id },
    data: { status: 'ACTIVE', trialEndsAt: null },
  })
  await prisma.auditLog.create({
    data: { storeId: store.id, userId: null, action, entity: 'Store', entityId: store.id, data },
  })
  asaasLogger.info({ storeId: store.id, action }, 'store activated')
}

async function startGracePeriod(store: NonNullable<StoreWithAdmins>, action: string, data: object) {
  const graceEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  await prisma.store.update({ where: { id: store.id }, data: { trialEndsAt: graceEnd } })
  await prisma.auditLog.create({
    data: { storeId: store.id, userId: null, action, entity: 'Store', entityId: store.id, data },
  })

  const adminEmail = store.users[0]?.email
  if (adminEmail) {
    void sendPaymentFailedEmail({ adminEmail, storeName: '', graceDays: GRACE_PERIOD_DAYS }).catch((err) =>
      asaasLogger.error({ storeId: store.id, err }, 'sendPaymentFailedEmail failed')
    )
  }
  asaasLogger.info({ storeId: store.id, action, graceEnd }, 'grace period started')
}

async function suspendStore(store: NonNullable<StoreWithAdmins>, action: string, data: object) {
  await prisma.store.update({ where: { id: store.id }, data: { status: 'SUSPENDED' } })
  await prisma.auditLog.create({
    data: { storeId: store.id, userId: null, action, entity: 'Store', entityId: store.id, data },
  })
  asaasLogger.info({ storeId: store.id, action }, 'store suspended')
}

/**
 * Webhook único do Asaas. Trata dois grupos de evento:
 *  • PAYMENT_*                    → fluxo de cartão (Checkout recorrente).
 *  • PIX_AUTOMATIC_RECURRING_*    → fluxo de PIX Automático.
 *
 * Autenticação: header `asaas-access-token` comparado com ASAAS_WEBHOOK_TOKEN.
 * Sempre responde 200 { received: true } (mesmo em no-op) pra evitar retries.
 */
export async function asaasWebhookController(req: Request, res: Response, _next: NextFunction) {
  const token = req.headers['asaas-access-token'] as string | undefined
  if (!verifyWebhookToken(token)) {
    asaasLogger.warn('webhook: invalid asaas-access-token')
    return res.status(401).json({ error: 'invalid token' })
  }

  const event = req.body as AsaasWebhookEvent
  asaasLogger.info({ eventId: event.id, eventType: event.event }, 'webhook received')

  try {
    const store = await findStore(event)
    if (!store) {
      // Um evento de PAGAMENTO sem loja correspondente é um alarme (pagamento órfão —
      // ex: 2 checkouts na mesma loja, o antigo sobrescrito). Sobe pra `error` com as
      // chaves de correlação pra facilitar o diagnóstico. Eventos não-pagamento ficam em warn.
      const isPayment = event.event?.startsWith('PAYMENT_')
      const meta = {
        eventType: event.event,
        checkoutSession: event.payment?.checkoutSession,
        subscription: event.payment?.subscription,
        customer: event.payment?.customer,
      }
      if (isPayment) asaasLogger.error(meta, 'PAYMENT event with no matching store (orphan)')
      else asaasLogger.warn(meta, 'store not found for event')
      return res.json({ received: true })
    }

    switch (event.event) {
      // ── Cartão (Checkout recorrente) ──────────────────────────────────────
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        // Persiste a subscription id na 1ª cobrança confirmada (se ainda não gravada).
        const subscriptionId = event.payment?.subscription
        if (subscriptionId) {
          await prisma.store.update({
            where: { id: store.id },
            data: { asaasSubscriptionId: subscriptionId, billingMethod: 'CARD' },
          })
        }
        // Downgrade agendado: se há pendingPlan, esta cobrança é a virada do ciclo —
        // aplica o rebaixamento agora (plan = pendingPlan, features rebaixadas, limpa pendingPlan).
        if (store.pendingPlan && store.pendingPlan !== store.plan) {
          const newPlan = store.pendingPlan as 'PROFESSIONAL' | 'PREMIUM'
          await prisma.store.update({
            where: { id: store.id },
            data: { plan: newPlan, features: PLAN_FEATURES[newPlan], pendingPlan: null },
          })
          await prisma.auditLog.create({
            data: { storeId: store.id, userId: null, action: 'store.plan.downgrade.applied', entity: 'Store', entityId: store.id, data: { from: store.plan, to: newPlan } },
          })
          asaasLogger.info({ storeId: store.id, from: store.plan, to: newPlan }, 'scheduled downgrade applied on renewal')
        }
        await activateStore(store, 'store.payment.succeeded', { paymentId: event.payment?.id })
        break
      }

      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED': {
        await startGracePeriod(store, 'store.payment.failed', {
          paymentId: event.payment?.id,
          event: event.event,
        })
        break
      }

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED': {
        await suspendStore(store, 'store.subscription.cancelled', { paymentId: event.payment?.id })
        break
      }

      // ── PIX Automático ────────────────────────────────────────────────────
      case 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED': {
        await prisma.store.update({ where: { id: store.id }, data: { billingMethod: 'PIX_AUTO' } })
        await activateStore(store, 'store.pixauto.activated', { authId: event.authorization?.id })
        break
      }

      case 'PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED': {
        await startGracePeriod(store, 'store.pixauto.failed', {
          authId: event.paymentInstruction?.authorization?.id,
        })
        break
      }

      case 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED':
      case 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED':
      case 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED': {
        await suspendStore(store, 'store.pixauto.cancelled', {
          authId: event.authorization?.id,
          event: event.event,
        })
        break
      }

      default:
        asaasLogger.info({ eventType: event.event }, 'webhook event ignored')
        break
    }
  } catch (err) {
    // Não propaga: responde 200 pra evitar retempo do Asaas. Erro fica logado.
    asaasLogger.error({ err, eventType: event.event }, 'webhook handler error')
  }

  return res.json({ received: true })
}
