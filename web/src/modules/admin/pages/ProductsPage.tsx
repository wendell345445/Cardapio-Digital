import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search,
  ArrowUpDown,
  Plus,
  Copy,
  Tag,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'


import { useCategories, useUpdateCategory } from '../hooks/useCategories'
import {
  useDeleteProduct,
  useDuplicateProduct,
  useProducts,
  useUpdateProduct,
} from '../hooks/useProducts'
import type { Category } from '../services/categories.service'
import type { Product } from '../services/products.service'
import { useCoupons } from '../hooks/useCoupons'
import { ProductPromoModal } from '../components/ProductPromoModal'
import { SortModal, type SortDirection } from '../components/SortModal'

import { ReauthModal } from '@/modules/auth/components/ReauthModal'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ProductToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

const PAGE_SIZE = 10

function CategorySection({
  category,
  products,
  activePromoProductIds,
  expanded,
  onToggleExpanded,
  onToggleProduct,
  onDeleteProduct,
  onDuplicateProduct,
  onAddPromo,
  onReorder,
  isUpdating,
  isDuplicating,
}: {
  category: Category
  products: Product[]
  activePromoProductIds: Set<string>
  expanded: boolean
  onToggleExpanded: () => void
  onToggleProduct: (p: Product) => void
  onDeleteProduct: (p: Product) => void
  onDuplicateProduct: (p: Product) => void
  onAddPromo: (p: Product) => void
  onReorder: (category: Category, products: Product[]) => void
  isUpdating: boolean
  isDuplicating: boolean
}) {
  const navigate = useNavigate()
  const updateCategory = useUpdateCategory()
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [totalPages, page])

  const pageProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Category header */}
      <div
        onClick={onToggleExpanded}
        className={`flex items-center gap-3 px-5 py-3 bg-gray-50 cursor-pointer select-none ${expanded ? 'border-b border-gray-100' : ''}`}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <span className="font-semibold text-gray-900 text-sm">{category.name}</span>
        <span className="text-xs text-gray-400">
          ({products.length} {products.length === 1 ? 'produto' : 'produtos'})
        </span>
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-gray-500">Disponível</span>
          <ProductToggle
            checked={category.isActive}
            onChange={() =>
              updateCategory.mutate({ id: category.id, dto: { isActive: !category.isActive } })
            }
            disabled={updateCategory.isPending}
          />
        </div>
        <div
          className="ml-auto flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => navigate(`/admin/produtos/new?categoryId=${category.id}`)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo produto
          </button>
          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <Copy className="w-3.5 h-3.5" />
            Copiar produto
          </button>
          <button
            onClick={() => onReorder(category, products)}
            disabled={products.length < 2}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Ordenar produtos
          </button>
        </div>
      </div>

      {/* Products list (2 per row, 5 rows = 10 por página) */}
      {expanded && (
        <>
          {products.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Nenhum produto nesta categoria.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2">
              {pageProducts.map((product, idx) => {
                const isLastRow = idx >= pageProducts.length - (pageProducts.length % 2 === 0 ? 2 : 1)
                const isRightCol = idx % 2 === 1
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-4 px-5 py-3 hover:bg-gray-50 ${
                      !isLastRow ? 'border-b border-gray-50' : ''
                    } ${isRightCol ? 'md:border-l md:border-gray-50' : ''}`}
                  >
                    {/* Thumbnail */}
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xs flex-shrink-0">
                        📷
                      </div>
                    )}

                    {/* Name + price */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-gray-600">
                          {product.basePrice != null ? fmt(product.basePrice) : '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAddPromo(product)}
                          className={`flex items-center gap-1 text-xs font-medium ${activePromoProductIds.has(product.id) ? 'text-green-600 hover:text-green-700' : 'text-blue-500 hover:text-blue-700'}`}
                        >
                          <Tag className="w-3 h-3" />
                          {activePromoProductIds.has(product.id)
                            ? 'Editar desconto'
                            : 'Adicionar desconto'}
                        </button>
                      </div>
                    </div>

                    {/* Toggle + Actions */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Disponível</span>
                        <ProductToggle
                          checked={product.isActive}
                          onChange={() => onToggleProduct(product)}
                          disabled={isUpdating}
                        />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/produtos/${product.id}/edit`)}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => onDuplicateProduct(product)}
                          disabled={isDuplicating}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => onDeleteProduct(product)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Excluir
                        </button>
                        <Link
                          to={`/admin/adicionais?productId=${product.id}`}
                          className="text-xs text-purple-500 hover:text-purple-700"
                        >
                          Adicionais
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── ProductsPage ─────────────────────────────────────────────────────────────

export function ProductsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [productForPromo, setProductForPromo] = useState<Product | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  function toggleCategoryExpanded(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const { data: categories } = useCategories()
  const { data: allProducts, isLoading, isError } = useProducts({})
  const { data: allCoupons } = useCoupons()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()
  const duplicateMutation = useDuplicateProduct()
  const updateCategoryMutation = useUpdateCategory()

  const [sortProductsOf, setSortProductsOf] = useState<
    { category: Category; products: Product[] } | null
  >(null)
  const [sortCategoriesOpen, setSortCategoriesOpen] = useState(false)

  function sortByName<T extends { name: string }>(items: T[], direction: SortDirection): T[] {
    const sorted = [...items].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    )
    return direction === 'asc' ? sorted : sorted.reverse()
  }

  // IDs de produtos com promoção ATIVA (productId setado, isActive, dentro da janela)
  const activePromoProductIds = new Set(
    (allCoupons ?? [])
      .filter((c) => {
        if (!c.productId || !c.isActive) return false
        const now = new Date()
        if (c.startsAt && new Date(c.startsAt) > now) return false
        if (c.expiresAt && new Date(c.expiresAt) <= now) return false
        return true
      })
      .map((c) => c.productId!)
  )

  function handleToggleActive(product: Product) {
    updateMutation.mutate({ id: product.id, dto: { isActive: !product.isActive } })
  }

  function handleDelete(product: Product) {
    setProductToDelete(product)
  }

  function handleDuplicate(product: Product) {
    duplicateMutation.mutate(product.id)
  }

  function confirmDelete() {
    if (!productToDelete) return
    deleteMutation.mutate(productToDelete.id)
    setProductToDelete(null)
  }

  // Filter by search
  const filteredProducts = (allProducts ?? []).filter((p) =>
    search.trim() ? p.name.toLowerCase().includes(search.toLowerCase()) : true
  )

  const categoriesToShow = categories ?? []

  function getProductsByCategory(categoryId: string) {
    return filteredProducts.filter((p) => p.categoryId === categoryId)
  }

  const totalShown = filteredProducts.length

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Pesquisar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* Title row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <button
          onClick={() => navigate('/admin/produtos/new')}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Produto
        </button>
      </div>

      {/* Summary + Ordenar categorias */}
      {(categories ?? []).length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{totalShown} itens</span>
          <button
            onClick={() => setSortCategoriesOpen(true)}
            disabled={(categories ?? []).length < 2}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Ordenar categorias
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading && (
        <p className="text-center text-sm text-gray-500 py-12">Carregando produtos...</p>
      )}
      {isError && (
        <p className="text-center text-sm text-red-600 py-12">Erro ao carregar produtos.</p>
      )}

      {!isLoading && !isError && (
        <div className="space-y-4">
          {categoriesToShow.map((cat) => {
            const hasSearchMatch =
              search.trim().length > 0 && getProductsByCategory(cat.id).length > 0
            const expanded = expandedCategories.has(cat.id) || hasSearchMatch
            return (
              <CategorySection
                key={cat.id}
                category={cat}
                products={getProductsByCategory(cat.id)}
                activePromoProductIds={activePromoProductIds}
                expanded={expanded}
                onToggleExpanded={() => toggleCategoryExpanded(cat.id)}
                onToggleProduct={handleToggleActive}
                onDeleteProduct={handleDelete}
                onDuplicateProduct={handleDuplicate}
                onAddPromo={(p) => setProductForPromo(p)}
                onReorder={(category, products) =>
                  setSortProductsOf({ category, products })
                }
                isUpdating={updateMutation.isPending}
                isDuplicating={duplicateMutation.isPending}
              />
            )
          })}
          {categoriesToShow.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Nenhuma categoria encontrada.</p>
            </div>
          )}
        </div>
      )}

      <ReauthModal
        open={!!productToDelete}
        title="Excluir produto"
        description={`Para excluir o produto "${productToDelete?.name ?? ''}", confirme sua senha.`}
        confirmLabel="Excluir"
        onCancel={() => setProductToDelete(null)}
        onConfirm={confirmDelete}
      />

      <ProductPromoModal
        product={productForPromo}
        onClose={() => setProductForPromo(null)}
      />

      <SortModal
        open={!!sortProductsOf}
        title={
          sortProductsOf
            ? `Ordenar produtos — ${sortProductsOf.category.name}`
            : 'Ordenar produtos'
        }
        onClose={() => setSortProductsOf(null)}
        onApply={async (direction) => {
          if (!sortProductsOf) return
          const sorted = sortByName(sortProductsOf.products, direction)
          await Promise.all(
            sorted.map((p, index) =>
              updateMutation.mutateAsync({ id: p.id, dto: { order: index } })
            )
          )
        }}
      />

      <SortModal
        open={sortCategoriesOpen}
        title="Ordenar categorias"
        onClose={() => setSortCategoriesOpen(false)}
        onApply={async (direction) => {
          const sorted = sortByName(categories ?? [], direction)
          await Promise.all(
            sorted.map((c, index) =>
              updateCategoryMutation.mutateAsync({ id: c.id, dto: { order: index } })
            )
          )
        }}
      />
    </div>
  )
}
