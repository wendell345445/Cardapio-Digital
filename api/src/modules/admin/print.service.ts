// ─── TASK-084: Impressão Automática ESC/POS (Plano Premium) ──────────────────
//
// Feature flag: store.features.auto_print (Plano 2 - Premium)
// Trigger: chamado quando pedido é confirmado (status → CONFIRMED)
// Tratamento de erro: impressora offline → log, pedido NÃO é afetado
//
// Para usar impressora real: npm install escpos escpos-usb
// Por enquanto, gera o texto formatado ESC/POS e loga (stub pronto para integração)

import { prisma } from '../../shared/prisma/prisma'

interface PrintOrder {
  number: number
  createdAt: Date
  clientName?: string | null
  clientWhatsapp: string
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

function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function padLine(left: string, right: string, width = 42): string {
  const space = width - left.length - right.length
  return left + ' '.repeat(Math.max(1, space)) + right
}

function center(text: string, width = 42): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(pad) + text
}

function separator(char = '-', width = 42): string {
  return char.repeat(width)
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
    `WhatsApp: ${order.clientWhatsapp}`,
    `Tipo: ${typeLabel[order.type] ?? order.type}`,
    `Pagamento: ${paymentLabel[order.paymentMethod] ?? order.paymentMethod}`,
  ]

  if (order.type === 'DELIVERY' && order.address) {
    const addr = order.address
    const addrStr = [addr.street, addr.number, addr.complement, addr.neighborhood, addr.city]
      .filter(Boolean)
      .join(', ')
    lines.push(`Endereço: ${addrStr}`)
  }

  lines.push(separator('-'))
  lines.push('ITENS:')

  for (const item of order.items) {
    const itemName = item.variationName
      ? `${item.productName} (${item.variationName})`
      : item.productName
    lines.push(padLine(`${item.quantity}x ${itemName}`, formatMoney(item.totalPrice)))

    if (item.additionals.length > 0) {
      lines.push(`  + ${item.additionals.map((a) => a.name).join(', ')}`)
    }
    if (item.notes) {
      lines.push(`  Obs: ${item.notes}`)
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
    lines.push(`Obs do pedido: ${order.notes}`)
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
 * Tenta imprimir o pedido via ESC/POS.
 * Chamado de forma fire-and-forget após pedido ser CONFIRMADO.
 * Erros são logados mas NÃO afetam o pedido.
 */
export async function autoPrintOrder(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, name: true, features: true } },
        items: { include: { additionals: true } },
      },
    })

    if (!order) return

    // Feature flag check
    if (!hasAutoPrint(order.store.features)) return

    const receipt = buildReceiptText({
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

    // TODO: Integrar com driver ESC/POS real quando instalar escpos/escpos-usb
    // Exemplo:
    //   const device = new escpos.USB()
    //   const printer = new escpos.Printer(device)
    //   device.open(() => { printer.text(receipt).cut().close() })
    //
    // Por ora, loga o recibo formatado (útil para testes com impressora virtual)
    console.log('[AutoPrint] Pedido #' + order.number + ' — recibo gerado:')
    console.log(receipt)
  } catch (err) {
    // Impressora offline ou erro: loga e NÃO propaga — pedido não é afetado
    console.error('[AutoPrint] Erro ao imprimir pedido', orderId, err)
  }
}
