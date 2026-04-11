import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import {
  registerStore,
  type RegisterStorePayload,
  type RegisterStoreResponse,
} from '../services/auth.service'
import { useAuthStore } from '../store/useAuthStore'

const REFRESH_TOKEN_KEY = 'refresh_token'

export type RegisterStoreErrorKind =
  | 'EMAIL_DUPLICATE'
  | 'PASSWORD_MISMATCH'
  | 'RATE_LIMIT'
  | 'GENERIC'

export interface RegisterStoreError {
  kind: RegisterStoreErrorKind
  message: string
  status?: number
}

function classifyError(err: unknown): RegisterStoreError {
  if (!isAxiosError(err)) {
    return { kind: 'GENERIC', message: 'Erro inesperado. Tente novamente.' }
  }

  const status = err.response?.status
  const responseData = err.response?.data as
    | { error?: string; message?: string }
    | undefined
  const apiMessage =
    (responseData?.error as string | undefined) ??
    (responseData?.message as string | undefined) ??
    ''

  if (status === 429) {
    return {
      kind: 'RATE_LIMIT',
      message: 'Muitas tentativas, tente novamente em 1 hora.',
      status,
    }
  }

  if (status === 422 || status === 400) {
    if (apiMessage.toLowerCase().includes('email')) {
      return { kind: 'EMAIL_DUPLICATE', message: 'Email já cadastrado', status }
    }
    if (apiMessage.toLowerCase().includes('senha')) {
      return { kind: 'PASSWORD_MISMATCH', message: 'As senhas não coincidem', status }
    }
    return { kind: 'GENERIC', message: apiMessage || 'Dados inválidos.', status }
  }

  return { kind: 'GENERIC', message: 'Erro ao criar loja. Tente novamente.', status }
}

interface UseRegisterStoreOptions {
  onSuccess?: (data: RegisterStoreResponse) => void
  onError?: (error: RegisterStoreError) => void
}

export function useRegisterStore(options?: UseRegisterStoreOptions) {
  const setAuth = useAuthStore((state) => state.setAuth)

  const mutation = useMutation<RegisterStoreResponse, unknown, RegisterStorePayload>({
    mutationFn: (data: RegisterStorePayload) => registerStore(data),
    onSuccess: (data) => {
      setAuth(
        {
          id: 'self-register',
          role: 'ADMIN',
          storeId: data.store.id,
          email: undefined,
          name: undefined,
        },
        data.accessToken
      )
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
      options?.onSuccess?.(data)
    },
    onError: (err) => {
      const classified = classifyError(err)
      options?.onError?.(classified)
    },
  })

  return {
    register: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error ? classifyError(mutation.error) : null,
  }
}
