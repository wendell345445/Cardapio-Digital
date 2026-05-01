import { randomBytes } from 'node:crypto'

import QRCode from 'qrcode'
import PDFDocument from 'pdfkit'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'
import { isTablePaymentMethod } from '../../shared/utils/payment'

// Hash não-adivinhável que vai no QR (URL: /mesa/<accessToken>). 16 bytes hex
// = 128 bits de entropia, suficiente pra inviabilizar adivinhação.
function generateAccessToken(): string {
  return randomBytes(8).toString('hex') // 16 chars hex
}

import { linkOrderToCashFlow } from './cashflow.service'
import type {
  CloseTableInput,
  ConfirmTablePaymentInput,
  CreateTableInput,
  SettleTableInput,
  UpdateItemStatusInput,
} from './tables.schema'

// ─── TASK-044: QR Code de Mesa e Comanda ─────────────────────────────────────

export async function listTables(storeId: string) {
  const tables = await prisma.table.findMany({
    where: { storeId },
    orderBy: { number: 'asc' },
    include: {
      sessions: {
        where: { status: 'OPEN' },
        include: {
          orders: {
            where: { status: { not: 'CANCELLED' } },
            include: { items: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        take: 1,
      },
      orders: {
        where: { status: { not: 'CANCELLED' } },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  // Adiciona isPaid em cada sessão OPEN: true se TODOS os pedidos não-cancelados
  // têm paymentReceivedAt. UI usa isso pra liberar/bloquear botão "Fechar sessão".
  return tables.map((t) => ({
    ...t,
    sessions: (t.sessions ?? []).map((s) => ({
      ...s,
      isPaid:
        (s.orders ?? []).length > 0 &&
        (s.orders ?? []).every((o) => o.paymentReceivedAt !== null),
    })),
  }))
}

export async function createTable(
  storeId: string,
  data: CreateTableInput,
  userId: string,
  ip?: string
) {
  const existing = await prisma.table.findUnique({
    where: { storeId_number: { storeId, number: data.number } },
  })
  if (existing) {
    throw new AppError(`Mesa número ${data.number} já existe nesta loja`, 422)
  }

  const table = await prisma.table.create({
    data: { storeId, number: data.number, accessToken: generateAccessToken() },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'table.create',
      entity: 'Table',
      entityId: table.id,
      data: { number: data.number },
      ip,
    },
  })

  return table
}

async function getTableAndSlug(storeId: string, tableId: string) {
  const table = await prisma.table.findUnique({ where: { id: tableId } })
  if (!table || table.storeId !== storeId) {
    throw new AppError('Mesa não encontrada', 404)
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { slug: true } })
  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  return { table, slug: store.slug }
}

function buildMenuUrl(slug: string, accessToken: string): string {
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.com.br'
  // v2.7: URL agora usa accessToken (hash) em vez do número da mesa — sem
  // hash, qualquer cliente conseguia digitar /mesa/2 e abrir sessão da mesa
  // do vizinho. Hash é fixo por mesa, então bookmark do cliente continua
  // funcionando entre sessões.
  return `https://${slug}.${rootDomain}/mesa/${accessToken}`
}

export async function generateQRCode(storeId: string, tableId: string) {
  const { table, slug } = await getTableAndSlug(storeId, tableId)
  const url = buildMenuUrl(slug, table.accessToken)
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 2, width: 300 })
  return { qrDataUrl, url, tableNumber: table.number }
}

export async function generateQRCodePDF(storeId: string, tableId: string): Promise<Buffer> {
  const { table, slug } = await getTableAndSlug(storeId, tableId)
  const url = buildMenuUrl(slug, table.accessToken)

  const qrBuffer = await QRCode.toBuffer(url, { margin: 2, width: 400 })

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Title
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text(`Mesa N°${table.number}`, { align: 'center' })

    doc.moveDown(1.5)

    // QR Code image centered
    const pageWidth = doc.page.width - 120 // minus margins
    const imgSize = Math.min(pageWidth, 300)
    const xCenter = (doc.page.width - imgSize) / 2
    doc.image(qrBuffer, xCenter, doc.y, { width: imgSize })

    doc.moveDown(1)
    doc.y += imgSize - 20 // move below the image

    // URL below QR
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text(url, { align: 'center', link: url })

    doc.end()
  })
}

export async function closeTable(
  storeId: string,
  tableId: string,
  data: CloseTableInput,
  userId: string,
  ip?: string
) {
  const table = await prisma.table.findUnique({ where: { id: tableId } })
  if (!table || table.storeId !== storeId) {
    throw new AppError('Mesa não encontrada', 404)
  }

  const session = await prisma.tableSession.findFirst({
    where: { tableId, storeId, status: 'OPEN' },
    include: {
      orders: {
        where: { status: { notIn: ['CANCELLED', 'DELIVERED'] } },
        include: { items: { include: { additionals: true } } },
      },
    },
  })

  if (!session) {
    throw new AppError('Mesa não tem sessão aberta', 422)
  }

  // Sessão precisa estar paga antes de fechar — pagamento é registrado via
  // POST /admin/tables/:id/payment, que preenche paymentReceivedAt em cada
  // order da sessão. Sem isso, pedidos sumiriam do CashFlow ao virarem DELIVERED.
  const unpaidOrders = session.orders.filter((o) => !o.paymentReceivedAt)
  if (unpaidOrders.length > 0) {
    throw new AppError(
      'Receba o pagamento da sessão antes de fechar a mesa',
      422
    )
  }

  const subtotal = session.orders.reduce(
    (acc, order) => acc + order.items.reduce((s, i) => s + i.totalPrice, 0),
    0
  )
  const serviceCharge =
    data.applyServiceCharge && data.serviceChargePercent
      ? (subtotal * data.serviceChargePercent) / 100
      : 0
  const total = subtotal + serviceCharge
  const orderIds = session.orders.map((o) => o.id)

  await prisma.$transaction([
    prisma.tableSession.update({
      where: { id: session.id },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: userId },
    }),
    prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: 'DELIVERED' },
    }),
    prisma.table.update({
      where: { id: tableId },
      data: { isOccupied: false },
    }),
  ])

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'table.close',
      entity: 'TableSession',
      entityId: session.id,
      data: {
        tableNumber: table.number,
        sessionId: session.id,
        ordersClosed: orderIds.length,
        subtotal,
        serviceCharge,
        total,
        applyServiceCharge: data.applyServiceCharge,
        serviceChargePercent: data.serviceChargePercent,
      },
      ip,
    },
  })

  return {
    tableNumber: table.number,
    sessionId: session.id,
    ordersClosed: orderIds.length,
    subtotal,
    serviceCharge,
    total,
  }
}

