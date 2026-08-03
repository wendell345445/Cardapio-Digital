import crypto from 'node:crypto'

import axios, { AxiosInstance, isAxiosError } from 'axios'

import { logger } from '../logger/logger'
import { AppError } from '../middleware/error.middleware'

// ─── Cliente iFood (Merchant-API, modelo Centralizado) ────────────────────────
// Uma credencial (clientId/clientSecret) do integrador → acesso a N merchants.
// NÃO há userCode/authorization_code (isso é do modelo Distribuído): o lojista
// autoriza o app "Menu Panda" no Portal do Parceiro iFood, e o merchant passa a
// aparecer em GET /merchants. Token client_credentials expira ~6h, sem refresh.
// Docs: developer.ifood.com.br (bloqueia fetch; ver memória reference-ifood-api).

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface IFoodMerchant {
  id: string // UUID usado nos paths da API
  name: string
  corporateName?: string
}

export interface IFoodEvent {
  id: string
  /** Código do evento. Alguns ambientes mandam `code` curto e `fullCode` legível
   *  (ex "PLACED"/"CONFIRMED"). O ingestor usa `fullCode ?? code` pra ser robusto. */
  code: string
  fullCode?: string
  orderId: string
  merchantId?: string
  createdAt?: string
}

export interface IFoodOrder {
  id: string
  displayId?: string
  merchant?: { id: string; name?: string }
  orderType?: string // DELIVERY | TAKEOUT | ...
  customer?: { name?: string; phone?: unknown }
  items?: unknown[]
  total?: { orderAmount?: number; deliveryFee?: number; subTotal?: number }
  payments?: unknown
  delivery?: unknown
}

// ─── Instância HTTP + cache do token ──────────────────────────────────────────

let _client: AxiosInstance | null = null

function getClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: process.env.IFOOD_BASE_URL || 'https://merchant-api.ifood.com.br',
      timeout: 30_000,
    })
  }
  return _client
}

function ifoodError(context: string, err: unknown): AppError {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const data = err.response?.data as { error?: { message?: string }; message?: string } | undefined
    const description = data?.error?.message || data?.message
    logger.error({ context, status, data }, 'ifood request failed')
    return new AppError(description || `Falha ao comunicar com o iFood (${context})`, 422)
  }
  logger.error({ context, err }, 'ifood request failed (non-axios)')
  return new AppError(`Falha ao comunicar com o iFood (${context})`, 422)
}

// Token do integrador (global, não por loja). Cacheado com margem de 5 min.
let _token: { value: string; expiresAt: number } | null = null

/**
 * Obtém (ou reusa) o access token do integrador via client_credentials.
 * Expira ~6h; renovamos chamando de novo. Sem refresh token no Centralizado.
 */
export async function getAppToken(): Promise<string> {
  const now = Date.now()
  if (_token && _token.expiresAt - 5 * 60_000 > now) return _token.value

  const clientId = process.env.IFOOD_CLIENT_ID || ''
  const clientSecret = process.env.IFOOD_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) {
    throw new AppError('Credenciais do iFood não configuradas (IFOOD_CLIENT_ID/SECRET)', 500)
  }

  try {
    const body = new URLSearchParams({
      grantType: 'client_credentials',
      clientId,
      clientSecret,
    })
    const { data } = await getClient().post<{ accessToken: string; expiresIn: number }>(
      '/authentication/v1.0/oauth/token',
      body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    _token = { value: data.accessToken, expiresAt: now + data.expiresIn * 1000 }
    return data.accessToken
  } catch (err) {
    throw ifoodError('getAppToken', err)
  }
}

/** Reseta o cache do token (útil em testes ou após 401). */
export function resetTokenCache(): void {
  _token = null
}

async function authHeaders(): Promise<{ Authorization: string }> {
  return { Authorization: `Bearer ${await getAppToken()}` }
}

// ─── Merchant ─────────────────────────────────────────────────────────────────

/** Lista os merchants que autorizaram o app (via Portal do Parceiro). */
export async function listMerchants(): Promise<IFoodMerchant[]> {
  try {
    const { data } = await getClient().get<IFoodMerchant[]>('/merchant/v1.0/merchants', {
      headers: await authHeaders(),
    })
    return Array.isArray(data) ? data : []
  } catch (err) {
    throw ifoodError('listMerchants', err)
  }
}

export async function getMerchant(merchantId: string): Promise<IFoodMerchant> {
  try {
    const { data } = await getClient().get<IFoodMerchant>(`/merchant/v1.0/merchants/${merchantId}`, {
      headers: await authHeaders(),
    })
    return data
  } catch (err) {
    throw ifoodError('getMerchant', err)
  }
}

