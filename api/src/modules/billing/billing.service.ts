import {
  createCustomer,
  createPixAutoAuthorization,
  createRecurrentCheckout,
  createTokenizedCharge,
  getPixAutoAuthorization,
  getSubscription,
  updateSubscription,
} from '../../shared/asaas/asaas.service'
import { PLAN_FEATURES, PLAN_VALUES } from '../../shared/billing/plans'
import { asaasLogger } from '../../shared/logger/logger'
import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

const PLAN_LABEL: Record<string, string> = {
  PROFESSIONAL: 'Profissional',
  PREMIUM: 'Premium',
}

// O Asaas rejeita callback URLs com host `localhost` ("campo successUrl é inválido").
// Em dev (WEB_URL=http://localhost:5173) trocamos por um domínio público só pro
// checkout ser aceito — o cliente é redirecionado pra lá após pagar (inofensivo em dev).
// Em prod WEB_URL já é https://menupanda.ai e passa direto.
function publicWebUrl(webUrl: string): string {
  if (/localhost|127\.0\.0\.1|\.test(\/|$)/.test(webUrl)) {
    return `https://${process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.ai'}`
  }
  return webUrl
}

/**
 * Data (YYYY-MM-DD) da 1ª cobrança = HOJE (pré-pago). Assinar cobra no ato e o ciclo
 * mensal começa a partir de hoje — quem assina durante o trial encerra o trial ao pagar.
 * (nextDueDate = hoje faz o Asaas cobrar imediatamente após a criação da assinatura.)
 */
function firstChargeDate(): string {
  return new Date().toISOString().slice(0, 10)
}

async function loadStore(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { users: { where: { role: 'ADMIN' }, select: { email: true, name: true }, take: 1 } },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)
  return store
}

/** Garante que a loja tenha um Asaas customer; cria e persiste se faltar. */
async function ensureCustomer(store: Awaited<ReturnType<typeof loadStore>>): Promise<string> {
  if (store.asaasCustomerId) return store.asaasCustomerId

  const admin = store.users[0]
  const customer = await createCustomer({
    name: store.name,
    email: admin?.email ?? `loja-${store.slug}@menupanda.ai`,
    phone: store.phone,
    cpfCnpj: store.documentNumber ?? undefined, // exigido pro PIX Automático
  })
  await prisma.store.update({ where: { id: store.id }, data: { asaasCustomerId: customer.id } })
  return customer.id
}

// ─── Cartão: Checkout hospedado ───────────────────────────────────────────────

/**
 * Cria um Checkout recorrente por CARTÃO e retorna a URL pra redirecionar o lojista.
 * Ao pagar, o Asaas cria a assinatura e avisa via webhook PAYMENT_* (→ status ACTIVE).
 */
export async function createCheckoutSession(storeId: string, webUrl: string): Promise<{ url: string }> {
  const store = await loadStore(storeId)
  const value = PLAN_VALUES[store.plan]
  const base = publicWebUrl(webUrl)

  // Pré-preenche o checkout hospedado com os dados que já temos do cadastro
  // (nome da loja, email do admin, telefone e CPF/CNPJ) — o lojista só digita o
  // cartão. O Asaas exige cpfCnpj quando `customerData` está presente, então só
  // enviamos quando temos o documentNumber; sem ele, o checkout coleta na tela.
  const admin = store.users[0]
  const customerData = store.documentNumber
    ? {
        name: store.name,
        email: admin?.email ?? undefined,
        phone: store.phone,
        cpfCnpj: store.documentNumber,
      }
    : undefined
  const checkout = await createRecurrentCheckout({
    storeId: store.id,
    value,
    planName: PLAN_LABEL[store.plan] ?? store.plan,
    nextDueDate: firstChargeDate(),
    customerData,
    callbackUrls: {
      successUrl: `${base}/admin/configuracoes?assinatura=ok`,
      cancelUrl: `${base}/admin/configuracoes?assinatura=cancelado`,
      expiredUrl: `${base}/admin/configuracoes?assinatura=expirado`,
    },
  })

  await prisma.store.update({ where: { id: store.id }, data: { asaasCheckoutId: checkout.id } })
  asaasLogger.info({ storeId, checkoutId: checkout.id }, 'billing: card checkout created')

  return { url: checkout.link }
}

