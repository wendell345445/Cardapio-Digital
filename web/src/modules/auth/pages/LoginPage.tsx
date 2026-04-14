import { Link, useNavigate } from 'react-router-dom'

import { LoginForm } from '../components/LoginForm'

export function LoginPage() {
  const navigate = useNavigate()

  const handleSuccess = () => {
    void navigate('/dashboard', { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-red-600 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary"
            aria-hidden="true"
          >
            <span className="text-2xl font-bold text-white">SC</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Entrar no Menu Panda
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Acesse sua conta para gerenciar seu cardapio
          </p>
        </header>

        <div className="rounded-xl bg-white px-8 py-8 shadow-sm ring-1 ring-gray-200">
          <LoginForm onSuccess={handleSuccess} />
        </div>

        <p className="text-center text-sm text-gray-600">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-red-600 hover:underline">
            Criar minha loja grátis
          </Link>
        </p>
      </div>
    </main>
  )
}
