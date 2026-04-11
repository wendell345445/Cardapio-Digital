import { Loader2 } from 'lucide-react'

import { useOAuthCallback } from '../hooks/useOAuthCallback'

export function OAuthCallbackPage() {
  useOAuthCallback()

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        aria-hidden="true"
        className="h-10 w-10 animate-spin text-primary"
      />
      <p className="text-sm font-medium text-gray-600">Autenticando...</p>
    </main>
  )
}
