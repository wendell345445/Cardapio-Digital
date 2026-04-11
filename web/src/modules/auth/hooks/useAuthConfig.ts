import { useQuery } from '@tanstack/react-query'

import { getAuthConfig, type AuthConfig } from '../services/auth.service'

const STALE_TIME = 5 * 60 * 1000 // 5 min — bate com o Cache-Control do backend

/**
 * v2.5+ — Lê GET /api/v1/auth/config para descobrir quais providers OAuth estão habilitados.
 * Usado pelo LoginForm para renderizar (ou esconder) os botões sociais.
 */
export function useAuthConfig() {
  return useQuery<AuthConfig>({
    queryKey: ['auth-config'],
    queryFn: getAuthConfig,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME,
    refetchOnWindowFocus: false,
  })
}
