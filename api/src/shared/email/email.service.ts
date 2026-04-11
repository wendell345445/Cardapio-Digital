import { readFileSync } from 'fs'
import path from 'path'

import nodemailer, { type Transporter } from 'nodemailer'

// ─── Transport ────────────────────────────────────────────────────
// Suporta MailHog/Mailpit local (porta 1025, sem auth) e Gmail SMTP em prod (smtp.gmail.com:587 STARTTLS).
// `secure` = true apenas em porta 465 (SMTPS); STARTTLS na 587 mantém `secure: false`.

let _transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (_transporter) return _transporter

  const port = Number(process.env.SMTP_PORT) || 1025
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  return _transporter
}

// ─── Template Engine ──────────────────────────────────────────────
// Cada template é um `.html` em `./templates/`. O cliente edita livremente
// (header/footer ficam em `_layout.html`). Variáveis usam sintaxe `{{nome}}`.

const TEMPLATES_DIR = path.resolve(__dirname, 'templates')

function getRootDomain(): string {
  return process.env.PUBLIC_ROOT_DOMAIN || 'supercardapio.com.br'
}

function getSupportEmail(): string {
  return process.env.SUPPORT_EMAIL || `contato@${getRootDomain()}`
}

function getFromDefault(): string {
  return `Super Cardápio <noreply@${getRootDomain()}>`
}

const templateCache = new Map<string, string>()

function loadTemplate(name: string): string {
  // Em prod ou ambientes onde queremos hot-reload (NODE_ENV=development), pula o cache.
  const useCache = process.env.NODE_ENV === 'production'
  if (useCache && templateCache.has(name)) {
    return templateCache.get(name)!
  }

  const filePath = path.join(TEMPLATES_DIR, `${name}.html`)
  const content = readFileSync(filePath, 'utf8')
  if (useCache) templateCache.set(name, content)
  return content
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  // Strip HTML comments (used for documentation in template files)
  const stripped = template.replace(/<!--[\s\S]*?-->/g, '')
  // Substitui {{var}} pelos valores. Variáveis ausentes viram string vazia.
  return stripped.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    variables[key] !== undefined ? variables[key] : ''
  )
}

/**
 * Renderiza um template de corpo dentro do _layout.html.
 * `variables` é interpolado tanto no body quanto no layout.
 */
function renderEmailHtml(
  templateName: string,
  subject: string,
  variables: Record<string, string>
): string {
  const bodyTemplate = loadTemplate(templateName)
  const body = renderTemplate(bodyTemplate, variables)

  const layout = loadTemplate('_layout')
  return renderTemplate(layout, {
    ...variables,
    subject,
    currentYear: String(new Date().getFullYear()),
    rootDomain: getRootDomain(),
    content: body,
  })
}

interface SendOptions {
  to: string
  subject: string
  template: string
  variables: Record<string, string>
}

async function sendEmail(opts: SendOptions): Promise<void> {
  const html = renderEmailHtml(opts.template, opts.subject, opts.variables)

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL] template=${opts.template} to=${opts.to} subject="${opts.subject}"`)
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || getFromDefault(),
    to: opts.to,
    subject: opts.subject,
    html,
  })
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Email enviado quando o Owner cria uma loja para um cliente (US-001A).
 * Inclui senha temporária gerada pelo backend.
 */
export async function sendWelcomeEmail(params: {
  adminEmail: string
  adminName: string
  storeName: string
  tempPassword: string
  loginUrl: string
}): Promise<void> {
  await sendEmail({
    to: params.adminEmail,
    subject: `Bem-vindo ao Super Cardápio — ${params.storeName}`,
    template: 'welcome-owner-created',
    variables: {
      adminName: params.adminName,
      adminEmail: params.adminEmail,
      storeName: params.storeName,
      tempPassword: params.tempPassword,
      loginUrl: params.loginUrl,
    },
  })
}

/**
 * Email de boas-vindas para auto-cadastro (v2.5+ — US-001B).
 * NÃO inclui senha temporária (cliente definiu a própria).
 */
export async function sendWelcomeSelfRegisterEmail(params: {
  adminEmail: string
  adminName: string
  storeName: string
  storeSlug: string
  trialEndsAt: Date
  loginUrl: string
}): Promise<void> {
  const trialEndsStr = params.trialEndsAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const publicUrl = `https://${params.storeSlug}.${getRootDomain()}`

  await sendEmail({
    to: params.adminEmail,
    subject: `🎉 Bem-vindo ao Super Cardápio — ${params.storeName}`,
    template: 'welcome-self-register',
    variables: {
      adminName: params.adminName,
      adminEmail: params.adminEmail,
      storeName: params.storeName,
      trialEndsStr,
      publicUrl,
      loginUrl: params.loginUrl,
    },
  })
}