// ─── PIX Automático ───────────────────────────────────────────────────────────

export interface PixAutoResult {
  authId: string
  status: string
  qrPayload: string
  qrImage: string
}

/**
 * Cria uma autorização de PIX Automático e retorna o QR pro front exibir.
 * O lojista escaneia, paga a 1ª cobrança e consente; o webhook
 * PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED ativa a loja.
 */
export async function createPixAutoSubscription(storeId: string): Promise<PixAutoResult> {
  const store = await loadStore(storeId)

  // O Asaas EXIGE CPF/CNPJ pra criar a autorização de PIX Automático. O documento é
  // coletado no cadastro da loja (Minha Loja → Dados). Se faltar, avisa onde preencher.
  if (!store.documentNumber) {
    throw new AppError(
      'Preencha o CPF ou CNPJ da loja em Minha Loja → Dados para pagar com PIX.',
      422,
      'DOCUMENT_REQUIRED'
    )
  }

  const customerId = await ensureCustomer(store)
  const value = PLAN_VALUES[store.plan]

  const auth = await createPixAutoAuthorization({
    storeId: store.id,
    customerId,
    value,
    startDate: firstChargeDate(),
    description: `Assinatura ${PLAN_LABEL[store.plan] ?? store.plan}`,
  })

  await prisma.store.update({ where: { id: store.id }, data: { asaasPixAuthId: auth.id } })
  asaasLogger.info({ storeId, authId: auth.id }, 'billing: pix-auto authorization created')

  return { authId: auth.id, status: auth.status, qrPayload: auth.payload, qrImage: auth.encodedImage }
}

/** Consulta o status atual da autorização PIX Automático da loja (fallback do webhook). */
export async function getPixAutoStatus(storeId: string): Promise<{ status: string | null }> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { asaasPixAuthId: true },
  })
  if (!store?.asaasPixAuthId) return { status: null }

  const auth = await getPixAutoAuthorization(store.asaasPixAuthId)
  return { status: auth.status }
}

// ─── Troca de plano (upgrade com pro-rata / downgrade agendado) ───────────────

type PlanName = 'PROFESSIONAL' | 'PREMIUM'
const CYCLE_DAYS = 30

// Dias de calendário entre `from` e `to` (ignora horas) — pro-rata previsível,
// independente do horário do clique. Ex: hoje e nextDueDate 30 dias à frente = 30.
function daysBetween(from: Date, to: Date): number {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((day(to) - day(from)) / 86400000)
}

/**
 * Calcula o valor pro-rata a cobrar num UPGRADE: a diferença de mensalidade proporcional
 * aos dias restantes do ciclo atual. Ex: Prof(99)→Premium(139), faltam 15 de 30 dias →
 * (139−99) × 15/30 = R$20,00. Arredonda a 2 casas; nunca negativo.
 */
function prorataUpgradeValue(fromPlan: PlanName, toPlan: PlanName, nextDueDate: Date): number {
  const diffMonthly = PLAN_VALUES[toPlan] - PLAN_VALUES[fromPlan]
  const remaining = Math.max(0, Math.min(CYCLE_DAYS, daysBetween(new Date(), nextDueDate)))
  return Math.round(diffMonthly * (remaining / CYCLE_DAYS) * 100) / 100
}

export interface ChangePlanPreview {
  currentPlan: PlanName
  targetPlan: PlanName
  direction: 'UPGRADE' | 'DOWNGRADE'
  /** valor cobrado AGORA (pro-rata no upgrade; 0 no downgrade) */
  chargeNow: number
  /** valor da mensalidade a partir do próximo ciclo */
  nextCycleValue: number
  nextDueDate: string
}

async function loadActiveCardStore(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new AppError('Loja não encontrada', 404)
  if (store.status !== 'ACTIVE') throw new AppError('Troca de plano só para loja com assinatura ativa', 422)
  if (store.billingMethod !== 'CARD' || !store.asaasSubscriptionId) {
    throw new AppError('Troca de plano disponível apenas para assinatura por cartão', 422)
  }
  return store
}

