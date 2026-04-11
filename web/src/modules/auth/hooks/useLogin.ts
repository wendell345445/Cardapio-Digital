import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { login } from '../services/auth.service'
import { useAuthStore } from '../store/useAuthStore'

const REFRESH_TOKEN_KEY = 'refresh_token'

interface UseLoginResult {
  login: (
    credentials: { email: string; password: string },
    options?: { onSuccess?: () => void }
  ) => void
  isLoading: boolean
  error: string | null
}

export function useLogin(): UseLoginResult {
  const setAuth = useAuthStore((state) => state.setAuth)

  const mutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken)
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
    },
  })

  const errorMessage = mutation.error
    ? isAxiosError(mutation.error) &&
      (mutation.error.response?.data?.error || mutation.error.response?.data?.message)
      ? String(mutation.error.response.data.error || mutation.error.response.data.message)
      : 'Erro ao fazer login. Tente novamente.'
    : null

  const handleLogin: UseLoginResult['login'] = (credentials, options) => {
    mutation.mutate(credentials, {
      onSuccess: () => {
        options?.onSuccess?.()
      },
    })
  }

  return {
    login: handleLogin,
    isLoading: mutation.isPending,
    error: errorMessage,
  }
}
