import { sign, verify } from 'jsonwebtoken'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { validateCredentials } from '../auth/auth.service'
import { buildReceiptData, type ReceiptData } from '../admin/print.service'

// Token JWT do printer tem escopo limitado ('print') — middleware só aceita esse
// scope nas rotas /api/print/*. Mesmo que o token vaze, atacante não consegue
// acessar /admin/* nem outras rotas autenticadas.
const PRINTER_TOKEN_EXPIRY = '365d'

export interface PrinterTokenPayload {
  userId: string
  storeId: string
  scope: 'print'
}

export interface PrintLoginResult {
  token: string
  restaurant: { id: string; name: string }
}

export async function printerLogin(email: string, password: string): Promise<PrintLoginResult> {
  const user = await validateCredentials(email, password)

  if (user.role === 'MOTOBOY') {
    throw new AppError('Conta de entregador não pode conectar impressora', 403, 'WRONG_SCOPE')
  }
  if (!user.storeId) {
    throw new AppError('Usuário sem loja associada', 403)
  }

  const store = await prisma.store.findUnique({
    where: { id: user.storeId },
    select: { id: true, name: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)

  const payload: PrinterTokenPayload = {
    userId: user.id,
    storeId: store.id,
    scope: 'print',
  }
  const token = sign(payload, process.env.JWT_SECRET!, { expiresIn: PRINTER_TOKEN_EXPIRY })

  return { token, restaurant: { id: store.id, name: store.name } }
}

export function verifyPrinterToken(token: string): PrinterTokenPayload {
  let payload: PrinterTokenPayload
  try {
    payload = verify(token, process.env.JWT_SECRET!) as PrinterTokenPayload
  } catch {
    throw new AppError('Token inválido ou expirado', 401)
  }
  if (payload.scope !== 'print') {
    throw new AppError('Token não tem escopo de impressora', 403)
  }
  return payload
}

export async function getPrinterMe(storeId: string): Promise<PrintLoginResult['restaurant']> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)
  return { id: store.id, name: store.name }
}

export interface PendingPrintJob {
  id: string
  orderId: string
  orderNumber: number
  // Dados estruturados do pedido — o Menuziprinter monta o layout do cupom
  // (largura/fonte/quebra de linha) a partir daqui. Substitui o `receipt`
  // string pré-formatado pela API.
  data: ReceiptData
}

export async function listPendingPrintJobs(storeId: string): Promise<PendingPrintJob[]> {
  const jobs = await prisma.printJob.findMany({
    where: { storeId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      order: {
        include: { items: { include: { additionals: true } } },
      },
    },
  })

  return jobs.map((job) => ({
    id: job.id,
    orderId: job.orderId,
    orderNumber: job.order.number,
    data: buildReceiptData({
      number: job.order.number,
      createdAt: job.order.createdAt,
      clientName: job.order.clientName,
      clientWhatsapp: job.order.clientWhatsapp,
      type: job.order.type,
      paymentMethod: job.order.paymentMethod,
      subtotal: job.order.subtotal,
      deliveryFee: job.order.deliveryFee,
      discount: job.order.discount,
      total: job.order.total,
      notes: job.order.notes,
      address: job.order.address as Record<string, string> | null,
      items: job.order.items.map((i) => ({
        productName: i.productName,
        variationName: i.variationName,
        quantity: i.quantity,
        totalPrice: i.totalPrice,
        notes: i.notes,
        additionals: i.additionals,
      })),
    }),
  }))
}

export async function markPrintJobPrinted(storeId: string, orderId: string): Promise<void> {
  const job = await prisma.printJob.findUnique({ where: { orderId } })
  if (!job || job.storeId !== storeId) {
    throw new AppError('PrintJob não encontrado', 404)
  }
  // Idempotente: se já está PRINTED, no-op (Menuziprinter pode reenviar mark
  // depois de race condition entre poll/imprime).
  if (job.status === 'PRINTED') return

  await prisma.printJob.update({
    where: { orderId },
    data: { status: 'PRINTED', printedAt: new Date() },
  })
}

/**
 * Remove PrintJobs PRINTED com mais de N dias. Chamado pelo cron diário
 * — não há valor em reter histórico de impressão pra sempre.
 */
export async function cleanupOldPrintJobs(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await prisma.printJob.deleteMany({
    where: { status: 'PRINTED', printedAt: { lt: cutoff } },
  })
  return result.count
}
