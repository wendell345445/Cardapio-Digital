import { sign, verify } from 'jsonwebtoken'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'
import { enqueueWhatsApp, WhatsAppJobResult } from '../whatsapp/whatsapp.queue'

// ─── Constantes ─────────────────────────────────────────────────────────────

const OTP_TTL = 300 // 5 min
const OTP_RATE_LIMIT_TTL = 60 // 1 min entre envios
const OTP_MAX_ATTEMPTS = 5
const COOKIE_NAME = 'mp_customer_verified'
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000 // 90 dias em ms

export { COOKIE_NAME, COOKIE_MAX_AGE }

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface OtpRecord {
  code: string
  attempts: number
}

interface CustomerTokenPayload {
  storeId: string
  whatsapp: string
  type: 'customer_verify'
}

export interface CheckResult {
  exists: boolean
  name: string | null
  address: {
    zipCode?: string
    street?: string
    number?: string
    complement?: string | null
    neighborhood?: string
    city?: string
  } | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function otpKey(storeId: string, whatsapp: string): string {
  return `otp:customer:${storeId}:${whatsapp}`
}

function rateKey(storeId: string, whatsapp: string): string {
  return `otp:rate:${storeId}:${whatsapp}`
}

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function jwtSecret(): string {
  return process.env.JWT_SECRET!
}

// ─── Check Customer ─────────────────────────────────────────────────────────

export async function checkCustomer(storeId: string, whatsapp: string): Promise<CheckResult> {
  const customer = await prisma.customer.findUnique({
    where: { storeId_whatsapp: { storeId, whatsapp } },
    include: {
      addresses: { where: { isPrimary: true }, take: 1 },
    },
  })

  if (customer) {
    const addr = customer.addresses[0] ?? null
    return {
      exists: true,
      name: customer.name,
      address: addr
        ? {
            zipCode: addr.zipCode,
            street: addr.street,
            number: addr.number,
            complement: addr.complement,
            neighborhood: addr.neighborhood,
            city: addr.city,
          }
        : null,
    }
  }

  // Fallback: cliente sem Customer mas com pedido anterior nesta loja
  const lastOrder = await prisma.order.findFirst({
    where: { storeId, clientWhatsapp: whatsapp, status: { notIn: ['CANCELLED'] } },
    orderBy: { createdAt: 'desc' },
    select: { clientName: true, address: true },
  })

  if (lastOrder) {
    const addr = lastOrder.address as Record<string, string> | null
    return {
      exists: true,
      name: lastOrder.clientName,
      address: addr
        ? {
            zipCode: addr.zipCode ?? addr.cep,
            street: addr.street,
            number: addr.number,
            complement: addr.complement ?? null,
            neighborhood: addr.neighborhood,
            city: addr.city,
          }
        : null,
    }
  }

  return { exists: false, name: null, address: null }
}

// ─── OTP Request ────────────────────────────────────────────────────────────

const OTP_JOB_WAIT_MS = 15_000

export async function requestOtp(storeId: string, whatsapp: string): Promise<void> {
  // Rate limit
  const rateLimited = await cache.get<boolean>(rateKey(storeId, whatsapp))
  if (rateLimited) {
    throw new AppError('Aguarde 1 minuto para solicitar novo código', 429)
  }

  const code = generateCode()
  await cache.set(otpKey(storeId, whatsapp), { code, attempts: 0 } satisfies OtpRecord, OTP_TTL)
  await cache.set(rateKey(storeId, whatsapp), true, OTP_RATE_LIMIT_TTL)

  const job = await enqueueWhatsApp({
    storeId,
    to: whatsapp,
    text: `Seu código de verificação: ${code}`,
    type: 'OTP',
  })

  // Aguarda o worker finalizar em até 15s. Se estourar, o OTP ainda pode ser
  // entregue depois pelo retry da fila, mas respondemos erro ao cliente pra ele
  // saber que precisa tentar de novo (novo código será gerado).
  let result: WhatsAppJobResult | null = null
  try {
    result = (await Promise.race([
      job.finished(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('otp_wait_timeout')), OTP_JOB_WAIT_MS)),
    ])) as WhatsAppJobResult
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'otp_wait_timeout') {
      // Remove o job pra evitar envio tardio quando o usuário já desistiu.
      await job.remove().catch(() => { /* ignore */ })
      // Invalida o OTP gerado — cliente vai pedir um novo.
      await cache.del(otpKey(storeId, whatsapp)).catch(() => { /* ignore */ })
      throw new AppError(
        'Não foi possível enviar o código agora. Verifique se a loja está conectada ao WhatsApp e tente novamente.',
        422,
        'WHATSAPP_UNAVAILABLE'
      )
    }
    // Bull rejeita o `job.finished()` quando esgota as tentativas — cai aqui.
    await cache.del(otpKey(storeId, whatsapp)).catch(() => { /* ignore */ })
    throw new AppError(
      'Não foi possível enviar o código. Tente novamente em instantes.',
      422,
      'WHATSAPP_UNAVAILABLE'
    )
  }

  if (!result.ok) {
    // not_configured / invalid_number / expired → descartados pelo processor sem throw.
    // Limpa o OTP e avisa o cliente.
    await cache.del(otpKey(storeId, whatsapp)).catch(() => { /* ignore */ })
    const isInvalidNumber = result.reason === 'invalid_number'
    throw new AppError(
      isInvalidNumber
        ? 'Este número não possui WhatsApp ativo.'
        : 'A loja não está conectada ao WhatsApp no momento. Tente novamente em alguns segundos.',
      422,
      isInvalidNumber ? 'WHATSAPP_INVALID_NUMBER' : 'WHATSAPP_UNAVAILABLE'
    )
  }
}

// ─── OTP Verify ─────────────────────────────────────────────────────────────

export async function verifyOtp(
  storeId: string,
  whatsapp: string,
  code: string
): Promise<string> {
  const record = await cache.get<OtpRecord>(otpKey(storeId, whatsapp))

  if (!record) {
    throw new AppError('Código expirado. Solicite um novo.', 400)
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await cache.del(otpKey(storeId, whatsapp))
    throw new AppError('Muitas tentativas. Solicite um novo código.', 429)
  }

  if (record.code !== code) {
    record.attempts += 1
    await cache.set(otpKey(storeId, whatsapp), record, OTP_TTL)
    throw new AppError('Código incorreto', 400)
  }

  // Código correto — limpa e gera token
  await cache.del(otpKey(storeId, whatsapp))
  return signCustomerToken(storeId, whatsapp)
}

// ─── Token ──────────────────────────────────────────────────────────────────

export function signCustomerToken(storeId: string, whatsapp: string): string {
  const payload: CustomerTokenPayload = { storeId, whatsapp, type: 'customer_verify' }
  return sign(payload, jwtSecret(), { expiresIn: '90d' })
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const decoded = verify(token, jwtSecret()) as CustomerTokenPayload
    if (decoded.type !== 'customer_verify') return null
    return decoded
  } catch {
    return null
  }
}

// ─── Cookie helper ──────────────────────────────────────────────────────────

export function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined
  const match = cookieHeader.split('; ').find(c => c.startsWith(name + '='))
  return match?.slice(name.length + 1)
}