export async function getTableComanda(storeId: string, tableId: string) {
  const table = await prisma.table.findUnique({ where: { id: tableId } })
  if (!table || table.storeId !== storeId) {
    throw new AppError('Mesa não encontrada', 404)
  }

  const session = await prisma.tableSession.findFirst({
    where: { tableId, storeId, status: 'OPEN' },
    include: {
      orders: {
        where: { status: { not: 'CANCELLED' } },
        include: { items: { include: { additionals: true }, orderBy: { id: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!session) {
    return { table, session: null, orders: [], items: [], subtotal: 0, total: 0 }
  }

  const items = session.orders.flatMap((o) =>
    o.items.map((i) => ({ ...i, deviceName: o.deviceName, orderId: o.id }))
  )
  const subtotal = items.reduce((acc, item) => acc + item.totalPrice, 0)
  const isPaid =
    session.orders.length > 0 &&
    session.orders.every((o) => o.paymentReceivedAt !== null)
  // Quando paga, todos os orders compartilham o mesmo paymentMethod (sessão paga junto).
  const paymentMethod = isPaid ? session.orders[0]?.paymentMethod ?? null : null

  return {
    table,
    session: {
      id: session.id,
      openedAt: session.openedAt,
      isPaid,
      paymentMethod,
      checkRequestedAt: session.checkRequestedAt,
    },
    orders: session.orders.map((o) => ({
      id: o.id,
      number: o.number,
      deviceName: o.deviceName,
      createdAt: o.createdAt,
      paymentReceivedAt: o.paymentReceivedAt,
      paymentMethod: o.paymentMethod,
    })),
    items,
    subtotal,
    total: subtotal,
  }
}

export async function updateOrderItemStatus(
  storeId: string,
  tableId: string,
  itemId: string,
  data: UpdateItemStatusInput,
  _userId: string
) {
  // Validate item belongs to an order of this table and store
  const item = await prisma.orderItem.findFirst({
    where: {
      id: itemId,
      order: {
        tableId,
        storeId,
        status: { not: 'CANCELLED' },
      },
    },
  })

  if (!item) {
    throw new AppError('Item não encontrado nesta mesa', 404)
  }

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { status: data.status },
  })

  // Mover item pra PREPARING/DELIVERED é confirmação implícita do garçom —
  // sobe o Order de WAITING_CONFIRMATION/PROOF pra CONFIRMED. Sem isso, o card
  // da mesa fica preso em "Pedido novo" mesmo com itens já em preparo.
  if (data.status !== 'PENDING') {
    const order = await prisma.order.findUnique({
      where: { id: item.orderId },
      select: { status: true },
    })
    if (order && (order.status === 'WAITING_CONFIRMATION' || order.status === 'WAITING_PAYMENT_PROOF')) {
      await prisma.order.update({
        where: { id: item.orderId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      })
      emit.orderStatus(storeId, { orderId: item.orderId, status: 'CONFIRMED' })
    }
  }

  emit.itemStatus(storeId, tableId, { itemId, status: data.status })

  return updated
}

// ─── Reconciliação de quantidade de mesas ───────────────────────────────────

export async function setTablesCount(
  storeId: string,
  targetCount: number,
  userId: string,
  ip?: string
) {
  const existing = await prisma.table.findMany({
    where: { storeId },
    orderBy: { number: 'asc' },
  })
  const existingNumbers = new Set(existing.map((t) => t.number))

  const toCreate: Array<{ storeId: string; number: number; accessToken: string }> = []
  for (let n = 1; n <= targetCount; n++) {
    if (!existingNumbers.has(n)) {
      toCreate.push({ storeId, number: n, accessToken: generateAccessToken() })
    }
  }

  // Só remove mesas com number > targetCount E sem sessão OPEN
  const candidatesToRemove = existing.filter((t) => t.number > targetCount)
  for (const t of candidatesToRemove) {
    const openSession = await prisma.tableSession.findFirst({
      where: { tableId: t.id, status: 'OPEN' },
    })
    if (openSession) {
      throw new AppError(
        `Mesa ${t.number} tem sessão aberta — feche antes de reduzir o total`,
        422
      )
    }
  }

  const removeIds = candidatesToRemove.map((t) => t.id)

  await prisma.$transaction(async (tx) => {
    if (toCreate.length) {
      await tx.table.createMany({ data: toCreate })
    }
    if (removeIds.length) {
      await tx.table.deleteMany({ where: { id: { in: removeIds } } })
    }
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'tables.set_count',
      entity: 'Store',
      entityId: storeId,
      data: {
        targetCount,
        created: toCreate.length,
        removed: removeIds.length,
      },
      ip,
    },
  })

  return listTables(storeId)
}

// ─── PDF com todos os QR Codes ──────────────────────────────────────────────

export async function generateAllQRCodesPDF(storeId: string): Promise<Buffer> {
  const tables = await prisma.table.findMany({
    where: { storeId },
    orderBy: { number: 'asc' },
  })
  if (tables.length === 0) {
    throw new AppError('Nenhuma mesa cadastrada', 422)
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { slug: true },
  })
  if (!store) {
    throw new AppError('Loja não encontrada', 404)
  }

  // Gera todos os QR buffers em paralelo antes do PDFDocument pra não misturar
  // await com o callback síncrono dos eventos do pdfkit.
  const qrEntries = await Promise.all(
    tables.map(async (t) => {
      const url = buildMenuUrl(store.slug, t.accessToken)
      const qr = await QRCode.toBuffer(url, { margin: 2, width: 400 })
      return { number: t.number, url, qr }
    })
  )

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    qrEntries.forEach((entry, i) => {
      if (i > 0) doc.addPage()
      doc.fontSize(28).font('Helvetica-Bold').text(`Mesa N°${entry.number}`, { align: 'center' })
      doc.moveDown(1.5)
      const imgSize = Math.min(doc.page.width - 120, 300)
      const xCenter = (doc.page.width - imgSize) / 2
      doc.image(entry.qr, xCenter, doc.y, { width: imgSize })
      doc.moveDown(1)
      doc.y += imgSize - 20
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#555555')
        .text(entry.url, { align: 'center', link: entry.url })
      doc.fillColor('#000000') // reset cor pra próxima página
    })

    doc.end()
  })
}

// ─── Histórico de sessões fechadas ──────────────────────────────────────────

export async function listClosedSessions(
  storeId: string,
  options: { from?: Date; to?: Date; limit?: number } = {}
) {
  const { from, to, limit = 50 } = options

  const sessions = await prisma.tableSession.findMany({
    where: {
      storeId,
      status: 'CLOSED',
      ...(from || to
        ? {
            closedAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    },
    include: {
      table: { select: { number: true } },
      orders: {
        where: { status: { not: 'CANCELLED' } },
        select: {
          id: true,
          deviceName: true,
          paymentMethod: true,
          items: { select: { totalPrice: true } },
        },
      },
    },
    orderBy: { closedAt: 'desc' },
    take: limit,
  })

  return sessions.map((s) => {
    const subtotal = s.orders.reduce(
      (acc, o) => acc + o.items.reduce((sum, i) => sum + i.totalPrice, 0),
      0
    )
    // Sessão paga junto: todos os orders compartilham o mesmo paymentMethod.
    const paymentMethod = s.orders[0]?.paymentMethod ?? null
    const deviceNames = Array.from(
      new Set(s.orders.map((o) => o.deviceName).filter((n): n is string => !!n))
    )
    return {
      id: s.id,
      tableNumber: s.table.number,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      ordersCount: s.orders.length,
      subtotal,
      paymentMethod,
      deviceNames,
    }
  })
}

// ─── Recebimento de pagamento da sessão ─────────────────────────────────────

export async function confirmTableSessionPayment(
  storeId: string,
  tableId: string,
  data: ConfirmTablePaymentInput,
  userId: string,
  ip?: string
) {
  if (!isTablePaymentMethod(data.paymentMethod)) {
    throw new AppError('Método de pagamento inválido para mesa', 422)
  }

  const session = await prisma.tableSession.findFirst({
    where: { tableId, storeId, status: 'OPEN' },
    include: {
      orders: {
        where: { status: { not: 'CANCELLED' } },
      },
    },
  })
  if (!session) {
    throw new AppError('Mesa não tem sessão aberta', 422)
  }

  const unpaidOrderIds = session.orders
    .filter((o) => o.paymentReceivedAt === null)
    .map((o) => o.id)

  if (unpaidOrderIds.length === 0) {
    // Idempotente: já está paga
    return {
      sessionId: session.id,
      ordersPaid: 0,
      paymentMethod: data.paymentMethod,
      alreadyPaid: true,
    }
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id: { in: unpaidOrderIds } },
      data: {
        paymentMethod: data.paymentMethod,
        paymentReceivedAt: now,
        paymentReceivedById: userId,
      },
    })

    // Pedidos em WAITING_* sobem pra CONFIRMED — espelha o auto-confirm que
    // OrdersPage faz pro PIX. Sem isso, pedido fica preso aguardando confirmação
    // mesmo já pago, e CashFlow não registra (linkOrderToCashFlow só liga em CONFIRMED+).
    await tx.order.updateMany({
      where: {
        id: { in: unpaidOrderIds },
        status: { in: ['WAITING_CONFIRMATION', 'WAITING_PAYMENT_PROOF'] },
      },
      data: { status: 'CONFIRMED', confirmedAt: now },
    })

    // Limpa o flag "Conta pedida" — pagamento recebido encerra o atendimento.
    if (session.checkRequestedAt) {
      await tx.tableSession.update({
        where: { id: session.id },
        data: { checkRequestedAt: null },
      })
    }
  })

  // CashFlow: link cada pedido pago. linkOrderToCashFlow é tolerante a caixa
  // ausente (no-op se não há OPEN), então loop aqui está ok.
  for (const orderId of unpaidOrderIds) {
    await linkOrderToCashFlow(storeId, orderId)
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'table.payment_received',
      entity: 'TableSession',
      entityId: session.id,
      data: {
        tableId,
        paymentMethod: data.paymentMethod,
        ordersPaid: unpaidOrderIds.length,
      },
      ip,
    },
  })

  return {
    sessionId: session.id,
    ordersPaid: unpaidOrderIds.length,
    paymentMethod: data.paymentMethod,
    paymentReceivedAt: now,
    alreadyPaid: false,
  }
}

