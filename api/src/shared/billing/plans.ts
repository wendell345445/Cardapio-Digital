// ─── Configuração de planos (fonte única) ─────────────────────────────────────
// Antes triplicado em register.service, owner.service e no webhook. Consolidado aqui.
// StorePlan = 'PROFESSIONAL' | 'PREMIUM' (enum do Prisma).

/** Valor mensal do plano em BRL (usado no Asaas e no cálculo de MRR do owner). */
export const PLAN_VALUES: Record<string, number> = {
  PROFESSIONAL: 99,
  PREMIUM: 149,
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

/** Dias de trial gratuito de uma loja nova. */
export const TRIAL_DAYS = 7

/** Retorna a data de fim do trial a partir de agora (trial local — Asaas não tem trial nativo). */
export function trialEndsAtFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
}
