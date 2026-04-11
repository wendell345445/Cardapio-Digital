import { api } from '../../../shared/lib/api'
import type { AuthUser } from '../store/useAuthStore'

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<ApiEnvelope<LoginResponse>>('/auth/login', { email, password })
  return response.data.data
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken })
}

export async function refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
  const response = await api.post<ApiEnvelope<RefreshTokenResponse>>('/auth/refresh', { refreshToken })
  return response.data.data
}

export interface AuthConfig {
  providers: {
    google: boolean
    facebook: boolean
  }
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const response = await api.get<AuthConfig>('/auth/config')
  return response.data
}

export interface RegisterStorePayload {
  storeName: string
  segment: string
  email: string
  password: string
  confirmPassword: string
  whatsapp: string
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  plan: 'PROFESSIONAL' | 'PREMIUM'
}

export interface RegisterStoreResponse {
  accessToken: string
  refreshToken: string
  store: {
    id: string
    slug: string
    trialEndsAt: string | null
  }
}

export async function registerStore(
  data: RegisterStorePayload
): Promise<RegisterStoreResponse> {
  const response = await api.post<RegisterStoreResponse>('/auth/register-store', data)
  return response.data
}

export function googleLogin(): void {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
  window.location.href = `${apiUrl}/api/v1/auth/google`
}

export function facebookLogin(): void {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
  window.location.href = `${apiUrl}/api/v1/auth/facebook`
}
