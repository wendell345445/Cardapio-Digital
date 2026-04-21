import { AppError } from '../../shared/middleware/error.middleware'
import { prisma } from '../../shared/prisma/prisma'
import { reverseGeocode } from '../menu/geocoding.service'

import type {
  CalculateDeliveryInput,
  CreateDistanceInput,
  UpdateDistanceInput,
} from './delivery.schema'

// Área de entrega: só por distância (Haversine entre Store.lat/lng e cliente.lat/lng).

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

// ─── Config (lat/lng da loja + faixas) ───────────────────────────────────────

export async function getDeliveryConfig(storeId: string) {
  const [store, distances] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: { latitude: true, longitude: true, addressLabel: true },
    }),
    prisma.deliveryDistance.findMany({ where: { storeId }, orderBy: { minKm: 'asc' } }),
  ])
  return {
    latitude: store?.latitude ?? null,
    longitude: store?.longitude ?? null,
    addressLabel: store?.addressLabel ?? null,
    distances,
  }
}

// ─── Store coordinates ──────────────────────────────────────────────────────

export async function setStoreCoordinates(
  storeId: string,
  input: { latitude: number; longitude: number; addressLabel?: string | null }
) {
  // Resolve o addressLabel em 3 cenários:
  // 1. Cliente mandou string → usa o que veio (fluxo "busca por endereço")
  // 2. Cliente mandou null → apaga o label (reset explícito)
  // 3. Cliente não mandou (undefined) → tenta reverse-geocode.
  //    Garante que coordenadas inseridas manualmente também ganhem endereço legível
  //    para auditoria/conformidade. Falha silenciosa: se Nominatim estiver fora,
  //    salva sem label — coords manuais continuam sendo aceitas.
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
// Requer lat/lng do cliente (resolvido no frontend via /menu/delivery/geocode).

export async function calculateDeliveryFee(storeId: string, input: CalculateDeliveryInput) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { latitude: true, longitude: true },
  })
  if (!store) throw new AppError('Loja não encontrada', 404)

  if (!store.latitude || !store.longitude) {
    throw new AppError('Coordenadas da loja não configuradas', 422)
  }

  const distances = await prisma.deliveryDistance.findMany({
    where: { storeId },
    orderBy: { minKm: 'asc' },
  })
  if (!distances.length) throw new AppError('Nenhuma faixa de distância configurada', 422)

  const dist = haversine(store.latitude, store.longitude, input.latitude, input.longitude)
  const range = distances.find((d) => dist >= d.minKm && dist < d.maxKm)
  if (!range) throw new AppError('Distância fora da área de entrega', 422)

  return { fee: range.fee, distance: Math.round(dist * 100) / 100 }
}

// ─── Exported haversine for tests ────────────────────────────────────────────
export { haversine }
