import QRCode from 'qrcode'
import PDFDocument from 'pdfkit'

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { emit } from '../../shared/socket/socket'

import type { CloseTableInput, CreateTableInput, UpdateItemStatusInput } from './tables.schema'

// ─── TASK-044: QR Code de Mesa e Comanda ─────────────────────────────────────

export async function listTables(storeId: string) {
  return prisma.table.findMany({
    where: { storeId },
    orderBy: { number: 'asc' },
    include: {
      orders: {
        where: {
          status: { not: 'CANCELLED' },
        },
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
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
    data: { storeId, number: data.number },
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

function buildMenuUrl(slug: string, tableNumber: number): string {
  const rootDomain = process.env.PUBLIC_ROOT_DOMAIN || 'menupanda.com.br'
  return `https://${slug}.${rootDomain}?mesa=${tableNumber}`
}

export async function generateQRCode(storeId: string, tableId: string) {
  const { table, slug } = await getTableAndSlug(storeId, tableId)
  const url = buildMenuUrl(slug, table.number)
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 2, width: 300 })
  return { qrDataUrl, url, tableNumber: table.number }
}

export async function generateQRCodePDF(storeId: string, tableId: string): Promise<Buffer> {
  const { table, slug } = await getTableAndSlug(storeId, tableId)
  const url = buildMenuUrl(slug, table.number)

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

  const order = await prisma.order.findFirst({
    where: {
      tableId,
      storeId,
      status: { not: 'CANCELLED' },
    },
    include: {
      items: {
        include: { additionals: true },
      },
    },
  })

  if (!order) {
    throw new AppError('Mesa não tem comanda aberta', 422)
  }

  const subtotal = order.items.reduce((acc, item) => acc + item.totalPrice, 0)
  const serviceCharge =
    data.applyServiceCharge && data.serviceChargePercent
      ? (subtotal * data.serviceChargePercent) / 100
      : 0
  const total = subtotal + serviceCharge

  await prisma.$transaction([
    prisma.table.update({
      where: { id: tableId },
      data: { isOccupied: false },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'DELIVERED' },
    }),
  ])

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'table.close',
      entity: 'Table',
      entityId: tableId,
      data: {
        tableNumber: table.number,
        orderId: order.id,
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
    orderId: order.id,
    itemCount: order.items.length,
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

  const order = await prisma.order.findFirst({
    where: {
      tableId,
      storeId,
      status: { not: 'CANCELLED' },
    },
    include: {
      items: {
        include: { additionals: true },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!order) {
    return { table, order: null, items: [], subtotal: 0, total: 0 }
  }

  const subtotal = order.items.reduce((acc, item) => acc + item.totalPrice, 0)

  return {
    table,
    order,
    items: order.items,
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

  emit.itemStatus(storeId, tableId, { itemId, status: data.status })

  return updated
}
