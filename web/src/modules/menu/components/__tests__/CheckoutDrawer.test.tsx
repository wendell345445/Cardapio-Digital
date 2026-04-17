import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../hooks/useMenu', () => ({
  useMenu: vi.fn(() => ({
    data: {
      store: {
        name: 'Loja Teste',
        pixKey: 'loja@test.com',
        pixKeyType: 'EMAIL',
        allowPickup: true,
        allowCreditCard: false,
        allowCashOnDelivery: true,
      },
      categories: [],
    },
    isLoading: false,
  })),
}))

vi.mock('../../hooks/useOrder', () => ({
  useCreateOrder: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  })),
}))

vi.mock('@/hooks/useStoreSlug', () => ({
  useStoreSlug: vi.fn(() => 'loja-teste'),
}))

vi.mock('@/modules/auth/hooks/useViaCep', () => ({
  useViaCep: vi.fn(() => ({
    lookup: vi.fn(),
    isLoading: false,
    error: null,
  })),
}))

import { CheckoutDrawer } from '../CheckoutDrawer'
import { useCartStore } from '../../store/useCartStore'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const pizza = {
  productId: '11111111-1111-4111-8111-111111111111',
  productName: 'Pizza Calabresa',
  additionals: [],
  quantity: 2,
  unitPrice: 30,
}
const esfiha = {
  productId: '22222222-2222-4222-8222-222222222222',
  productName: 'Esfiha de Carne',
  additionals: [],
  quantity: 1,
  unitPrice: 8,
}

describe('CheckoutDrawer — carrinho', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], storeSlug: 'loja-teste', tableNumber: null })
  })

  // A lista de itens começa expandida por padrão, com botão chevron pra
  // recolher/expandir. O botão "N item(s) no pedido" faz toggle.

  it('renderiza os itens do carrinho com nome e subtotal da linha', () => {
    useCartStore.getState().addItem(pizza)
    useCartStore.getState().addItem(esfiha)

    render(<CheckoutDrawer open onClose={vi.fn()} />, { wrapper })

    expect(screen.getByText('Pizza Calabresa')).toBeDefined()
    expect(screen.getByText('Esfiha de Carne')).toBeDefined()
    // pizza: 2 × R$ 30 = R$ 60, esfiha: 1 × R$ 8 = R$ 8
    expect(screen.getAllByText(/R\$\s*60,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$\s*8,00/).length).toBeGreaterThan(0)
  })

  it('mostra total de quantidades no header, não a contagem de linhas', () => {
    useCartStore.getState().addItem(pizza) // qty 2
    useCartStore.getState().addItem(esfiha) // qty 1

    render(<CheckoutDrawer open onClose={vi.fn()} />, { wrapper })

    expect(screen.getByText('3 item(s) no pedido')).toBeDefined()
  })

  it('botão + aumenta a quantidade do item', () => {
    useCartStore.getState().addItem(pizza)
    const id = useCartStore.getState().items[0].id

    render(<CheckoutDrawer open onClose={vi.fn()} />, { wrapper })

    const li = screen.getByTestId(`cart-item-${id}`)
    fireEvent.click(within(li).getByLabelText('Aumentar quantidade'))

    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })

  it('botão - diminui a quantidade e remove ao chegar em zero', () => {
    useCartStore.getState().addItem({ ...pizza, quantity: 1 })
    const id = useCartStore.getState().items[0].id

    render(<CheckoutDrawer open onClose={vi.fn()} />, { wrapper })

    const li = screen.getByTestId(`cart-item-${id}`)
    fireEvent.click(within(li).getByLabelText('Diminuir quantidade'))

    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('botão de lixeira exclui o item específico do carrinho', () => {
    useCartStore.getState().addItem(pizza)
    useCartStore.getState().addItem(esfiha)

    render(<CheckoutDrawer open onClose={vi.fn()} />, { wrapper })

    fireEvent.click(screen.getByLabelText('Remover Pizza Calabresa'))

    const remaining = useCartStore.getState().items
    expect(remaining).toHaveLength(1)
    expect(remaining[0].productName).toBe('Esfiha de Carne')
  })

  it('oculta seção de itens quando carrinho está vazio', () => {
    render(<CheckoutDrawer open onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Itens do pedido')).toBeNull()
  })
})
