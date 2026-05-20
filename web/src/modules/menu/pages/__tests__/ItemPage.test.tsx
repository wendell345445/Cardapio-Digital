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
  addons: [],
}

function buildMenuData(
  storeStatus: 'open' | 'closed' | 'suspended',
  opts: { nextOpenLabel?: string | null } = {},
) {
  return {
    store: {
      name: 'Loja Teste',
      slug: 'loja-teste',
      logo: null,
      storeStatus,
      nextOpenLabel: opts.nextOpenLabel ?? null,
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

  it('com loja aberta, clicar em "Adicionar" insere o item no carrinho e abre popup', () => {
    useMenuMock.mockReturnValue({ data: buildMenuData('open'), isLoading: false })

    render(<ItemPage />, { wrapper })

    const addBtn = screen.getByRole('button', { name: /Adicionar/ })
    expect((addBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(addBtn)

    // Item é persistido imediatamente — popup é só pra confirmação/ajuste.
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].productId).toBe(PRODUCT_ID)

    // "Continuar comprando" navega de volta pro cardápio.
    fireEvent.click(screen.getByRole('button', { name: /Continuar comprando/ }))
    expect(navigateMock).toHaveBeenCalledWith('/')
    // Item permanece no cart depois do click.
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('alterar qty no popup faz update no item já adicionado (não cria novo)', () => {
    useMenuMock.mockReturnValue({ data: buildMenuData('open'), isLoading: false })

    render(<ItemPage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(1)

    // Pega o controle de qty dentro do popup (label "Aumentar quantidade").
    const incBtns = screen.getAllByLabelText('Aumentar quantidade')
    // Há 2 controles na tela: o do footer (já não fica visível) e o do popup.
    // Pegamos o último (= o do popup).
    fireEvent.click(incBtns[incBtns.length - 1])

    // Continua sendo 1 item, com qty=2 — sem item duplicado.
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(2)
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

  it('quando há nextOpenLabel, o aviso anuncia a próxima abertura', () => {
    useMenuMock.mockReturnValue({
      data: buildMenuData('closed', { nextOpenLabel: 'amanhã às 18:00' }),
      isLoading: false,
    })

    render(<ItemPage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))

    const warning = screen.getByRole('alert')
    expect(warning.textContent).toMatch(/Loja fechada no momento/)
    expect(warning.textContent).toMatch(/Abrimos amanhã às 18:00/)
  })
})