// ─── Pagamento + fechamento numa só ação ────────────────────────────────────
// O fluxo correto pro garçom: define taxa de serviço, escolhe método, cobra o
// total certo do cliente. Endpoints `/payment` e `/close` continuam pra usos
// separados (ex: marcar pagamento sem encerrar, ou fechar mesa sem pedido).

export async function settleTable(
  storeId: string,
  tableId: string,
  data: SettleTableInput,
  userId: string,
  ip?: string
) {
  if (!isTablePaymentMethod(data.paymentMethod)) {
    throw new AppError('Método de pagamento inválido para mesa', 422)
  }

  const table = await prisma.table.findUnique({ where: { id: tableId } })
  if (!table || table.storeId !== storeId) {
    throw new AppError('Mesa não encontrada', 404)
  }

  const session = await prisma.tableSession.findFirst({
    where: { tableId, storeId, status: 'OPEN' },
    include: {
      orders: {
        where: { status: { not: 'CANCELLED' } },
        include: { items: { include: { additionals: true } } },
      },
    },
  })
  if (!session) {
    throw new AppError('Mesa não tem sessão aberta', 422)
  }

  const subtotal = session.orders.reduce(
    (acc, order) => acc + order.items.reduce((s, i) => s + i.totalPrice, 0),
    0
  )
  const serviceCharge =
    data.applyServiceCharge && data.serviceChargePercent
      ? (subtotal * data.serviceChargePercent) / 100
      : 0
  const total = subtotal + serviceCharge
  const orderIds = session.orders.map((o) => o.id)
  const unpaidOrderIds = session.orders
    .filter((o) => o.paymentReceivedAt === null)
    .map((o) => o.id)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    // 1. Marca pagamento nos orders ainda não pagos
    if (unpaidOrderIds.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: unpaidOrderIds } },
        data: {
          paymentMethod: data.paymentMethod,
          paymentReceivedAt: now,
          paymentReceivedById: userId,
        },
      })
      // WAITING_* → CONFIRMED (espelha auto-confirm que OrdersPage faz pro PIX).
      await tx.order.updateMany({
        where: {
          id: { in: unpaidOrderIds },
          status: { in: ['WAITING_CONFIRMATION', 'WAITING_PAYMENT_PROOF'] },
        },
        data: { status: 'CONFIRMED', confirmedAt: now },
      })
    }

    // 2. Fecha sessão e marca todos os orders como DELIVERED
    await tx.tableSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedAt: now,
        closedBy: userId,
        checkRequestedAt: null,
      },
    })
    await tx.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: 'DELIVERED' },
    })
    await tx.table.update({
      where: { id: tableId },
      data: { isOccupied: false },
    })
  })

  // CashFlow: registra cada pedido pago no caixa aberto (no-op se não há).
  for (const orderId of unpaidOrderIds) {
    await linkOrderToCashFlow(storeId, orderId)
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'table.settle',
      entity: 'TableSession',
      entityId: session.id,
      data: {
        tableNumber: table.number,
        sessionId: session.id,
        ordersClosed: orderIds.length,
        ordersPaid: unpaidOrderIds.length,
        paymentMethod: data.paymentMethod,
        subtotal,
        serviceCharge,
        total,
        applyServiceCharge: data.applyServiceCharge,
        serviceChargePercent: data.serviceChargePercent,
      },
      ip,
    },
  })

  return {
    tableNumber: table.number,
    sessionId: session.id,
    ordersClosed: orderIds.length,
    ordersPaid: unpaidOrderIds.length,
    paymentMethod: data.paymentMethod,
    subtotal,
    serviceCharge,
    total,
  }
}
