import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { reverseGeocode } from '../menu/geocoding.service'

import type {
  CalculateDeliveryInput,
  CreateDistanceInput,
  CreateNeighborhoodInput,
  UpdateDeliverySettingsInput,
  UpdateDistanceInput,
  UpdateNeighborhoodInput,
} from './delivery.schema'

// Área de entrega: por distância (Haversine) e/ou por bairros (lookup direto).
// Ambas modalidades coexistem; o cliente escolhe no checkout.

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

// ─── Distance ranges ─────────────────────────────────────────────────────────

export async function listDistances(storeId: string) {
  return prisma.deliveryDistance.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: 'asc' }, { maxKm: 'asc' }],
  })
}

export async function createDistance(storeId: string, input: CreateDistanceInput) {
  return prisma.deliveryDistance.create({
    data: {
      storeId,
      maxKm: input.maxKm,
      fee: input.fee,
      etaMin: input.etaMin,
      isAvailable: input.isAvailable,
    },
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

// ─── Neighborhoods ──────────────────────────────────────────────────────────

export async function listNeighborhoods(storeId: string) {
  return prisma.deliveryNeighborhood.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function listAvailableNeighborhoods(storeId: string) {
  return prisma.deliveryNeighborhood.findMany({
    where: { storeId, isAvailable: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function createNeighborhood(storeId: string, input: CreateNeighborhoodInput) {
  const exists = await prisma.deliveryNeighborhood.findUnique({
    where: { storeId_name: { storeId, name: input.name } },
  })
  if (exists) throw new AppError('Bairro já cadastrado', 422)
  return prisma.deliveryNeighborhood.create({
    data: {
      storeId,
      name: input.name,
      fee: input.fee,
      etaMin: input.etaMin,
      isAvailable: input.isAvailable,
    },
  })
}

export async function updateNeighborhood(
  storeId: string,
  id: string,
  input: UpdateNeighborhoodInput
) {
  const n = await prisma.deliveryNeighborhood.findUnique({ where: { id } })
  if (!n || n.storeId !== storeId) throw new AppError('Bairro não encontrado', 404)
  if (input.name && input.name !== n.name) {
    const dup = await prisma.deliveryNeighborhood.findUnique({
      where: { storeId_name: { storeId, name: input.name } },
    })
    if (dup) throw new AppError('Já existe outro bairro com esse nome', 422)
  }
  return prisma.deliveryNeighborhood.update({ where: { id }, data: input })
}

export async function deleteNeighborhood(storeId: string, id: string) {
  const n = await prisma.deliveryNeighborhood.findUnique({ where: { id } })
  if (!n || n.storeId !== storeId) throw new AppError('Bairro não encontrado', 404)
  await prisma.deliveryNeighborhood.delete({ where: { id } })
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function updateDeliverySettings(storeId: string, input: UpdateDeliverySettingsInput) {
  return prisma.store.update({
    where: { id: storeId },
    data: input,
    select: {
      id: true,
      prepTimeMin: true,
      freeDeliveryAboveCents: true,
    },
  })
}

// ─── Config (lat/lng da loja + faixas + bairros + settings) ─────────────────

export async function getDeliveryConfig(storeId: string) {
  const [store, distances, neighborhoods] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        latitude: true,
        longitude: true,
        addressLabel: true,
        prepTimeMin: true,
        freeDeliveryAboveCents: true,
      },
    }),
    prisma.deliveryDistance.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { maxKm: 'asc' }],
    }),
    prisma.deliveryNeighborhood.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])
  return {
    latitude: store?.latitude ?? null,
    longitude: store?.longitude ?? null,
    addressLabel: store?.addressLabel ?? null,
    prepTimeMin: store?.prepTimeMin ?? 30,
    freeDeliveryAboveCents: store?.freeDeliveryAboveCents ?? null,
    distances,
    neighborhoods,
  }
}

// ─── Store coordinates ──────────────────────────────────────────────────────

export async function setStoreCoordinates(
  storeId: string,
  input: { latitude: number; longitude: number; addressLabel?: string | null }
) {
  let addressLabel: string | null | undefined = input.addressLabel
  if (addressLabel === undefined) {
    try {
      const reverse = await reverseGeocode(input.latitude, input.longitude)
      addressLabel = reverse.displayName ?? null
    } catch {
      addressLabel = null
    }
  }

  return prisma.store.update({
    where: { id: storeId },
    data: {
      latitude: input.latitude,
      longitude: input.longitude,
      addressLabel,
    },
    select: { id: true, latitude: true, longitude: true, addressLabel: true },
  })
}

// ─── Calculate delivery fee (public) ─────────────────────────────────────────
// Aceita { latitude, longitude } (modo distância) ou { neighborhoodId } (modo bairro).

export async function calculateDeliveryFee(storeId: string, input: CalculateDeliveryInput) {
  if (input.neighborhoodId) {
    return calculateByNeighborhood(storeId, input.neighborhoodId)
  }
  if (input.latitude === undefined || input.longitude === undefined) {
    throw new AppError('Informe neighborhoodId ou latitude/longitude', 422)
  }
  return calculateByDistance(storeId, input.latitude, input.longitude)
}

export async function calculateByDistance(storeId: string, latitude: number, longitude: number) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { latitude: true, longitude: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)

  if (!store.latitude || !store.longitude) {
    throw new AppError('Coordenadas da loja não configuradas', 422)
  }

  // Só raios disponíveis entram no cálculo — desativados são pulados.
  const distances = await prisma.deliveryDistance.findMany({
    where: { storeId, isAvailable: true },
    orderBy: [{ sortOrder: 'asc' }, { maxKm: 'asc' }],
  })
  if (!distances.length) throw new AppError('Nenhuma faixa de distância configurada', 422)

  const dist = haversine(store.latitude, store.longitude, latitude, longitude)
  // Cliente cai no primeiro raio com dist <= maxKm (sem gap mín/máx).
  const range = distances.find((d) => dist <= d.maxKm)
  if (!range) {
    const maxKm = distances.reduce((acc, d) => Math.max(acc, d.maxKm), 0)
    throw new AppError('Distância fora da área de entrega', 422, undefined, {
      maxKm,
      distance: Math.round(dist * 100) / 100,
    })
  }

  return {
    fee: range.fee,
    distance: Math.round(dist * 100) / 100,
    etaMin: range.etaMin,
  }
}

export async function calculateByNeighborhood(storeId: string, neighborhoodId: string) {
  const n = await prisma.deliveryNeighborhood.findUnique({ where: { id: neighborhoodId } })
  if (!n || n.storeId !== storeId) throw new AppError('Bairro não encontrado', 404)
  if (!n.isAvailable) throw new AppError('Bairro indisponível para entrega', 422)
  return {
    fee: n.fee,
    etaMin: n.etaMin,
    neighborhoodId: n.id,
    neighborhoodName: n.name,
  }
}

// ─── Exported haversine for tests ────────────────────────────────────────────
export { haversine }
