import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { cache } from '../../shared/redis/redis'

import type { UpdateCustomerInput } from './customers.schema'

// ─── Tipos de resposta ──────────────────────────────────────────────────────

export interface CustomerAddressView {
  id: string
  isPrimary: boolean
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  reference: string | null
}

export interface CustomerPhoneView {
  id: string
  isPrimary: boolean
  phone: string
  label: string | null
}

export interface CustomerDetailView {
  whatsapp: string
  name: string | null
  totalOrders: number
  totalSpent: number
  averageTicket: number
  firstOrderAt: Date | null
  lastOrderAt: Date | null
  addresses: CustomerAddressView[]
  phones: CustomerPhoneView[]
  hasProfile: boolean
}

// Endereço salvo por pedido (Order.address JSON). Formato flexível histórico.
interface OrderAddressJson {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  cep?: string
  reference?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function invalidateRankingCache(storeId: string): Promise<void> {
  // Ranking cache-keys são `analytics:ranking:${storeId}:...`. Limpa todos.
  return cache.delPattern(`analytics:ranking:${storeId}:*`)
}

// ─── Detalhe do cliente (merge Order + Customer) ────────────────────────────

export async function getCustomerDetail(
  storeId: string,
  whatsapp: string
): Promise<CustomerDetailView> {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      clientWhatsapp: whatsapp,
      status: { notIn: ['CANCELLED', 'WAITING_PAYMENT_PROOF'] },
    },
    select: {
      total: true,
      createdAt: true,
      clientName: true,
      address: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const customer = await prisma.customer.findUnique({
    where: { storeId_whatsapp: { storeId, whatsapp } },
    include: {
      addresses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
    },
  })

  if (orders.length === 0 && !customer) {
    throw new AppError('Cliente não encontrado', 404)
  }

  const totalOrders = orders.length
  const totalSpent = orders.reduce((s, o) => s + o.total, 0)
  const averageTicket = totalOrders > 0 ? totalSpent / totalOrders : 0

  // Fallback: se não existe Customer, usa dados derivados do último pedido.
  let addresses: CustomerAddressView[] = []
  let phones: CustomerPhoneView[] = []

  if (customer) {
    addresses = customer.addresses.map((a) => ({
      id: a.id,
      isPrimary: a.isPrimary,
      zipCode: a.zipCode,
      street: a.street,
      number: a.number,
      complement: a.complement,
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      reference: a.reference,
    }))
    phones = customer.phones.map((p) => ({
      id: p.id,
      isPrimary: p.isPrimary,
      phone: p.phone,
      label: p.label,
    }))
  } else {
    // Deriva endereço do pedido mais recente (quando disponível) — read-only.
    const lastWithAddress = orders.find(
      (o) => o.address && typeof o.address === 'object' && !Array.isArray(o.address)
    )
    if (lastWithAddress && lastWithAddress.address) {
      const addr = lastWithAddress.address as OrderAddressJson
      addresses = [
        {
          id: 'derived-last-order',
          isPrimary: true,
          zipCode: addr.zipCode ?? addr.cep ?? '',
          street: addr.street ?? '',
          number: addr.number ?? '',
          complement: addr.complement ?? null,
          neighborhood: addr.neighborhood ?? '',
          city: addr.city ?? '',
          state: addr.state ?? '',
          reference: addr.reference ?? null,
        },
      ]
    }
  }

  return {
    whatsapp,
    name: customer?.name ?? orders[0]?.clientName ?? null,
    totalOrders,
    totalSpent,
    averageTicket,
    firstOrderAt: orders.length > 0 ? orders[orders.length - 1].createdAt : null,
    lastOrderAt: orders.length > 0 ? orders[0].createdAt : null,
    addresses,
    phones,
    hasProfile: !!customer,
  }
}

// ─── Histórico de pedidos do cliente ────────────────────────────────────────

export interface CustomerOrderItemView {
  productName: string
  variationName: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface CustomerOrderView {
  id: string
  number: number
  type: string
  status: string
  paymentMethod: string
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  items: CustomerOrderItemView[]
  createdAt: Date
}

export interface CustomerOrdersResult {
  orders: CustomerOrderView[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getCustomerOrders(
  storeId: string,
  whatsapp: string,
  page = 1,
  limit = 10
): Promise<CustomerOrdersResult> {
  const where = { storeId, clientWhatsapp: whatsapp }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        number: true,
        type: true,
        status: true,
        paymentMethod: true,
        subtotal: true,
        deliveryFee: true,
        discount: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            productName: true,
            variationName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ])

  return {
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      type: o.type,
      status: o.status,
      paymentMethod: o.paymentMethod,
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      discount: o.discount,
      total: o.total,
      items: o.items.map((i) => ({
        productName: i.productName,
        variationName: i.variationName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
      })),
      createdAt: o.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// ─── Upsert Customer com endereços + telefones ──────────────────────────────
// Estratégia: replace-all em transação — apaga endereços/telefones e recria.
// Simples e idempotente; volume por cliente é pequeno.

export async function upsertCustomer(
  storeId: string,
  whatsapp: string,
  input: UpdateCustomerInput
): Promise<CustomerDetailView> {
  // Valida que ao menos 1 endereço é primary.
  const addresses = input.addresses.map((a, i) => ({
    ...a,
    isPrimary: a.isPrimary ?? i === 0,
  }))
  const primaryCount = addresses.filter((a) => a.isPrimary).length
  if (primaryCount !== 1) {
    throw new AppError('Exatamente 1 endereço deve ser marcado como principal', 400)
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({
      where: { storeId_whatsapp: { storeId, whatsapp } },
    })

    const customerId = existing
      ? existing.id
      : (
          await tx.customer.create({
            data: { storeId, whatsapp, name: input.name },
            select: { id: true },
          })
        ).id

    if (existing) {
      await tx.customer.update({
        where: { id: customerId },
        data: { name: input.name },
      })
      await tx.customerAddress.deleteMany({ where: { customerId } })
      await tx.customerPhone.deleteMany({ where: { customerId } })
    }

    await tx.customerAddress.createMany({
      data: addresses.map((a) => ({
        customerId,
        isPrimary: a.isPrimary,
        zipCode: a.zipCode,
        street: a.street,
        number: a.number,
        complement: a.complement ?? null,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state,
        reference: a.reference ?? null,
      })),
    })

    await tx.customerPhone.createMany({
      data: [
        {
          customerId,
          isPrimary: true,
          phone: input.primaryPhone,
          label: null,
        },
        ...input.secondaryPhones.map((p) => ({
          customerId,
          isPrimary: false,
          phone: p.phone,
          label: p.label ?? null,
        })),
      ],
    })
  })

  await invalidateRankingCache(storeId)

  return getCustomerDetail(storeId, whatsapp)
}
