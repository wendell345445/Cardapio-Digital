// Stripe v22 CJS export requires this import pattern
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeSDK = require('stripe') as new (
  key: string,
  config?: Record<string, unknown>
) => StripeClient

interface StripeCustomer {
  id: string
  email: string | null
  name: string | null
}

interface StripeSubscription {
  id: string
  status: string
  items: { data: { id: string; price: { id: string } }[] }
  customer: string
  trial_end: number | null
  latest_invoice: string | null
}

interface StripeInvoice {
  id: string
  status: string
  paid: boolean
  subscription: string | null
}

interface StripeBillingPortalSession {
  id: string
  url: string
}

interface StripeClient {
  customers: {
    create(params: { email: string; name: string }): Promise<StripeCustomer>
    del(id: string): Promise<{ id: string; deleted: true }>
  }
  subscriptions: {
    create(params: Record<string, unknown>): Promise<StripeSubscription>
    retrieve(id: string): Promise<StripeSubscription>
    update(id: string, params: Record<string, unknown>): Promise<StripeSubscription>
    cancel(id: string): Promise<StripeSubscription>
  }
  invoices: {
    pay(id: string, params?: Record<string, unknown>): Promise<StripeInvoice>
  }
  billingPortal: {
    sessions: {
      create(params: { customer: string; return_url: string }): Promise<StripeBillingPortalSession>
    }
  }
  webhooks: {
    constructEvent(payload: Buffer, sig: string, secret: string): StripeEvent
  }
}

export interface StripeEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
    previous_attributes?: Record<string, unknown>
  }
}

export const PLAN_PRICE_IDS: Record<string, string> = {
  PROFESSIONAL: process.env.STRIPE_PROFESSIONAL_PRICE_ID ?? '',
  PREMIUM: process.env.STRIPE_PREMIUM_PRICE_ID ?? '',
}

let _stripe: StripeClient | null = null

function getStripe(): StripeClient {
  if (!_stripe) {
    _stripe = new StripeSDK(process.env.STRIPE_SECRET_KEY ?? '')
  }
  return _stripe
}

export async function createCustomer(email: string, name: string): Promise<StripeCustomer> {
  return getStripe().customers.create({ email, name })
}

/**
 * Cria uma Stripe Subscription com trial de 7 dias forçado no código.
 *
 * Passamos `trial_period_days: 7` direto aqui em vez de confiar no `recurring.trial_period_days`
 * configurado no Price — assim o trial fica independente do dashboard do Stripe e o mesmo código
 * funciona em qualquer ambiente. `payment_behavior: 'allow_incomplete'` complementa garantindo que
 * a subscription entre em `trialing` sem exigir PaymentMethod. Após o trial, se não houver cartão
 * cadastrado, o webhook `invoice.payment_failed` faz o downgrade automático (ver stripe.webhook.ts).
 *
 * IMPORTANTE: NÃO passar `expand: ['latest_invoice.payment_intent']` aqui. Esse expand é padrão antigo
 * do Stripe (fluxo "pagamento imediato + confirmação no frontend") e faz o Stripe tentar materializar
 * o PaymentIntent ativamente, falhando com "customer has no payment source". Sem o expand, a
 * subscription entra em `trialing` limpa. Ver hotfix v2.5.5 (2026-04-11).
 */
export async function createSubscription(
  customerId: string,
  planPriceId: string
): Promise<StripeSubscription> {
  return getStripe().subscriptions.create({
    customer: customerId,
    items: [{ price: planPriceId }],
    trial_period_days: 7,
    payment_behavior: 'allow_incomplete',
  })
}

/**
 * Wrapper idempotente de `customers.del()` — engole erros (ex: customer não existe).
 * Usado em rollback de auto-cadastro quando a transação Prisma falha após criar o customer.
 */
export async function cancelCustomerSafe(customerId: string): Promise<void> {
  try {
    await getStripe().customers.del(customerId)
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[STRIPE] cancelCustomerSafe failed for', customerId, err)
    }
  }
}

export async function updateSubscription(
  subscriptionId: string,
  newPlanPriceId: string
): Promise<StripeSubscription> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
  const itemId = subscription.items.data[0].id

  return getStripe().subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: newPlanPriceId }],
    proration_behavior: 'create_prorations',
  })
}

export async function cancelSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return getStripe().subscriptions.cancel(subscriptionId)
}

/**
 * Encerra o trial de uma subscription IMEDIATAMENTE — Stripe aceita o literal `'now'`
 * no campo `trial_end`, o que sobrescreve o `trial_period_days` configurado no Price.
 *
 * Usado pelo dev tool "Encerrar trial agora" no Owner panel. Como a subscription foi
 * criada sem PaymentMethod, precisamos passar `payment_behavior: 'allow_incomplete'`
 * no update — sem isso o Stripe rejeita com "no attached payment source" porque o
 * default `error_if_incomplete` exige que o charge subsequente consiga rodar.
 *
 * Nota: mesmo com `allow_incomplete` o Stripe não dispara `invoice.payment_failed`
 * quando não há payment method (ele nem tenta cobrar — a sub vai direto pra
 * `incomplete`/`past_due`). O dev tool compensa isso atualizando `stripeTrialEndsAt`
 * localmente — ver `endTrialNow` em owner.service.ts.
 *
 * NÃO usar fora de dev tools / testes. Em produção o trial expira naturalmente.
 */
export async function endSubscriptionTrialNow(
  subscriptionId: string
): Promise<StripeSubscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    trial_end: 'now',
    payment_behavior: 'allow_incomplete',
  })
}

/**
 * Recupera uma subscription pelo id. Usado pelo webhook `customer.updated` pra
 * descobrir em que estado a sub está depois que o cliente anexa um PaymentMethod
 * via Customer Portal — só assim conseguimos decidir se pagamos a invoice em aberto
 * ou se a sub já está ativa e basta sincronizar o status local.
 */
export async function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return getStripe().subscriptions.retrieve(subscriptionId)
}

/**
 * Atualiza o `default_payment_method` de uma subscription. Necessário porque
 * anexar um PM ao customer via Customer Portal não propaga automaticamente pra
 * subscriptions já existentes em estado `incomplete`. Sem esse update, mesmo
 * tentando pagar a invoice o Stripe ainda usa "no payment method".
 */
export async function setSubscriptionDefaultPaymentMethod(
  subscriptionId: string,
  paymentMethodId: string
): Promise<StripeSubscription> {
  return getStripe().subscriptions.update(subscriptionId, {
    default_payment_method: paymentMethodId,
  })
}

/**
 * Tenta cobrar uma invoice em aberto. Idempotente do lado Stripe (chamadas
 * repetidas em invoice já paga retornam 400, então capturamos no caller).
 *
 * Usado pelo webhook `customer.updated` quando detectamos que o cliente anexou
 * um PaymentMethod via Customer Portal numa sub que ficou em `incomplete`/`past_due`.
 */
export async function payInvoice(invoiceId: string): Promise<StripeInvoice> {
  return getStripe().invoices.pay(invoiceId)
}

export function constructWebhookEvent(payload: Buffer, signature: string): StripeEvent {
  return getStripe().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET ?? '')
}

/**
 * Cria uma Stripe Billing Portal Session — o admin da loja é redirecionado pra UI do Stripe
 * onde pode gerenciar método de pagamento, ver faturas, cancelar assinatura, etc.
 *
 * Pré-requisito: habilitar Customer Portal em Dashboard → Settings → Billing → Customer portal.
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<StripeBillingPortalSession> {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}
