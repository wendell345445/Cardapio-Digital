import { Banknote, CreditCard, QrCode, Smartphone } from 'lucide-react'

import type { TablePaymentMethod } from '../../services/tables.service'

interface Props {
  total: number
  onCancel: () => void
  onConfirm: (method: TablePaymentMethod) => void
}

interface MethodOption {
  value: TablePaymentMethod
  label: string
  icon: React.ElementType
  color: string
}

const OPTIONS: MethodOption[] = [
  { value: 'PIX', label: 'PIX', icon: QrCode, color: 'bg-emerald-500 hover:bg-emerald-600' },
  { value: 'CASH', label: 'Dinheiro', icon: Banknote, color: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'CREDIT', label: 'Crédito', icon: CreditCard, color: 'bg-blue-500 hover:bg-blue-600' },
  { value: 'DEBIT', label: 'Débito', icon: Smartphone, color: 'bg-indigo-500 hover:bg-indigo-600' },
]

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PaymentMethodPicker({ total, onCancel, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold text-gray-900">Receber pagamento</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Total a receber: <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onConfirm(opt.value)}
                className={`${opt.color} text-white rounded-xl p-5 flex flex-col items-center gap-2 transition-colors`}
              >
                <Icon className="w-7 h-7" />
                <span className="font-semibold">{opt.label}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
