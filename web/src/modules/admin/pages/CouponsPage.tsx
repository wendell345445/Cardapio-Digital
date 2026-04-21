import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Pencil, Plus, Star, Trash2, X } from 'lucide-react'

import { useCoupons, useCreateCoupon, useDeleteCoupon, useUpdateCoupon } from '../hooks/useCoupons'
import type { Coupon } from '../services/coupons.service'

// ─── Schema ───────────────────────────────────────────────────────────────────

const couponSchema = z.object({
  code: z.string().min(1, 'Informe o código').toUpperCase(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number().positive('Informe um valor positivo'),
  minOrder: z.coerce.number().optional(),
  maxUses: z.coerce.number().int().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

type CouponForm = z.infer<typeof couponSchema>

// Tamanho da página da listagem — client-side pagination.
const PAGE_SIZE = 8

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { message: string; type: 'success' | 'error' } | null

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium transition-all ${
        toast.type === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-80 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── CouponModal ──────────────────────────────────────────────────────────────

function CouponModal({
  coupon,
  onClose,
  onToast,
}: {
  coupon: Coupon | null
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const createMutation = useCreateCoupon()
  const updateMutation = useUpdateCoupon()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<CouponForm>({
    resolver: zodResolver(couponSchema),
    defaultValues: coupon
      ? {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minOrder: coupon.minOrder ?? undefined,
          maxUses: coupon.maxUses ?? undefined,
          expiresAt: coupon.expiresAt
            ? new Date(coupon.expiresAt).toISOString().substring(0, 10)
            : undefined,
          isActive: coupon.isActive,
        }
      : { type: 'PERCENTAGE', isActive: true },
  })

  const selectedType = watch('type')

  const onSubmit = async (form: CouponForm) => {
    try {
      const payload = {
        code: form.code.toUpperCase(),
        type: form.type,
        value: form.value,
        minOrder: form.minOrder || undefined,
        maxUses: form.maxUses || undefined,
        expiresAt: form.expiresAt || undefined,
        isActive: form.isActive,
      }

      if (coupon) {
        await updateMutation.mutateAsync({ id: coupon.id, data: payload })
        onToast('Cupom atualizado com sucesso!', 'success')
      } else {
        await createMutation.mutateAsync(payload)
        onToast('Cupom criado com sucesso!', 'success')
      }
      onClose()
    } catch {
      onToast('Erro ao salvar cupom.', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-bold text-gray-900">
            {coupon ? 'Editar Cupom' : 'Novo Cupom'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
          {/* Código */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código *
            </label>
            <input
              type="text"
              {...register('code')}
              placeholder="EX: PROMO10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.code && (
              <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo *
            </label>
            <select
              {...register('type')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PERCENTAGE">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor {selectedType === 'PERCENTAGE' ? '(%)' : '(R$)'} *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                {selectedType === 'PERCENTAGE' ? '%' : 'R$'}
              </span>
              <input
                type="number"
                step="0.01"
                {...register('value')}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {errors.value && (
              <p className="text-red-500 text-xs mt-1">{errors.value.message}</p>
            )}
          </div>

          {/* Pedido mínimo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pedido mínimo (R$) <span className="text-gray-400 font-normal">opcional</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('minOrder')}
              placeholder="0,00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Limite de usos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limite de usos <span className="text-gray-400 font-normal">opcional</span>
            </label>
            <input
              type="number"
              step="1"
              {...register('maxUses')}
              placeholder="Sem limite"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Validade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Válido até <span className="text-gray-400 font-normal">opcional</span>
            </label>
            <input
              type="date"
              {...register('expiresAt')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-3">
            <input
              id="isActive"
              type="checkbox"
              {...register('isActive')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">
              Cupom ativo
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── DeleteConfirmDialog ───────────────────────────────────────────────────────

function DeleteConfirmDialog({
  coupon,
  onClose,
  onConfirm,
  isDeleting,
}: {
  coupon: Coupon
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">Excluir cupom</h2>
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir o cupom{' '}
          <span className="font-semibold">{coupon.code}</span>? Esta ação não pode ser
          desfeita.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CouponsPage ──────────────────────────────────────────────────────────────

export function CouponsPage() {
  const { data: coupons = [], isLoading, isError } = useCoupons()
  const deleteMutation = useDeleteCoupon()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageCoupons = coupons.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openCreate() {
    setEditingCoupon(null)
    setModalOpen(true)
  }

  function openEdit(coupon: Coupon) {
    setEditingCoupon(coupon)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingCoupon(null)
  }

  async function handleDelete() {
    if (!deletingCoupon) return
    try {
      await deleteMutation.mutateAsync(deletingCoupon.id)
      showToast('Cupom excluído com sucesso!', 'success')
    } catch {
      showToast('Erro ao excluir cupom.', 'error')
    } finally {
      setDeletingCoupon(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cupons de Desconto</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Gerencie os cupons disponíveis para seus clientes
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Novo Cupom
          </button>
        </div>
      </header>

      <main className="px-6 py-6 space-y-4">
        {/* Premium banner */}
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Star size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Funcionalidade Plano Premium</span> — cupons de
            desconto estao disponíveis a partir do plano Premium.
          </p>
        </div>

        {/* Table */}
        {isLoading && (
          <p className="text-center text-sm text-gray-500 py-12">Carregando cupons...</p>
        )}

        {isError && (
          <p className="text-center text-sm text-red-600 py-12">Erro ao carregar cupons.</p>
        )}

        {!isLoading && !isError && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {coupons.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <p className="text-gray-400 text-sm">Nenhum cupom cadastrado ainda.</p>
                <button
                  onClick={openCreate}
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  Criar primeiro cupom
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Valor</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Mín. Pedido</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Limite</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Usados</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Economia</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Validade</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageCoupons.map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                          {coupon.code}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              coupon.type === 'PERCENTAGE'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {coupon.type === 'PERCENTAGE' ? 'Percentual' : 'Valor Fixo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {coupon.type === 'PERCENTAGE'
                            ? `${coupon.value}%`
                            : formatCurrency(coupon.value)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {coupon.minOrder ? formatCurrency(coupon.minOrder) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {coupon.maxUses ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{coupon.usedCount}</td>
                        <td className="px-4 py-3 font-medium text-emerald-600">
                          {formatCurrency(coupon.totalSavings ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatDate(coupon.expiresAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              coupon.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {coupon.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(coupon)}
                              title="Editar"
                              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => setDeletingCoupon(coupon)}
                              title="Excluir"
                              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!isLoading && !isError && coupons.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, coupons.length)} de {coupons.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
              <span className="text-gray-600">
                Página <span className="font-semibold text-gray-900">{currentPage}</span> de{' '}
                {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Próxima
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Coupon Modal */}
      {modalOpen && (
        <CouponModal
          coupon={editingCoupon}
          onClose={closeModal}
          onToast={showToast}
        />
      )}

      {/* Delete Confirm */}
      {deletingCoupon && (
        <DeleteConfirmDialog
          coupon={deletingCoupon}
          onClose={() => setDeletingCoupon(null)}
          onConfirm={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
