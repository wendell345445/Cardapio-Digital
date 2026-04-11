import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'

import type {
  CalculateDeliveryInput,
  CreateDistanceInput,
  CreateNeighborhoodInput,
  SetDeliveryModeInput,
  UpdateDistanceInput,
  UpdateNeighborhoodInput,
} from './delivery.schema'

// ─── TASK-091: Serviço de Área de Entrega ────────────────────────────────────

// ── Haversine formula (retorna distância em km) ──
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Neighborhoods ────────────────────────────────────────────────────────────

export async function listNeighborhoods(storeId: string) {
  return prisma.deliveryNeighborhood.findMany({
    where: { storeId },
    orderBy: { name: 'asc' },
  })
}

export async function createNeighborhood(storeId: string, input: CreateNeighborhoodInput) {
  return prisma.deliveryNeighborhood.create({
    data: { storeId, name: input.name, fee: input.fee },
  })
}

export async function updateNeighborhood(
  storeId: string,
  id: string,
  input: UpdateNeighborhoodInput
) {
  const nb = await prisma.deliveryNeighborhood.findUnique({ where: { id } })
  if (!nb || nb.storeId !== storeId) throw new AppError('Bairro não encontrado', 404)
  return prisma.deliveryNeighborhood.update({ where: { id }, data: input })
}

export async function deleteNeighborhood(storeId: string, id: string) {
  const nb = await prisma.deliveryNeighborhood.findUnique({ where: { id } })
  if (!nb || nb.storeId !== storeId) throw new AppError('Bairro não encontrado', 404)
  await prisma.deliveryNeighborhood.delete({ where: { id } })
}

// ─── Distance ranges ─────────────────────────────────────────────────────────

export async function listDistances(storeId: string) {
  return prisma.deliveryDistance.findMany({
    where: { storeId },
    orderBy: { minKm: 'asc' },
  })
}

export async function createDistance(storeId: string, input: CreateDistanceInput) {
  if (input.minKm >= input.maxKm)
    throw new AppError('minKm deve ser menor que maxKm', 422)
  return prisma.deliveryDistance.create({
    data: { storeId, minKm: input.minKm, maxKm: input.maxKm, fee: input.fee },
  })
}

export async function updateDistance(storeId: string, id: string, input: UpdateDistanceInput) {
  const d = await prisma.deliveryDistance.findUnique({ where: { id } })
  if (!d || d.storeId !== storeId) throw new AppError('Faixa de distância não encontrada', 404)
  return prisma.deliveryDistance.update({ where: { id }, data: input })
}

export async function deleteDistance(storeId: string, id: string) {
  const d = await prisma.deliveryDistance.findUnique({ where: { id } })
  if (!d || d.storeId !== storeId) throw new AppError('Faixa de distância não encontrada', 404)
  await prisma.deliveryDistance.delete({ where: { id } })
}

// ─── Delivery Mode ────────────────────────────────────────────────────────────

export async function setDeliveryMode(
  storeId: string,
  input: SetDeliveryModeInput,
  userId: string,
  ip?: string
) {
  const store = await prisma.store.update({
    where: { id: storeId },
    data: { deliveryMode: input.mode },
    select: { id: true, deliveryMode: true },
  })

  await prisma.auditLog.create({
    data: {
      storeId,
      userId,
      action: 'delivery.mode_change',
      entity: 'Store',
      entityId: storeId,
      data: { deliveryMode: input.mode },
      ip,
    },
  })

  return store
}

export async function getDeliveryConfig(storeId: string) {
  const [store, neighborhoods, distances] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { deliveryMode: true } }),
    prisma.deliveryNeighborhood.findMany({ where: { storeId }, orderBy: { name: 'asc' } }),
    prisma.deliveryDistance.findMany({ where: { storeId }, orderBy: { minKm: 'asc' } }),
  ])
  return { deliveryMode: store?.deliveryMode ?? null, neighborhoods, distances }
}

// ─── Calculate delivery fee (public) ─────────────────────────────────────────

export async function calculateDeliveryFee(storeId: string, input: CalculateDeliveryInput) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { deliveryMode: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)

  if (!store.deliveryMode) {
    return { fee: 0, mode: null }
  }

  if (store.deliveryMode === 'NEIGHBORHOOD') {
    if (!input.neighborhood) throw new AppError('Bairro é obrigatório', 422)
    const nb = await prisma.deliveryNeighborhood.findFirst({
      where: { storeId, name: { equals: input.neighborhood, mode: 'insensitive' } },
    })
    if (!nb) throw new AppError('Não entregamos neste bairro', 422)
    return { fee: nb.fee, mode: 'NEIGHBORHOOD' as const }
  }

  // DISTANCE mode
  if (input.latitude === undefined || input.longitude === undefined) {
    throw new AppError('Coordenadas são obrigatórias para cálculo por distância', 422)
  }

  const storeData = await prisma.store.findUnique({
    where: { id: storeId },
    select: { address: true },
  })

  // Store address must contain lat/lng in a parseable format
  // For now we return an error if store coordinates are not available
  // TODO: integrate geocoding API to resolve store address to coordinates
  // The store's lat/lng would need to be stored separately in production
  if (!storeData?.address) throw new AppError('Endereço da loja não configurado', 422)

  const distances = await prisma.deliveryDistance.findMany({
    where: { storeId },
    orderBy: { minKm: 'asc' },
  })

  if (!distances.length) throw new AppError('Nenhuma faixa de distância configurada', 422)

  // We need store lat/lng — use a simple approach: store address field as JSON with lat/lng
  // For now throw a meaningful error
  throw new AppError(
    'Cálculo por distância requer integração de geocodificação. Configure as faixas por bairro ou use a API de integração.',
    422
  )
}

// ─── Exported haversine for tests ────────────────────────────────────────────
export { haversine }
