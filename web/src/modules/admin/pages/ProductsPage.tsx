import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ArrowUpDown, Plus, Copy, Tag } from 'lucide-react'

import { useCategories, useUpdateCategory } from '../hooks/useCategories'
import { useDeleteProduct, useProducts, useUpdateProduct } from '../hooks/useProducts'
import type { Category } from '../services/categories.service'
import type { Product } from '../services/products.service'

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

function CategorySection({
  category,
  products,
  onToggleProduct,
  onDeleteProduct,
  isUpdating,
}: {
  category: Category
  products: Product[]
  onToggleProduct: (p: Product) => void
  onDeleteProduct: (p: Product) => void
  isUpdating: boolean
}) {
  const navigate = useNavigate()
  const updateCategory = useUpdateCategory()

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Category header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span className="font-semibold text-gray-900 text-sm">{category.name}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Disponível</span>
          <ProductToggle
            checked={category.isActive}
            onChange={() =>
              updateCategory.mutate({ id: category.id, dto: { isActive: !category.isActive } })
            }
            disabled={updateCategory.isPending}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
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
          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Ordenar produtos
          </button>
        </div>
      </div>

      {/* Products list */}
      <div className="divide-y divide-gray-50">
        {products.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-400">Nenhum produto nesta categoria.</p>
        )}
        {products.map((product) => (
          <div key={product.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
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
                <button className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                  <Tag className="w-3 h-3" />
                  Adicionar desconto
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
                  onClick={() => onDeleteProduct(product)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Duplicar
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
        ))}
      </div>
    </div>
  )
}

// ─── ProductsPage ─────────────────────────────────────────────────────────────

export function ProductsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeCategoryPill, setActiveCategoryPill] = useState<string>('todos')

  const { data: categories } = useCategories()
  const { data: allProducts, isLoading, isError } = useProducts({})
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()

  function handleToggleActive(product: Product) {
    updateMutation.mutate({ id: product.id, dto: { isActive: !product.isActive } })
  }

  function handleDelete(product: Product) {
    if (!window.confirm(`Excluir o produto "${product.name}"?`)) return
    deleteMutation.mutate(product.id)
  }

  // Filter by search
  const filteredProducts = (allProducts ?? []).filter((p) =>
    search.trim() ? p.name.toLowerCase().includes(search.toLowerCase()) : true
  )

  // Determine which categories to show
  const categoriesToShow = activeCategoryPill === 'todos'
    ? (categories ?? [])
    : (categories ?? []).filter((c) => c.id === activeCategoryPill)

  // Products by category
  function getProductsByCategory(categoryId: string) {
    return filteredProducts.filter((p) => p.categoryId === categoryId)
  }

  // Pills count
  function countForCategory(categoryId: string) {
    return filteredProducts.filter((p) => p.categoryId === categoryId).length
  }

  const totalShown = filteredProducts.filter((p) =>
    activeCategoryPill === 'todos' ? true : p.categoryId === activeCategoryPill
  ).length

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/produtos/new')}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Produto
          </button>
          <button
            onClick={() => navigate('/admin/categorias')}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova categoria
          </button>
        </div>
      </div>

      {/* Category pills */}
      {(categories ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategoryPill('todos')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategoryPill === 'todos'
                  ? 'bg-red-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Todos
            </button>
            {(categories ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategoryPill(c.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategoryPill === c.id
                    ? 'bg-red-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {c.name}{' '}
                <span className={activeCategoryPill === c.id ? 'text-red-100' : 'text-gray-400'}>
                  {countForCategory(c.id)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{totalShown} itens</span>
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar categorias
            </button>
          </div>
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
          {categoriesToShow.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              products={getProductsByCategory(cat.id)}
              onToggleProduct={handleToggleActive}
              onDeleteProduct={handleDelete}
              isUpdating={updateMutation.isPending}
            />
          ))}
          {categoriesToShow.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Nenhuma categoria encontrada.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
