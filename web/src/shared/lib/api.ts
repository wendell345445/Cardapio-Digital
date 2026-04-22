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
const SKIP_AUTO_LOGOUT_ON_401 = ['/auth/reauth', '/auth/login']

// Evita mostrar o toast de sessão revogada múltiplas vezes quando várias
// requests em paralelo batem no 401 ao mesmo tempo.
let sessionRevokedToastShown = false

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const url: string = error.config?.url ?? ''
      const code: string | undefined = error.response?.data?.code
      const shouldSkip = SKIP_AUTO_LOGOUT_ON_401.some((path) => url.includes(path))

      if (code === 'SESSION_REVOKED' && !sessionRevokedToastShown) {
        sessionRevokedToastShown = true
        if (typeof window !== 'undefined') {
          setTimeout(() => { sessionRevokedToastShown = false }, 5000)
          window.alert('Sua sessão foi encerrada porque você entrou em outro dispositivo. Faça login novamente.')
        }
      }

      if (!shouldSkip) {
        useAuthStore.getState().logout()
      }
    }
    return Promise.reject(error)
  }
)
