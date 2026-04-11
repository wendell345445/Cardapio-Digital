import Bull from 'bull'

import { sendTrialSuspendedEmail } from '../shared/email/email.service'
import { stripeLogger } from '../shared/logger/logger'
import { prisma } from '../shared/prisma/prisma'

// ─── Trial Suspension Cron Job ────────────────────────────────────
//
// Varre diariamente lojas em status `TRIAL` cujo `stripeTrialEndsAt` já passou
// (trial natural expirado OU grace period após `invoice.payment_failed` expirado)
// e muda o status para `SUSPENDED`.
//
// A fonte-de-verdade do fim do trial é `stripeTrialEndsAt`:
//   - Preenchido na criação da subscription (trial_end do Stripe)
//   - Sobrescrito no webhook `invoice.payment_failed` para `NOW + STRIPE_GRACE_PERIOD_DAYS`
//
// Esta é a rede de segurança local — em prod, o Stripe também suspende via
// `customer.subscription.deleted` após todas as Smart Retries falharem (~21d).
// Manter ambos garante suspensão determinística mesmo se o webhook não chegar.

const JOB_NAME = 'trial-suspension'
const REPEATABLE_CRON = process.env.TRIAL_SUSPENSION_CRON || '0 3 * * *' // 03:00 diariamente

let trialSuspensionQueue: Bull.Queue | null = null

export function getTrialSuspensionQueue(): Bull.Queue {
  if (trialSuspensionQueue) return trialSuspensionQueue

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  trialSuspensionQueue = new Bull(JOB_NAME, redisUrl)

  trialSuspensionQueue.process(async () => {
    const now = new Date()
    stripeLogger.info({ cron: REPEATABLE_CRON, now }, 'trial-suspension: starting sweep')

    const expired = await prisma.store.findMany({
      where: {
        status: 'TRIAL',
        stripeTrialEndsAt: { lt: now, not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        stripeTrialEndsAt: true,
        stripeCustomerId: true,
        users: {
          where: { role: 'ADMIN' },
          select: { email: true, name: true },
          take: 1,
        },
      },
    })

    if (expired.length === 0) {
      stripeLogger.info('trial-suspension: no expired stores found')
      return { suspended: 0 }
    }

    stripeLogger.info({ count: expired.length }, 'trial-suspension: found expired stores')

    // Email de suspensão — billingUrl deriva do PUBLIC_ROOT_DOMAIN pra mostrar a URL "presentável"
    // (ex: `https://supercardapio.com.br/admin/configuracoes`) em vez do localhost de dev.
    const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'supercardapio.com.br'
    const protocol = rootDomain.endsWith('.test') || rootDomain === 'localhost' ? 'http' : 'https'
    const billingBaseUrl = `${protocol}://${rootDomain}`

    let suspended = 0
    for (const store of expired) {
      try {
        await prisma.$transaction([
          prisma.store.update({
            where: { id: store.id },
            data: { status: 'SUSPENDED' },
          }),
          prisma.auditLog.create({
            data: {
              storeId: store.id,
              userId: null,
              action: 'store.trial.suspended',
              entity: 'Store',
              entityId: store.id,
              data: {
                reason: 'trial-suspension-cron',
                trialEndedAt: store.stripeTrialEndsAt?.toISOString() ?? null,
              },
            },
          }),
        ])
        suspended += 1
        stripeLogger.info(
          { storeId: store.id, storeName: store.name, trialEndedAt: store.stripeTrialEndsAt },
          'trial-suspension: store suspended'
        )

        // Notifica o admin por email — fire-and-forget (não bloqueia o sweep das demais lojas).
        // Enviado APÓS o update do status pra garantir consistência (se o email falhar,
        // a suspensão local já está feita).
        const admin = store.users[0]
        if (admin?.email) {
          await sendTrialSuspendedEmail({
            adminEmail: admin.email,
            adminName: admin.name ?? store.name,
            storeName: store.name,
            billingUrl: `${billingBaseUrl}/admin/configuracoes`,
          }).catch((err) =>
            stripeLogger.error(
              { err, storeId: store.id },
              'trial-suspension: failed to send trial-suspended email'
            )
          )
        }
      } catch (err) {
        stripeLogger.error(
          { err, storeId: store.id },
          'trial-suspension: failed to suspend store'
        )
      }
    }

    stripeLogger.info({ suspended, total: expired.length }, 'trial-suspension: sweep complete')
    return { suspended, total: expired.length }
  })

  trialSuspensionQueue.on('failed', (job, err) => {
    stripeLogger.error({ jobId: job.id, err }, 'trial-suspension: job failed')
  })

  return trialSuspensionQueue
}

/**
 * Registra o job repetível no Bull. Chamar uma vez no bootstrap do servidor.
 * Bull usa o `jobId: 'cron'` fixo para garantir que múltiplos deploys não criem
 * múltiplos schedulers duplicados.
 */
export async function registerTrialSuspensionJob(): Promise<void> {
  if (process.env.DISABLE_CRON_JOBS === 'true') {
    stripeLogger.warn('trial-suspension: cron disabled via DISABLE_CRON_JOBS=true')
    return
  }

  const queue = getTrialSuspensionQueue()

  // Remove jobs repetíveis existentes pra evitar duplicação em restarts/redeploy
  const existing = await queue.getRepeatableJobs()
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key)
  }

  await queue.add(
    {},
    {
      repeat: { cron: REPEATABLE_CRON },
      jobId: 'trial-suspension-cron',
    }
  )

  stripeLogger.info({ cron: REPEATABLE_CRON }, 'trial-suspension: cron registered')
}
