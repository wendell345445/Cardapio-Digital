import axios from 'axios'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'

// Em dev, baseURL relativo cai no proxy do Vite (vite.config.ts → :3001).
// Em prod, VITE_API_URL aponta pra API absoluta (ex: https://api.menupanda.com.br).
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Rotas onde 401 NÃO significa "sessão inválida" — são falhas de validação
// específicas da requisição (ex: senha incorreta no reauth). Não derrubar sessão.
const SKIP_AUTO_LOGOUT_ON_401 = ['/auth/reauth', '/auth/login', '/auth/refresh']

const REFRESH_TOKEN_KEY = 'refresh_token'

// Evita mostrar o toast de sessão revogada múltiplas vezes quando várias
// requests em paralelo batem no 401 ao mesmo tempo.
let sessionRevokedToastShown = false

// Fila de refresh: quando várias requests batem 401 simultaneamente (típico
// com polling de pedidos + outros hooks), só dispara UM POST /auth/refresh.
// As demais aguardam essa promise e reaproveitam o novo access token.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh = sessionStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refresh) throw new Error('no_refresh_token')

  // Chamada direta com axios cru (sem instância `api`) pra não recursar no
  // interceptor caso o próprio /auth/refresh retorne 401.
  const response = await axios.post<{ success: boolean; data: { accessToken: string } }>(
    `${baseURL}/auth/refresh`,
    { refreshToken: refresh },
    { headers: { 'Content-Type': 'application/json' } }
  )
  const accessToken = response.data?.data?.accessToken
  if (!accessToken) throw new Error('refresh_no_token')
  useAuthStore.getState().setToken(accessToken)
  return accessToken
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config
    const url: string = originalRequest?.url ?? ''
    const code: string | undefined = error.response?.data?.code
    const shouldSkip = SKIP_AUTO_LOGOUT_ON_401.some((path) => url.includes(path))

    if (status === 401 && code === 'SESSION_REVOKED' && !sessionRevokedToastShown) {
      sessionRevokedToastShown = true
      if (typeof window !== 'undefined') {
        setTimeout(() => { sessionRevokedToastShown = false }, 5000)
        window.alert('Sua sessão foi encerrada porque você entrou em outro dispositivo. Faça login novamente.')
      }
      useAuthStore.getState().logout()
      return Promise.reject(error)
    }

    // Tenta refresh apenas em 401 fora das rotas skip e só uma vez por request.
    if (
      status === 401 &&
      !shouldSkip &&
      !originalRequest._retry &&
      sessionStorage.getItem(REFRESH_TOKEN_KEY)
    ) {
      originalRequest._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }
        const newToken = await refreshPromise
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }
    }

    if (status === 401 && !shouldSkip) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)
