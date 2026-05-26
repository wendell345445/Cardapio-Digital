import { AppError } from '../../../../shared/middleware/error.middleware'
import { geoGet } from '../geo.client'

// OSRM — rota real de carro (distância pelas ruas, não linha reta).
// Substitui Haversine no cálculo de frete por distância.
//
// Endpoint:
//   /route/v1/driving/{lon1,lat1};{lon2,lat2}?overview=false
// Atenção: OSRM usa "lon,lat" (não "lat,lon").

export interface OsrmRoute {
  /** Distância em km (arredondada 2 casas — bate com a UX do checkout). */
  distanceKm: number
  /** Duração estimada em minutos (arredondada). */
  durationMin: number
}

interface OsrmResponse {
  code: string
  routes?: Array<{ distance: number; duration: number }>
  message?: string
}

function baseUrl(): string {
  const u = process.env.GEO_ROUTING_URL
  if (!u) throw new AppError('GEO_ROUTING_URL não configurada', 503)
  return u
}

export interface OsrmRouteInput {
  from: { latitude: number; longitude: number }
  to: { latitude: number; longitude: number }
  signal?: AbortSignal
}

export async function route(input: OsrmRouteInput): Promise<OsrmRoute> {
  const { from, to } = input
  const url = `${baseUrl()}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`

  const data = (await geoGet(url, input.signal)) as OsrmResponse

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new AppError(`OSRM não conseguiu calcular rota: ${data.message ?? data.code}`, 422)
  }
  const r = data.routes[0]
  return {
    distanceKm: Math.round((r.distance / 1000) * 100) / 100,
    durationMin: Math.round(r.duration / 60),
  }
}
