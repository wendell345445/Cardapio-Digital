import axios, { AxiosInstance, isAxiosError } from 'axios'

import { asaasLogger } from '../logger/logger'
import { AppError } from '../middleware/error.middleware'

// ─── Cliente Asaas ────────────────────────────────────────────────────────────
// Substitui o antigo wrapper Stripe. Cobre os DOIS fluxos de assinatura:
//   • Cartão de crédito  → Checkout hospedado (POST /checkouts), recorrente.
//   • PIX Automático     → Autorização de débito recorrente (POST /pixAutomaticAuthorization).
// Auth via header custom `access_token` (NÃO Bearer) + User-Agent obrigatório.
// Docs: https://docs.asaas.com — ver memória reference-asaas-api.

// Ciclo de cobrança recorrente. Default MONTHLY (produção). Em sandbox dá pra usar
// WEEKLY (BILLING_CYCLE=WEEKLY) pra validar a recorrência em 7 dias em vez de 30.
const VALID_CYCLES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY']
function billingCycle(): string {
  const c = (process.env.BILLING_CYCLE || '').toUpperCase()
  return VALID_CYCLES.includes(c) ? c : 'MONTHLY'
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface AsaasCustomer {
  id: string
  name: string
  email: string | null
  cpfCnpj: string | null
}

export interface AsaasCheckout {
  id: string
  link: string
  status: string
}

export interface AsaasSubscription {
  id: string
  status: string
  value: number
  cycle: string
  nextDueDate: string
  customer: string
  /** Presente quando a assinatura é por cartão — o token é reutilizável em cobranças avulsas. */
  creditCard?: {
    creditCardNumber?: string
    creditCardBrand?: string
    creditCardToken?: string
  }
}

export interface AsaasPixAuthorization {
  id: string
  status: string
  /** copia-e-cola do QR de autorização (Jornada 3) */
  payload: string
  /** QR em PNG base64 */
  encodedImage: string
}

/** Dados do pagador para o Checkout (cartão). CPF/CNPJ é opcional — o Checkout coleta na tela. */
export interface AsaasCustomerData {
  name: string
  email?: string
  phone?: string
  cpfCnpj?: string
}

export interface AsaasCallbackUrls {
  successUrl: string
  cancelUrl: string
  expiredUrl: string
}

/** Payload de um evento de webhook do Asaas (cobrança OU pix-automático). */
export interface AsaasWebhookEvent {
  id?: string
  event: string
  dateCreated?: string
  payment?: {
    id: string
    customer?: string
    subscription?: string | null
    externalReference?: string | null
    /**
     * Id do Checkout hospedado que originou esta cobrança (= `asaasCheckoutId` na Store).
     * Única correlação confiável na 1ª cobrança do cartão: o Checkout hospedado NÃO
     * propaga externalReference (vem null), cria um `cus_` novo (CPF do pagador, diferente
     * do nosso) e a subscription ainda não foi persistida. Ver findStore em asaas.webhook.ts.
     */
    checkoutSession?: string | null
    value?: number
    billingType?: string
    status?: string
    dueDate?: string
  }
  authorization?: {
    id: string
    status?: string
    customerId?: string
  }
  paymentInstruction?: {
    id: string
    payment?: string
    authorization?: { id: string }
  }
}

// ─── Instância HTTP ───────────────────────────────────────────────────────────

let _client: AxiosInstance | null = null

function getClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3',
      timeout: 60_000, // Asaas recomenda ≥60s pra evitar duplicidade de criação.
      headers: {
        access_token: process.env.ASAAS_API_KEY || '',
        'User-Agent': process.env.ASAAS_USER_AGENT || 'MenuPanda',
        'Content-Type': 'application/json',
      },
    })
  }
  return _client
}

/**
 * Normaliza erros do Asaas (formato `{ errors: [{ code, description }] }`) num AppError 422.
 * Loga o payload cru pro asaas.log pra facilitar diagnóstico sem vazar pro cliente.
 */
