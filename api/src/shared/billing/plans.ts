// ─── Configuração de planos (fonte única) ─────────────────────────────────────
// Antes triplicado em register.service, owner.service e no webhook. Consolidado aqui.
// StorePlan = 'PROFESSIONAL' | 'PREMIUM' (enum do Prisma).

// Valor do plano em BRL. Default = produção (99/149). Sobrescrevível por env pra
// testes em sandbox (ex: PLAN_VALUE_PROFESSIONAL=1, PLAN_VALUE_PREMIUM=3).
function planValue(envVar: string, fallback: number): number {
  const raw = process.env[envVar]
  const n = raw != null ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Valor do plano em BRL (usado no Asaas e no cálculo de MRR do owner). */
export const PLAN_VALUES: Record<string, number> = {
  PROFESSIONAL: planValue('PLAN_VALUE_PROFESSIONAL', 99),
  PREMIUM: planValue('PLAN_VALUE_PREMIUM', 149),
}

/** Flags de feature por plano — gravadas em `Store.features` (Json). */
export const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  PROFESSIONAL: {
    pixPayment: true,
    whatsappNotifications: true,
    aiAssistant: false,
    deliveryZones: false,
    coupons: false,
    analytics: false,
    ranking: false,
    scheduling: false,
    ifoodIntegration: false,
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
    ifoodIntegration: true,
  },
}

/** Dias de trial gratuito de uma loja nova. */
export const TRIAL_DAYS = 7

/** Retorna a data de fim do trial a partir de agora (trial local — Asaas não tem trial nativo). */
export function trialEndsAtFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
}
