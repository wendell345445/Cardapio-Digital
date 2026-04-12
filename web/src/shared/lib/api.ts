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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const url: string = error.config?.url ?? ''
      const shouldSkip = SKIP_AUTO_LOGOUT_ON_401.some((path) => url.includes(path))
      if (!shouldSkip) {
        useAuthStore.getState().logout()
      }
    }
    return Promise.reject(error)
  }
)