// ─── Pedidos — polling + ações ────────────────────────────────────────────────

/** Poll de eventos. Retorna [] quando não há nada (HTTP 204). */
export async function pollEvents(): Promise<IFoodEvent[]> {
  try {
    const res = await getClient().get<IFoodEvent[]>('/order/v1.0/events:polling', {
      headers: await authHeaders(),
      params: { excludeHeartbeat: true },
      validateStatus: (s) => s === 200 || s === 204,
    })
    return res.status === 204 || !Array.isArray(res.data) ? [] : res.data
  } catch (err) {
    throw ifoodError('pollEvents', err)
  }
}

/** ACK dos eventos processados (até 2000 ids/req) — sem ACK o evento volta no próximo poll. */
export async function acknowledgeEvents(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return
  try {
    await getClient().post(
      '/events/v1.0/events/acknowledgment',
      eventIds.map((id) => ({ id })),
      { headers: await authHeaders() }
    )
  } catch (err) {
    throw ifoodError('acknowledgeEvents', err)
  }
}

export async function getOrder(orderId: string): Promise<IFoodOrder> {
  try {
    const { data } = await getClient().get<IFoodOrder>(`/order/v1.0/orders/${orderId}`, {
      headers: await authHeaders(),
    })
    return data
  } catch (err) {
    throw ifoodError('getOrder', err)
  }
}

export async function confirmOrder(orderId: string): Promise<void> {
  try {
    await getClient().post(`/order/v1.0/orders/${orderId}/confirm`, {}, { headers: await authHeaders() })
  } catch (err) {
    throw ifoodError('confirmOrder', err)
  }
}

export async function dispatchOrder(orderId: string): Promise<void> {
  try {
    await getClient().post(`/order/v1.0/orders/${orderId}/dispatch`, {}, { headers: await authHeaders() })
  } catch (err) {
    throw ifoodError('dispatchOrder', err)
  }
}

export async function getCancellationReasons(
  orderId: string
): Promise<{ cancelCodeId: string; description: string }[]> {
  try {
    const { data } = await getClient().get<{ cancelCodeId: string; description: string }[]>(
      `/order/v1.0/orders/${orderId}/cancellationReasons`,
      { headers: await authHeaders() }
    )
    return Array.isArray(data) ? data : []
  } catch (err) {
    throw ifoodError('getCancellationReasons', err)
  }
}

export async function cancelOrder(orderId: string, cancellationCode: string, reason: string): Promise<void> {
  try {
    await getClient().post(
      `/order/v1.0/orders/${orderId}/requestCancellation`,
      { cancellationCode, reason },
      { headers: await authHeaders() }
    )
  } catch (err) {
    throw ifoodError('cancelOrder', err)
  }
}

// ─── Catálogo (leitura, p/ importar iFood → MenuPanda) ────────────────────────

export async function getCatalogs(merchantId: string): Promise<{ catalogId: string; status?: string }[]> {
  try {
    const { data } = await getClient().get<{ catalogId: string; status?: string }[]>(
      `/catalog/v2.0/merchants/${merchantId}/catalogs`,
      { headers: await authHeaders() }
    )
    return Array.isArray(data) ? data : []
  } catch (err) {
    throw ifoodError('getCatalogs', err)
  }
}

/** Categorias (com itens) de um catálogo — base da importação. */
export async function getCatalogCategories(merchantId: string, catalogId: string): Promise<unknown[]> {
  try {
    const { data } = await getClient().get<unknown[]>(
      `/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
      { headers: await authHeaders(), params: { includeItems: true } }
    )
    return Array.isArray(data) ? data : []
  } catch (err) {
    throw ifoodError('getCatalogCategories', err)
  }
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

/**
 * Valida a assinatura do webhook iFood (obrigatório pra homologação).
 *
 * O iFood assina cada evento com HMAC-SHA256 do RAW BODY usando o `clientSecret`
 * do app (o mesmo IFOOD_CLIENT_SECRET dos tokens), codifica em hex e envia no
 * header `X-IFood-Signature`. A validação precisa ser sobre os BYTES CRUS — por
 * isso a rota usa `express.raw`, não o `express.json` global (um JSON reserializado
 * mudaria a ordem das chaves/espaços e a assinatura não bateria).
 *
 * Comparação em tempo constante (timingSafeEqual) com guarda de tamanho — o
 * timingSafeEqual lança se os buffers têm tamanhos diferentes.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined
): boolean {
  const secret = process.env.IFOOD_CLIENT_SECRET || ''
  if (!secret || !signature || !rawBody || rawBody.length === 0) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  // digest('hex') é minúsculo; normaliza o header pra comparar sem case-sensitivity.
  const b = Buffer.from(signature.toLowerCase(), 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
