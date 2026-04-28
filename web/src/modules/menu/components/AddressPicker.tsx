import { useState } from 'react'
import { MapPin, Plus, Check, Trash2 } from 'lucide-react'

import type { SavedAddress } from '../lib/customerAddresses'

// TASK-130 (parte 3): UI pra escolher entre endereços salvos ou cadastrar novo.
// Dois estados visuais:
//   - collapsed: card compacto com endereço selecionado + botão "Trocar".
//   - expanded: lista de salvos com radio + opção "+ Informar novo endereço".

export type AddressMode = 'saved' | 'new'

interface AddressPickerProps {
  addresses: SavedAddress[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUseNew: () => void
  onRemove: (id: string) => void
}

function formatLine1(a: SavedAddress): string {
  const parts = [a.street, a.number]
  if (a.complement) parts.push(a.complement)
  return parts.filter(Boolean).join(', ')
}

function formatLine2(a: SavedAddress): string {
  return [a.neighborhood, a.city].filter(Boolean).join(' — ')
}

export function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  onUseNew,
  onRemove,
}: AddressPickerProps) {
  const [expanded, setExpanded] = useState(false)
  const selected = addresses.find((a) => a.id === selectedId) ?? null

  if (!expanded && selected) {
    return (
      <div className="border-2 border-red-500 rounded-lg p-3 bg-red-50/40">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{formatLine1(selected)}</p>
            <p className="text-xs text-gray-500 truncate">{formatLine2(selected)}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-red-500 hover:text-red-600 whitespace-nowrap"
          >
            Trocar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {addresses.map((a) => {
        const isSelected = a.id === selectedId
        return (
          <div
            key={a.id}
            className={`flex items-start gap-2 p-3 rounded-lg border-2 transition-colors ${
              isSelected ? 'border-red-500 bg-red-50/40' : 'border-gray-200 bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                onSelect(a.id)
                setExpanded(false)
              }}
              className="flex-1 flex items-start gap-2 text-left min-w-0"
            >
              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'
              }`}>
                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900 block truncate">{formatLine1(a)}</span>
                <span className="text-xs text-gray-500 block truncate">{formatLine2(a)}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label="Remover endereço"
              onClick={() => onRemove(a.id)}
              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => {
          onUseNew()
          setExpanded(false)
        }}
        className="w-full flex items-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Informar novo endereço
      </button>
    </div>
  )
}
