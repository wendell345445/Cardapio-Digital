// ─── Impressão Automática (fila para app desktop Menuziprinter) ──────────────
//
// Feature flag: store.features.auto_print (Plano Premium)
// Trigger: chamado quando pedido é confirmado (status → CONFIRMED)
// Tratamento de erro: erro na enfileiração → log, pedido NÃO é afetado
//
// Em vez de imprimir diretamente, autoPrintOrder enfileira um PrintJob(PENDING)
// que será consumido pelo app desktop Menuziprinter via polling
// (GET /api/print/pending → POST /api/print/mark-printed).

import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

interface PrintOrder {
  number: number
  createdAt: Date
  clientName?: string | null
  clientWhatsapp?: string | null
  type: string
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  notes?: string | null
  address?: Record<string, string> | null
  items: Array<{
    productName: string
    variationName?: string | null
    quantity: number
    totalPrice: number
    notes?: string | null
    additionals: Array<{ name: string; price: number }>
  }>
}

const COL = 42 // largura padrão impressora térmica 80mm

function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

/**
 * Alinha left...right na mesma linha se couber.
 * Se não couber, coloca o preço na linha seguinte alinhado à direita.
 */
function padLine(left: string, right: string): string {
  if (left.length + 1 + right.length <= COL) {
    const space = COL - left.length - right.length
    return left + ' '.repeat(space) + right
  }
  return left + '\n' + right.padStart(COL)
}

function center(text: string): string {
  const pad = Math.max(0, Math.floor((COL - text.length) / 2))
  return ' '.repeat(pad) + text
}

function separator(char = '-'): string {
  return char.repeat(COL)
}

/** Quebra texto longo em múltiplas linhas de no máximo COL colunas */
function wrapText(text: string, indent = 0): string[] {
  const maxLen = COL - indent
  if (text.length <= maxLen) return [' '.repeat(indent) + text]

  const prefix = ' '.repeat(indent)
  const result: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      result.push(prefix + remaining)
      break
    }
    // quebra na última palavra que cabe
    let breakAt = remaining.lastIndexOf(' ', maxLen)
    if (breakAt <= 0) breakAt = maxLen // sem espaço — corta forçado
    result.push(prefix + remaining.slice(0, breakAt))
    remaining = remaining.slice(breakAt).trimStart()
  }

  return result
}

/** Gera o texto formatado para impressão ESC/POS */
export function buildReceiptText(order: PrintOrder): string {
  const date = new Date(order.createdAt)
  const dateStr = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const timeStr = date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

  const typeLabel: Record<string, string> = {
    DELIVERY: 'Entrega',
    PICKUP: 'Retirada',
    TABLE: 'Mesa',
  }

  const paymentLabel: Record<string, string> = {
    PIX: 'PIX',
    CASH_ON_DELIVERY: 'Dinheiro/Cartão na entrega',
  }

  const lines: string[] = [
    center('MENU PANDA'),
    separator('='),
    center(`PEDIDO #${order.number}`),
    center(`${dateStr} ${timeStr}`),
    separator('-'),
    `Cliente: ${order.clientName ?? 'N/A'}`,
    `WhatsApp: ${order.clientWhatsapp ?? '—'}`,
    `Tipo: ${typeLabel[order.type] ?? order.type}`,
    `Pagamento: ${paymentLabel[order.paymentMethod] ?? order.paymentMethod}`,
  ]

  if (order.type === 'DELIVERY' && order.address) {
    const addr = order.address
    const addrStr = [addr.street, addr.number, addr.complement, addr.neighborhood, addr.city]
      .filter(Boolean)
      .join(', ')
    lines.push(...wrapText(`Endereço: ${addrStr}`))
  }

  lines.push(separator('-'))
  lines.push('ITENS:')

  for (const item of order.items) {
    const itemName = item.variationName
      ? `${item.productName} (${item.variationName})`
      : item.productName
    lines.push(padLine(`${item.quantity}x ${itemName}`, formatMoney(item.totalPrice)))

    if (item.additionals.length > 0) {
      lines.push(...wrapText(`+ ${item.additionals.map((a) => a.name).join(', ')}`, 2))
    }
    if (item.notes) {
      lines.push(...wrapText(`Obs: ${item.notes}`, 2))
    }
  }

  lines.push(separator('-'))

  if (order.discount > 0) {
    lines.push(padLine('Desconto:', `-${formatMoney(order.discount)}`))
  }
  if (order.deliveryFee > 0) {
    lines.push(padLine('Taxa de entrega:', formatMoney(order.deliveryFee)))
  }
  lines.push(padLine('TOTAL:', formatMoney(order.total)))

  if (order.notes) {
    lines.push(separator('-'))
    lines.push(...wrapText(`Obs pedido: ${order.notes}`))
  }

  lines.push(separator('='))
  lines.push(center('Obrigado pela preferencia!'))
  lines.push('')

  return lines.join('\n')
}

/** Verifica se a loja tem auto_print habilitado (feature flag Premium) */
function hasAutoPrint(features: unknown): boolean {
  if (!features || typeof features !== 'object') return false
  return (features as Record<string, boolean>).auto_print === true
}

/**
 * Busca pedido e retorna o texto do recibo formatado.
 * Usado pelo endpoint GET /admin/orders/:id/receipt para impressão manual.
 */
export async function getOrderReceipt(storeId: string, orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { additionals: true } },
    },
  })

  if (!order || order.storeId !== storeId) {
    throw new AppError('Pedido não encontrado', 404)
  }

  return buildReceiptText({
    number: order.number,
    createdAt: order.createdAt,
    clientName: order.clientName,
    clientWhatsapp: order.clientWhatsapp,
    type: order.type,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    total: order.total,
    notes: order.notes,
    address: order.address as Record<string, string> | null,
    items: order.items.map((i) => ({
      productName: i.productName,
      variationName: i.variationName,
      quantity: i.quantity,
      totalPrice: i.totalPrice,
      notes: i.notes,
      additionals: i.additionals,
    })),
  })
}

/**
 * Enfileira o pedido para impressão na fila consumida pelo Menuziprinter.
 * Chamado de forma fire-and-forget após pedido virar CONFIRMED.
 * Erros são logados mas NÃO afetam o pedido.
 *
 * Idempotente: `PrintJob.orderId` é UNIQUE — segunda chamada para o mesmo pedido
 * vira no-op (Prisma P2002). Isso evita duplicidade se autoConfirmOrders e um
 * advance manual disparam em sequência.
 */
export async function autoPrintOrder(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        storeId: true,
        number: true,
        store: { select: { features: true } },
      },
    })

    if (!order) return

    // Feature flag check
    if (!hasAutoPrint(order.store.features)) return

    await prisma.printJob.create({
      data: {
        storeId: order.storeId,
        orderId: order.id,
      },
    })
  } catch (err) {
    // P2002: PrintJob para esse orderId já existe — idempotente, ignora.
    if (typeof err === 'object' && err && (err as { code?: string }).code === 'P2002') return
    console.error('[AutoPrint] Erro ao enfileirar pedido', orderId, err)
  }
}
