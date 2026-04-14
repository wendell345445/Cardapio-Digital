import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { useCreateCoupon, useDeleteCoupon, useProductPromo, useUpdateCoupon } from '../hooks/useCoupons'
import type { Product } from '../services/products.service'

interface ProductPromoModalProps {
  product: Product | null
  onClose: () => void
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  // yyyy-MM-ddTHH:mm no fuso local (sem segundos nem Z)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(local: string): string | undefined {
  if (!local) return undefined
  return new Date(local).toISOString()
}

export function ProductPromoModal({ product, onClose }: ProductPromoModalProps) {
  const open = !!product
  const { data: existing } = useProductPromo(product?.id)
  const createMutation = useCreateCoupon()
  const updateMutation = useUpdateCoupon()
  const deleteMutation = useDeleteCoupon()

  const [promoPrice, setPromoPrice] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setPromoPrice(existing.promoPrice != null ? String(existing.promoPrice) : '')
      setStartsAt(toLocalInput(existing.startsAt))
      setExpiresAt(toLocalInput(existing.expiresAt))
    } else {
      setPromoPrice('')
      setStartsAt('')
      setExpiresAt('')
    }
    setError(null)
  }, [open, existing])

  if (!open || !product) return null

  const saving = createMutation.isPending || updateMutation.isPending
  const removing = deleteMutation.isPending
  const basePrice = product.basePrice ?? 0
  const priceAsNumber = Number(promoPrice.replace(',', '.'))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!priceAsNumber || priceAsNumber <= 0) {
      setError('Informe o preço promocional.')
      return
    }
    if (basePrice > 0 && priceAsNumber >= basePrice) {
      setError(`O preço promocional precisa ser menor que o preço base (R$ ${basePrice.toFixed(2)}).`)
      return
    }
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      setError('A data de término precisa ser depois da data de início.')
      return
    }

    const payload = {
      promoPrice: priceAsNumber,
      startsAt: fromLocalInput(startsAt),
      expiresAt: fromLocalInput(expiresAt),
    }

    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          data: { ...payload, isActive: true },
        })
      } else {
        await createMutation.mutateAsync({ productId: product!.id, ...payload })
      }
      onClose()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })
        ?.response?.data
      setError(data?.error ?? data?.message ?? 'Erro ao salvar promoção.')
    }
  }

  async function handleRemove() {
    if (!existing) return
    if (!window.confirm('Remover esta promoção?')) return
    try {
      await deleteMutation.mutateAsync(existing.id)
      onClose()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } })?.response?.data
      setError(data?.error ?? 'Erro ao remover promoção.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {existing ? 'Editar desconto' : 'Adicionar desconto'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{product.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preço original
            </label>
            <input
              type="text"
              disabled
              value={basePrice > 0 ? basePrice.toFixed(2).replace('.', ',') : '—'}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preço promocional <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
              placeholder="Ex: 39,90"
              autoFocus
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Vazio = já vigente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Término</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Vazio = sem expiração</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <div>
              {existing && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  {removing ? 'Removendo...' : 'Remover desconto'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Salvando...' : existing ? 'Salvar' : 'Criar desconto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
