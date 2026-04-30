import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/hooks/useStoreSlug', () => ({
  useStoreSlug: vi.fn(() => 'loja-teste'),
}))

const useMenuMock = vi.fn()
vi.mock('../../hooks/useMenu', () => ({
  useMenu: (...args: unknown[]) => useMenuMock(...args),
}))

import { ItemPage } from '../ItemPage'
import { useCartStore } from '../../store/useCartStore'

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111'

const baseProduct = {
  id: PRODUCT_ID,
  name: 'Pizza Calabresa',
  description: 'Pizza com calabresa',
  basePrice: 30,
  promoPrice: null,
  imageUrl: null,
  isActive: true,
  variations: [],
  additionals: [],
}

function buildMenuData(storeStatus: 'open' | 'closed' | 'suspended') {
  return {
    store: {
      name: 'Loja Teste',
      slug: 'loja-teste',
      logo: null,
      storeStatus,
      businessHours: [],
    },
    categories: [
      {
        id: 'cat-1',
        name: 'Pizzas',
        isActive: true,
        products: [baseProduct],
      },
    ],
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/produto/${PRODUCT_ID}`]}>
        <Routes>
          <Route path="/produto/:productId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ItemPage — bloqueio de loja fechada', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], storeSlug: 'loja-teste', tableNumber: null })
    navigateMock.mockReset()
    useMenuMock.mockReset()
  })

  it('com loja aberta, clicar em "Adicionar" insere o item no carrinho', () => {
    useMenuMock.mockReturnValue({ data: buildMenuData('open'), isLoading: false })

    render(<ItemPage />, { wrapper })

    const addBtn = screen.getByRole('button', { name: /Adicionar/ })
    expect((addBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(addBtn)

    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].productId).toBe(PRODUCT_ID)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('com loja fechada, clicar em "Adicionar" não insere no carrinho e mostra aviso', () => {
    useMenuMock.mockReturnValue({ data: buildMenuData('closed'), isLoading: false })

    render(<ItemPage />, { wrapper })

    // O aviso ainda não apareceu antes do clique.
    expect(screen.queryByRole('alert')).toBeNull()

    const addBtn = screen.getByRole('button', { name: /Adicionar/ })
    fireEvent.click(addBtn)

    expect(useCartStore.getState().items).toHaveLength(0)
    expect(navigateMock).not.toHaveBeenCalled()

    const warning = screen.getByRole('alert')
    expect(warning.textContent).toMatch(/Loja fechada no momento/)
  })
})
