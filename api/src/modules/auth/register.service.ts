import { hash } from 'bcrypt'
import slugify from 'slugify'

import { sendWelcomeSelfRegisterEmail } from '../../shared/email/email.service'
import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import {
  PLAN_PRICE_IDS,
  cancelCustomerSafe,
  createCustomer,
  createSubscription,
} from '../../shared/stripe/stripe.service'
import { isReservedSlug } from '../../shared/utils/reserved-slugs'

import { generateAuthTokensForNewUser } from './auth.service'
import type { RegisterStoreInput } from './register.schema'

const PLAN_FEATURES: Record<'PROFESSIONAL' | 'PREMIUM', Record<string, boolean>> = {
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

/**
 * Gera um slug único a partir do nome da loja.
 * Em caso de colisão OU slug reservado (ver `reserved-slugs.ts`),
 * sufixa `-2`, `-3`… até encontrar disponível.
 */
export async function generateUniqueSlug(base: string): Promise<string> {
  const baseSlug = slugify(base, { lower: true, strict: true, trim: true })
  let candidate = baseSlug
  let suffix = 2

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // RN-001C: pula slugs reservados pelo sistema (api, www, admin, …)
    // antes de ir no banco. Lojas com nomes como "API" teriam slug inicial
    // "api", que colide com o subdomínio do backend → sufixa `-2`.
    if (!isReservedSlug(candidate)) {
      const existing = await prisma.store.findUnique({ where: { slug: candidate } })
      if (!existing) return candidate
    }
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

interface RegisterStoreResult {
  accessToken: string
  refreshToken: string
  store: {
    id: string
    slug: string
    trialEndsAt: Date | null
  }
}

/**
 * v2.5+ — Auto-cadastro de loja via `/cadastro`.
 * Cria Stripe Customer + Subscription + Store + User + BusinessHours + AuditLog, tudo em transação Prisma.
 * O trial de 7 dias é aplicado automaticamente pelo Stripe (configurado no próprio Price), então a
 * subscription entra em `trialing` sem exigir cartão. Em caso de falha após criar o Stripe Customer,
 * faz rollback (cancelCustomerSafe). Email de boas-vindas é fire-and-forget (não bloqueia a resposta).
 */
export async function registerStore(
  input: RegisterStoreInput,
  ip?: string
): Promise<RegisterStoreResult> {
  // 1. Validar email único global (auto-cadastro não pertence a nenhuma loja existente)
  const existingUser = await prisma.user.findFirst({ where: { email: input.email } })
  if (existingUser) {
    throw new AppError('Email já cadastrado', 422)
  }

  // 2. Gerar slug único a partir do nome
  const slug = await generateUniqueSlug(input.storeName)

  // 3. Hash de senha (12 rounds — padrão existente)
  const passwordHash = await hash(input.password, 12)

  // 4. Stripe Customer
  const stripeCustomer = await createCustomer(input.email, input.storeName)

  // 5. Stripe Subscription (trial 7d herdado do Price — rollback do customer em caso de falha).
  //    `trial_end` deve vir preenchido porque o Price tem `recurring.trial_period_days=7`.
  //    Se vier null, é erro de config do Price no Stripe → aborta e faz rollback.
  const plan = input.plan ?? 'PROFESSIONAL'
  let stripeSubscription
  try {
    stripeSubscription = await createSubscription(stripeCustomer.id, PLAN_PRICE_IDS[plan])
    if (!stripeSubscription.trial_end) {
      throw new Error('Stripe Price sem trial_period_days configurado')
    }
  } catch (err) {
    await cancelCustomerSafe(stripeCustomer.id)
    throw err
  }

  // 6. Fim do trial lido direto da subscription (Stripe retorna unix timestamp em segundos)
  const trialEndsAt = new Date(stripeSubscription.trial_end * 1000)

  // 7. Transação Prisma — Store + User + BusinessHours + AuditLog
  let store
  try {
    store = await prisma.$transaction(async (tx) => {
      const newStore = await tx.store.create({
        data: {
          name: input.storeName,
          slug,
          segment: input.segment,
          // Endereco/coords da loja sao configurados depois em Entregas
          // (Places autocomplete + mapa). Cadastro nao pede endereco.
          phone: input.whatsapp,
          plan,
          status: 'TRIAL',
          features: PLAN_FEATURES[plan],
          stripeCustomerId: stripeCustomer.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripeTrialEndsAt: trialEndsAt,
        },
      })

      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.storeName,
          role: 'ADMIN',
          storeId: newStore.id,
          passwordHash,
          isActive: true,
        },
      })

      // BusinessHours padrão: Seg-Dom 18h-23h
      await tx.businessHour.createMany({
        data: Array.from({ length: 7 }, (_, i) => ({
          storeId: newStore.id,
          dayOfWeek: i,
          openTime: '18:00',
          closeTime: '23:00',
          isClosed: false,
        })),
      })

      await tx.auditLog.create({
        data: {
          storeId: newStore.id,
          userId: user.id,
          action: 'store.self-register',
          entity: 'Store',
          entityId: newStore.id,
          data: { name: input.storeName, slug, segment: input.segment },
          ip,
        },
      })

      return { store: newStore, user }
    })
  } catch (err) {
    // Rollback do Stripe Customer (idempotente)
    await cancelCustomerSafe(stripeCustomer.id)
    throw err
  }

  // 8. Email de boas-vindas — fire-and-forget (não bloqueia resposta).
  //    loginUrl é derivada do PUBLIC_ROOT_DOMAIN (mesma fonte-de-verdade do publicUrl no email)
  //    pra que dev mostre `http://cardapio.test/login` em vez de `http://localhost:5173/login`.
  //    NÃO usar WEB_URL aqui — esse env é pra URLs realmente alcançáveis por browser (Stripe returnUrl etc).
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.com.br'
  const protocol = rootDomain.endsWith('.test') || rootDomain === 'localhost' ? 'http' : 'https'
  const loginUrl = `${protocol}://${rootDomain}/login`
  void sendWelcomeSelfRegisterEmail({
    adminEmail: input.email,
    adminName: input.storeName,
    storeName: input.storeName,
    storeSlug: slug,
    trialEndsAt,
    loginUrl,
  }).catch((err) => {
    console.error('[EMAIL] Failed to send self-register welcome email:', {
      storeId: store.store.id,
      err,
    })
  })

  // 9. Emite tokens JWT para login automático
  const tokens = await generateAuthTokensForNewUser({
    userId: store.user.id,
    role: store.user.role,
    storeId: store.user.storeId ?? undefined,
  })

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    store: {
      id: store.store.id,
      slug: store.store.slug,
      trialEndsAt: store.store.stripeTrialEndsAt,
    },
  }
}
