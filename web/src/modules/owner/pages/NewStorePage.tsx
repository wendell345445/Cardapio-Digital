import { useNavigate, Link } from 'react-router-dom'

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
    error && (error as any)?.response?.data?.message
      ? (error as any).response.data.message
      : error?.message

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to="/owner/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nova loja</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-600 mb-6">
          Preencha os dados abaixo para criar uma nova loja. O admin receberá um email com a senha
          temporária.
        </p>

        {errorMessage && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <StoreForm onSubmit={handleSubmit} isLoading={isPending} />
      </main>
    </div>
  )
}