function asaasError(context: string, err: unknown): AppError {
  if (isAxiosError(err)) {
    const status = err.response?.status
    // Asaas devolve erro ora como `{ errors: [{ description }] }`, ora como `{ message }`.
    const data = err.response?.data as
      | { errors?: { code: string; description: string }[]; message?: string }
      | undefined
    const description = data?.errors?.[0]?.description || data?.message
    asaasLogger.error({ context, status, data }, 'asaas request failed')

    // 403 = recurso não habilitado na conta (ex: PIX Automático precisa de liberação
    // pelo gerente de contas Asaas). Mensagem clara pro operador, status 422 (regra).
    if (status === 403) {
      return new AppError(
        description || 'Recurso não habilitado na conta Asaas — contate o gerente de contas.',
        422
      )
    }
    return new AppError(description || `Falha ao comunicar com o Asaas (${context})`, 422)
  }
  asaasLogger.error({ context, err }, 'asaas request failed (non-axios)')
  return new AppError(`Falha ao comunicar com o Asaas (${context})`, 422)
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function createCustomer(params: {
  name: string
  email: string
  cpfCnpj?: string
  phone?: string
}): Promise<AsaasCustomer> {
  try {
    const { data } = await getClient().post<AsaasCustomer>('/customers', {
      name: params.name,
      email: params.email,
      cpfCnpj: params.cpfCnpj,
      phone: params.phone,
    })
    return data
  } catch (err) {
    throw asaasError('createCustomer', err)
  }
}

/**
 * Deleta um customer (rollback idempotente). Engole erros — customer órfão é inofensivo.
 */
export async function deleteCustomerSafe(customerId: string): Promise<void> {
  try {
    await getClient().delete(`/customers/${customerId}`)
  } catch (err) {
    asaasLogger.warn({ customerId, err: isAxiosError(err) ? err.response?.data : err }, 'deleteCustomerSafe failed')
  }
}

// ─── Cartão: Checkout hospedado recorrente ────────────────────────────────────

/**
 * Cria um Checkout hospedado recorrente por CARTÃO. O front redireciona o lojista
 * pro `link` retornado; ao pagar, o Asaas cria a assinatura e nos avisa via webhook
 * PAYMENT_*. `externalReference = storeId` correlaciona o webhook de volta à loja.
 * `nextDueDate` = data da 1ª cobrança (hoje+7d durante o trial → pré-pago).
 */
export async function createRecurrentCheckout(params: {
  storeId: string
  value: number
  planName: string
  customerData?: AsaasCustomerData
  nextDueDate: string // YYYY-MM-DD
  callbackUrls: AsaasCallbackUrls
}): Promise<AsaasCheckout> {
  try {
    // `customerData` só é enviado quando temos `cpfCnpj` — o Asaas exige cpfCnpj
    // quando o objeto está presente. Sem ele, omitimos e o Asaas coleta nome/CPF/
    // cartão na própria tela hospedada (decisão do plano: "Asaas coleta no checkout").
    const customerData = params.customerData?.cpfCnpj ? params.customerData : undefined
    const description = `Assinatura ${params.planName} — MenuPanda`
    const { data } = await getClient().post<AsaasCheckout>('/checkouts', {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      callback: params.callbackUrls,
      items: [
        {
          name: `Assinatura ${params.planName}`,
          description,
          value: params.value,
          quantity: 1,
        },
      ],
      subscription: {
        cycle: billingCycle(),
        nextDueDate: params.nextDueDate,
        description,
      },
      // NOTA: o Asaas NÃO propaga externalReference pelo Checkout hospedado (testado:
      // vem null no payment e na subscription, em qualquer posição). A correlação do
      // webhook de volta à loja é feita por `payment.checkoutSession = asaasCheckoutId`
      // (ver findStore em asaas.webhook.ts). Mantemos externalReference mesmo assim —
      // é inofensivo e volta a valer se o Asaas corrigir ou se criarmos a sub server-side.
      ...(customerData ? { customerData } : {}),
      externalReference: params.storeId,
    })
    return data
  } catch (err) {
    throw asaasError('createRecurrentCheckout', err)
  }
}

// ─── PIX Automático: autorização de débito recorrente (Jornada 3) ─────────────

/**
 * Cria uma autorização de PIX Automático. Retorna um QR (payload + encodedImage) que
 * o lojista escaneia no app do banco pra pagar a 1ª cobrança E consentir os débitos
 * recorrentes. Ao consentir, o status vira ACTIVE (webhook AUTHORIZATION_ACTIVATED).
 * `contractId = storeId` correlaciona (payload de cobrança não traz externalReference).
 * `startDate` = data da 1ª cobrança (hoje+7d durante o trial).
 */
export async function createPixAutoAuthorization(params: {
  storeId: string
  customerId: string
  value: number
  startDate: string // YYYY-MM-DD
  description: string
}): Promise<AsaasPixAuthorization> {
  try {
    const { data } = await getClient().post<AsaasPixAuthorization>('/pix/automatic/authorizations', {
      customerId: params.customerId,
      frequency: billingCycle(),
      contractId: params.storeId.slice(0, 35),
      startDate: params.startDate,
      value: params.value,
      description: params.description.slice(0, 35),
      paymentCreationMode: 'SUBSCRIPTION',
      retryPolicy: 'ALLOW_THREE_IN_SEVEN_DAYS',
      immediateQrCode: {
        originalValue: params.value,
        expirationSeconds: 3600,
        description: params.description.slice(0, 35),
      },
    })
    return data
  } catch (err) {
    throw asaasError('createPixAutoAuthorization', err)
  }
}

export async function getPixAutoAuthorization(authId: string): Promise<AsaasPixAuthorization & { status: string }> {
  try {
    const { data } = await getClient().get<AsaasPixAuthorization>(`/pix/automatic/authorizations/${authId}`)
    return data
  } catch (err) {
    throw asaasError('getPixAutoAuthorization', err)
  }
}

export async function cancelPixAutoAuthorization(authId: string): Promise<void> {
  try {
    await getClient().delete(`/pix/automatic/authorizations/${authId}`)
  } catch (err) {
    asaasLogger.warn({ authId, err: isAxiosError(err) ? err.response?.data : err }, 'cancelPixAutoAuthorization failed')
  }
}

// ─── Assinatura (gestão do fluxo de cartão) ───────────────────────────────────

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  try {
    const { data } = await getClient().get<AsaasSubscription>(`/subscriptions/${subscriptionId}`)
    return data
  } catch (err) {
    throw asaasError('getSubscription', err)
  }
}

