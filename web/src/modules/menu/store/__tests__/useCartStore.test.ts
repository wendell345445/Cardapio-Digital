import { describe, it, expect, beforeEach } from 'vitest'

import { useCartStore } from '../useCartStore'

const baseItem = {
  productId: '11111111-1111-4111-8111-111111111111',
  productName: 'Pizza Calabresa',
  additionals: [],
  quantity: 1,
  unitPrice: 30,
}

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], storeSlug: null, tableNumber: null })
  })

  it('addItem atribui um id uuid e mantém demais campos', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBeDefined()
    expect(items[0].productName).toBe('Pizza Calabresa')
    expect(items[0].quantity).toBe(1)
  })

  it('updateQty altera quantidade de um item específico', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().updateQty(id, 3)
    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })

  it('updateQty com 0 remove o item do carrinho', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().updateQty(id, 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('updateQty com valor negativo remove o item', () => {
    useCartStore.getState().addItem({ ...baseItem })
    const id = useCartStore.getState().items[0].id
    useCartStore.getState().updateQty(id, -1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('removeItem exclui apenas o item indicado', () => {
    useCartStore.getState().addItem({ ...baseItem })
    useCartStore.getState().addItem({
      ...baseItem,
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Pizza Marguerita',
    })
    const firstId = useCartStore.getState().items[0].id
    useCartStore.getState().removeItem(firstId)
    const remaining = useCartStore.getState().items
    expect(remaining).toHaveLength(1)
    expect(remaining[0].productName).toBe('Pizza Marguerita')
  })

  it('subtotal considera preço base + adicionais × quantidade', () => {
    useCartStore.getState().addItem({
      ...baseItem,
      unitPrice: 30,
      additionals: [{ id: 'a1', name: 'Borda', price: 5 }],
      quantity: 2,
    })
    expect(useCartStore.getState().subtotal()).toBe(70) // (30 + 5) * 2
  })

  it('subtotal usa variationPrice quando presente, ignorando unitPrice', () => {
    useCartStore.getState().addItem({
      ...baseItem,
      unitPrice: 30,
      variationId: '33333333-3333-4333-8333-333333333333',
      variationName: 'Grande',
      variationPrice: 50,
      quantity: 1,
    })
    expect(useCartStore.getState().subtotal()).toBe(50)
  })

  // O carrinho é compartilhado por origem (uma chave no localStorage), então qualquer
  // troca de contexto (loja, mesa, sair da mesa) tem que zerar items pra não vazar
  // pedido entre cardápio online e mesas — bug observado em produção.
  describe('isolamento por contexto', () => {
    it('setStore com slug diferente zera items e sessão de mesa', () => {
      useCartStore.setState({ storeSlug: 'loja-a' })
      useCartStore.getState().addItem({ ...baseItem })
      useCartStore.getState().setTableSession({ tableNumber: 5, token: 'tok-a', deviceName: 'João' })

      useCartStore.getState().setStore('loja-b')

      const s = useCartStore.getState()
      expect(s.storeSlug).toBe('loja-b')
      expect(s.items).toHaveLength(0)
      expect(s.tableNumber).toBeNull()
      expect(s.tableSessionToken).toBeNull()
      expect(s.deviceName).toBeNull()
    })

    it('setStore com mesmo slug preserva items', () => {
      useCartStore.setState({ storeSlug: 'loja-a' })
      useCartStore.getState().addItem({ ...baseItem })

      useCartStore.getState().setStore('loja-a')

      expect(useCartStore.getState().items).toHaveLength(1)
    })

    it('setTableSession nova zera items do contexto anterior', () => {
      useCartStore.getState().addItem({ ...baseItem })

      useCartStore.getState().setTableSession({ tableNumber: 1, token: 'tok-1', deviceName: null })

      expect(useCartStore.getState().items).toHaveLength(0)
      expect(useCartStore.getState().tableNumber).toBe(1)
    })

    it('setTableSession com mesmo token preserva items', () => {
      useCartStore.getState().setTableSession({ tableNumber: 1, token: 'tok-1', deviceName: null })
      useCartStore.getState().addItem({ ...baseItem })

      useCartStore.getState().setTableSession({ tableNumber: 1, token: 'tok-1', deviceName: 'Ana' })

      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().deviceName).toBe('Ana')
    })

    it('clearTableSession zera items junto com a sessão', () => {
      useCartStore.getState().setTableSession({ tableNumber: 1, token: 'tok-1', deviceName: null })
      useCartStore.getState().addItem({ ...baseItem })

      useCartStore.getState().clearTableSession()

      const s = useCartStore.getState()
      expect(s.items).toHaveLength(0)
      expect(s.tableNumber).toBeNull()
      expect(s.tableSessionToken).toBeNull()
    })
  })
})