/** Preview da troca de plano — mostra ao lojista o que será cobrado antes de confirmar. */
export async function getChangePlanPreview(storeId: string, targetPlan: PlanName): Promise<ChangePlanPreview> {
  const store = await loadActiveCardStore(storeId)
  const currentPlan = store.plan as PlanName
  if (currentPlan === targetPlan) throw new AppError('A loja já está neste plano', 422)

  const sub = await getSubscription(store.asaasSubscriptionId!)
  const nextDueDate = new Date(sub.nextDueDate)
  const direction = PLAN_VALUES[targetPlan] > PLAN_VALUES[currentPlan] ? 'UPGRADE' : 'DOWNGRADE'

  return {
    currentPlan,
    targetPlan,
    direction,
    chargeNow: direction === 'UPGRADE' ? prorataUpgradeValue(currentPlan, targetPlan, nextDueDate) : 0,
    nextCycleValue: PLAN_VALUES[targetPlan],
    nextDueDate: sub.nextDueDate,
  }
}

/**
 * Executa a troca de plano:
 *  • UPGRADE: cobra a diferença pro-rata AGORA (cartão tokenizado), muda o valor da assinatura
 *    pro novo plano (próximos ciclos), e aplica o plano+features na hora (cliente quer o recurso já).
 *  • DOWNGRADE: NÃO cobra nem estorna. Mantém plano+features atuais até o fim do ciclo já pago;
 *    grava `pendingPlan` e muda o valor da assinatura pro próximo ciclo. O webhook do próximo
 *    pagamento aplica o rebaixamento (ver asaas.webhook.ts).
 */
export async function changePlan(storeId: string, targetPlan: PlanName): Promise<{ direction: string; chargedNow: number }> {
  const store = await loadActiveCardStore(storeId)
  const currentPlan = store.plan as PlanName
  if (currentPlan === targetPlan) throw new AppError('A loja já está neste plano', 422)

  const sub = await getSubscription(store.asaasSubscriptionId!)
  const direction = PLAN_VALUES[targetPlan] > PLAN_VALUES[currentPlan] ? 'UPGRADE' : 'DOWNGRADE'

  if (direction === 'UPGRADE') {
    const token = sub.creditCard?.creditCardToken
    if (!token) throw new AppError('Cartão não encontrado na assinatura — refaça a assinatura por cartão', 422)

    const chargeNow = prorataUpgradeValue(currentPlan, targetPlan, new Date(sub.nextDueDate))
    if (chargeNow > 0) {
      await createTokenizedCharge({
        customerId: sub.customer,
        creditCardToken: token,
        value: chargeNow,
        description: `Upgrade proporcional ${currentPlan}→${targetPlan}`,
        externalReference: store.id,
      })
    }
    // Valor dos próximos ciclos = novo plano.
    await updateSubscription(store.asaasSubscriptionId!, PLAN_VALUES[targetPlan])
    // Aplica plano + features na hora + limpa qualquer downgrade pendente.
    await prisma.store.update({
      where: { id: store.id },
      data: { plan: targetPlan, features: PLAN_FEATURES[targetPlan], pendingPlan: null },
    })
    await prisma.auditLog.create({
      data: { storeId: store.id, userId: null, action: 'store.plan.upgrade', entity: 'Store', entityId: store.id, data: { from: currentPlan, to: targetPlan, chargedNow: chargeNow } },
    })
    asaasLogger.info({ storeId, from: currentPlan, to: targetPlan, chargeNow }, 'plan upgraded (pro-rata)')
    return { direction, chargedNow: chargeNow }
  }

  // DOWNGRADE: agenda pro próximo ciclo. Não mexe em plan/features agora (mantém Premium até virar).
  await updateSubscription(store.asaasSubscriptionId!, PLAN_VALUES[targetPlan])
  await prisma.store.update({ where: { id: store.id }, data: { pendingPlan: targetPlan } })
  await prisma.auditLog.create({
    data: { storeId: store.id, userId: null, action: 'store.plan.downgrade.scheduled', entity: 'Store', entityId: store.id, data: { from: currentPlan, to: targetPlan } },
  })
  asaasLogger.info({ storeId, from: currentPlan, to: targetPlan }, 'plan downgrade scheduled (next cycle)')
  return { direction, chargedNow: 0 }
}
