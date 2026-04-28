import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/lib/api'

export interface GeocodingUsage {
  used: number
  quota: number
  percent: number
  month: string
}

interface GeocodingUsageResponse {
  success: boolean
  data: GeocodingUsage
}

// Atualiza a cada 5 minutos. A cota muda devagar e o endpoint só serve pra
// avisar o OWNER em 70/80/90/100% — polling agressivo seria desperdício.
const REFETCH_INTERVAL_MS = 5 * 60 * 1000

export function useGeocodingUsage(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'system', 'geocoding-usage'],
    queryFn: async (): Promise<GeocodingUsage> => {
      const response = await api.get<GeocodingUsageResponse>('/admin/system/geocoding-usage')
      return response.data.data
    },
    enabled,
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS,
  })
}
