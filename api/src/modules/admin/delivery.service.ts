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
  const [neighborhood, store] = await Promise.all([
    prisma.deliveryNeighborhood.create({
      data: { storeId, name: input.name, fee: input.fee },
    }),
    prisma.store.findUnique({ where: { id: storeId }, select: { deliveryMode: true } }),
  ])

  // Auto-ativa modo NEIGHBORHOOD ao cadastrar o primeiro bairro
  if (!store?.deliveryMode) {
    await prisma.store.update({
      where: { id: storeId },
      data: { deliveryMode: 'NEIGHBORHOOD' },
    })
  }

  return neighborhood
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

  // Se deletou o último bairro, desativa o modo NEIGHBORHOOD
  const remaining = await prisma.deliveryNeighborhood.count({ where: { storeId } })
  if (remaining === 0) {
    await prisma.store.update({
      where: { id: storeId },
      data: { deliveryMode: null },
    })
  }
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
    prisma.store.findUnique({
      where: { id: storeId },
      select: { deliveryMode: true, latitude: true, longitude: true },
    }),
    prisma.deliveryNeighborhood.findMany({ where: { storeId }, orderBy: { name: 'asc' } }),
    prisma.deliveryDistance.findMany({ where: { storeId }, orderBy: { minKm: 'asc' } }),
  ])
  return {
    deliveryMode: store?.deliveryMode ?? null,
    latitude: store?.latitude ?? null,
    longitude: store?.longitude ?? null,
    neighborhoods,
    distances,
  }
}

// ─── Store coordinates ──────────────────────────────────────────────────────

export async function setStoreCoordinates(
  storeId: string,
  input: { latitude: number; longitude: number }
) {
  return prisma.store.update({
    where: { id: storeId },
    data: { latitude: input.latitude, longitude: input.longitude },
    select: { id: true, latitude: true, longitude: true },
  })
}

// ─── Calculate delivery fee (public) ─────────────────────────────────────────

export async function calculateDeliveryFee(storeId: string, input: CalculateDeliveryInput) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { deliveryMode: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)

  // Se deliveryMode não está configurado, verifica se há bairros cadastrados
  // (compatibilidade com lojas que cadastraram bairros antes da auto-ativação)
  let effectiveMode = store.deliveryMode
  if (!effectiveMode) {
    const hasNeighborhoods = await prisma.deliveryNeighborhood.count({ where: { storeId } })
    if (hasNeighborhoods > 0) {
      effectiveMode = 'NEIGHBORHOOD'
    } else if (input.neighborhood) {
      throw new AppError('Entrega não disponível no momento', 422)
    } else {
      return { fee: 0, mode: null }
    }
  }

  if (effectiveMode === 'NEIGHBORHOOD') {
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
    select: { latitude: true, longitude: true },
  })

  if (!storeData?.latitude || !storeData?.longitude) {
    throw new AppError('Coordenadas da loja não configuradas', 422)
  }

  const distances = await prisma.deliveryDistance.findMany({
    where: { storeId },
    orderBy: { minKm: 'asc' },
  })

  if (!distances.length) throw new AppError('Nenhuma faixa de distância configurada', 422)

  const dist = haversine(storeData.latitude, storeData.longitude, input.latitude, input.longitude)

  const range = distances.find((d) => dist >= d.minKm && dist < d.maxKm)
  if (!range) throw new AppError('Distância fora da área de entrega', 422)

  return { fee: range.fee, mode: 'DISTANCE' as const, distance: Math.round(dist * 100) / 100 }
}

// ─── Exported haversine for tests ────────────────────────────────────────────
export { haversine }
