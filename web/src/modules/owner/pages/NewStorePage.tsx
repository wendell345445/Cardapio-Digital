import { Link, useNavigate } from 'react-router-dom'

import { useCreateStore } from '../hooks/useOwnerStores'
import { StoreForm, type CreateStoreFormData } from '../components/StoreForm'

export function NewStorePage() {
  const navigate = useNavigate()
  const { mutate, isPending, error } = useCreateStore()

  function handleSubmit(data: CreateStoreFormData) {
    mutate(data, {
      onSuccess: (store) => navigate(`/owner/stores/${store.id}`),
    })
  }

  const errorMessage =
    error && (error as unknown as { response?: { data?: { message?: string } } })?.response?.data?.message
      ? (error as unknown as { response: { data: { message: string } } }).response.data.message
      : error?.message

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary/5 px-4 py-4">
      <div className="w-full max-w-xl">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <header className="mb-4">
            <Link
              to="/owner/dashboard"
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              &larr; Dashboard
            </Link>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-gray-900">Nova loja</h1>
            <p className="mt-0.5 text-[11px] text-gray-600">
              Preencha os dados abaixo para criar uma nova loja. O admin receberá um email com a
              senha temporária.
            </p>
          </header>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <StoreForm onSubmit={handleSubmit} isLoading={isPending} />
        </div>
      </div>
    </main>
  )
}
