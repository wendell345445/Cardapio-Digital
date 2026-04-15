import { useNavigate } from 'react-router-dom'

import { LoginForm } from '../components/LoginForm'

import { useStoreSlug } from '@/hooks/useStoreSlug'

export function MotoboyLoginPage() {
  const slug = useStoreSlug()
  const navigate = useNavigate()

  const handleSuccess = () => {
    void navigate('/motoboy', { replace: true })
  }

  const title = slug && slug !== '__custom_domain__'
    ? `Painel do Motoboy — ${slug}`
    : 'Painel do Motoboy'

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500"
            aria-hidden="true"
          >
            <span className="text-2xl font-bold text-white">MB</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Acesse o painel exclusivo para entregadores
          </p>
        </header>

        <div className="rounded-xl bg-white px-8 py-8 shadow-sm ring-1 ring-gray-200">
          <LoginForm onSuccess={handleSuccess} scope="motoboy" />
        </div>
      </div>
    </main>
  )
}