/**
 * Email enviado quando o plano da loja é alterado (upgrade/downgrade).
 */
export async function sendPlanChangeEmail(params: {
  adminEmail: string
  adminName: string
  storeName: string
  oldPlan: string
  newPlan: string
}): Promise<void> {
  await sendEmail({
    to: params.adminEmail,
    subject: `Plano alterado — ${params.storeName}`,
    template: 'plan-change',
    variables: {
      adminName: params.adminName,
      storeName: params.storeName,
      oldPlan: params.oldPlan,
      newPlan: params.newPlan,
    },
  })
}

/**
 * Email enviado quando o webhook Stripe `invoice.payment_failed` é recebido.
 * `graceDays` é interpolado no template para refletir `STRIPE_GRACE_PERIOD_DAYS`.
 */
export async function sendPaymentFailedEmail(params: {
  adminEmail: string
  storeName: string
  graceDays: number
}): Promise<void> {
  await sendEmail({
    to: params.adminEmail,
    subject: `Ação necessária: falha no pagamento — ${params.storeName}`,
    template: 'payment-failed',
    variables: {
      storeName: params.storeName,
      graceDays: String(params.graceDays),
      graceDaysPlural: params.graceDays === 1 ? 'dia' : 'dias',
    },
  })
}

/**
 * Email enviado quando uma loja é suspensa pelo cron `trial-suspension.job` —
 * trial natural expirado OU grace period após `invoice.payment_failed` esgotado.
 *
 * O email orienta o admin a cadastrar um cartão para reativar a loja
 * (dados são preservados — nada é excluído).
 */
export async function sendTrialSuspendedEmail(params: {
  adminEmail: string
  adminName: string
  storeName: string
  billingUrl: string
  supportEmail?: string
}): Promise<void> {
  await sendEmail({
    to: params.adminEmail,
    subject: `Sua loja foi suspensa — ${params.storeName}`,
    template: 'trial-suspended',
    variables: {
      adminName: params.adminName,
      storeName: params.storeName,
      billingUrl: params.billingUrl,
      supportEmail: params.supportEmail ?? getSupportEmail(),
    },
  })
}

/**
 * Email enviado quando o webhook Stripe `customer.subscription.trial_will_end` é recebido
 * (~3 dias antes do fim do trial). Aviso proativo pro admin cadastrar método de pagamento.
 */
export async function sendTrialEndingEmail(params: {
  adminEmail: string
  storeName: string
  trialEndsAt: Date
}): Promise<void> {
  const trialEndsStr = params.trialEndsAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  await sendEmail({
    to: params.adminEmail,
    subject: `Seu trial acaba em breve — ${params.storeName}`,
    template: 'trial-ending',
    variables: {
      storeName: params.storeName,
      trialEndsStr,
    },
  })
}

// ─── Test helpers (exported for unit tests) ───────────────────────
export const __test__ = {
  loadTemplate,
  renderTemplate,
  renderEmailHtml,
  clearCache: () => templateCache.clear(),
}