/** Atualiza o valor de uma assinatura (upgrade/downgrade de plano no fluxo de cartão). */
export async function updateSubscription(
  subscriptionId: string,
  value: number
): Promise<AsaasSubscription> {
  try {
    const { data } = await getClient().put<AsaasSubscription>(`/subscriptions/${subscriptionId}`, { value })
    return data
  } catch (err) {
    throw asaasError('updateSubscription', err)
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  try {
    await getClient().delete(`/subscriptions/${subscriptionId}`)
  } catch (err) {
    asaasLogger.warn({ subscriptionId, err: isAxiosError(err) ? err.response?.data : err }, 'cancelSubscription failed')
  }
}

export interface AsaasCharge {
  id: string
  status: string
  value: number
}

/**
 * Cria uma cobrança AVULSA (única) por cartão reutilizando um cartão já tokenizado —
 * sem pedir os dados do cartão de novo. Usado pra cobrar a diferença proporcional (pro-rata)
 * no upgrade de plano. `dueDate = hoje` cobra imediatamente (status CONFIRMED).
 */
export async function createTokenizedCharge(params: {
  customerId: string
  creditCardToken: string
  value: number
  description: string
  externalReference: string
}): Promise<AsaasCharge> {
  try {
    const { data } = await getClient().post<AsaasCharge>('/payments', {
      customer: params.customerId,
      billingType: 'CREDIT_CARD',
      value: params.value,
      dueDate: new Date().toISOString().slice(0, 10),
      description: params.description,
      externalReference: params.externalReference,
      creditCardToken: params.creditCardToken,
    })
    return data
  } catch (err) {
    throw asaasError('createTokenizedCharge', err)
  }
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

/**
 * Valida o token do webhook Asaas — chega no header `asaas-access-token`, comparado
 * com `ASAAS_WEBHOOK_TOKEN` (setado também na config do webhook no painel Asaas).
 * Substitui o `constructWebhookEvent` (HMAC) do Stripe: Asaas usa JSON normal + token.
 */
export function verifyWebhookToken(headerToken: string | undefined): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || ''
  return expected.length > 0 && headerToken === expected
}
