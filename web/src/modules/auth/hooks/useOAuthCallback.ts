import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuthStore } from '../store/useAuthStore'
import type { AuthUser } from '../store/useAuthStore'

const REFRESH_TOKEN_KEY = 'refresh_token'

function decodeJwtUser(token: string): AuthUser | null {
  try {
    const [, payloadBase64] = token.split('.')
    if (!payloadBase64) return null
    const payloadJson = atob(payloadBase64)
    const payload = JSON.parse(payloadJson) as {
      userId?: string
      role?: AuthUser['role']
      storeId?: string
    }

    if (!payload.userId || !payload.role) return null

    return {
      id: payload.userId,
      role: payload.role,
      storeId: payload.storeId,
    }
  } catch {
    return null
  }
}

export function useOAuthCallback(): void {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const token = searchParams.get('token')
    const refresh = searchParams.get('refresh')
    const userParam = searchParams.get('user')

    if (!token) {
      void navigate('/login', { replace: true })
      return
    }

    let user: AuthUser | null = null

    if (userParam) {
      try {
        user = JSON.parse(decodeURIComponent(userParam)) as AuthUser
      } catch {
        user = null
      }
    }

    if (!user) {
      user = decodeJwtUser(token)
    }

    if (!user) {
      void navigate('/login', { replace: true })
      return
    }

    setAuth(user, token)

    if (refresh) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh)
    }

    void navigate('/dashboard', { replace: true })
  }, [searchParams, navigate, setAuth])
}
