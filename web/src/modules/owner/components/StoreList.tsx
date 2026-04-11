import { Link } from 'react-router-dom'

import type { StoreListItem, StoreStatus } from '../services/owner.service'

const STATUS_LABELS: Record<StoreStatus, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<StoreStatus, string> = {
  TRIAL: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

interface StoreListProps {
  stores: StoreListItem[]
}

export function StoreList({ stores }: StoreListProps) {
  if (stores.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nenhuma loja encontrada.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Slug</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Plano</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">MRR</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Criada em</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {stores.map((store) => (
            <tr key={store.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{store.name}</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{store.slug}</td>
              <td className="px-4 py-3 text-gray-700">{store.plan}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[store.status]}`}
                >
                  {STATUS_LABELS[store.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">
                {store.planMrr > 0 ? `R$ ${store.planMrr}` : '—'}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(store.createdAt).toLocaleDateString('pt-BR')}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/owner/stores/${store.id}`}
                  className="text-blue-600 hover:underline text-xs"
                >
                  Detalhes
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
