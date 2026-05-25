import { create } from 'zustand'

// ─── PDV: carrinho do pedido criado pelo admin (telefone/balcão) ─────────────
// Store separada do carrinho do cliente (menu/store/useCartStore) de propósito:
//   - NÃO persiste (cada pedido do balcão é efêmero; reset ao finalizar);
//   - não carrega sessão de mesa/QR do cliente — a mesa aqui é só um tableId
//     selecionado pelo atendente, o backend resolve a TableSession.
// Os tipos de item espelham o cardápio pra reaproveitar o cálculo de subtotal.

export interface AdminCartItemAddon {
  id: string
  name: string
  price: number
}

export interface AdminCartItem {
  /** uuid local (chave de lista + edição) */
  id: string
  productId: string
  productName: string
  imageUrl?: string
  variationId?: string
  variationName?: string
  addons: AdminCartItemAddon[]
  quantity: number
  /** preço unitário já resolvido (base ou variação) — sem adicionais */
  unitPrice: number
  notes?: string
}

interface AdminCartStore {
  items: AdminCartItem[]
  addItem: (item: Omit<AdminCartItem, 'id'>) => string
  updateQty: (id: string, quantity: number) => void
  updateNotes: (id: string, notes: string) => void
  removeItem: (id: string) => void
  clear: () => void
  subtotal: () => number
}

export const useAdminCartStore = create<AdminCartStore>((set, get) => ({
  items: [],
  addItem: (item) => {
    const id = crypto.randomUUID()
    set((s) => ({ items: [...s.items, { ...item, id }] }))
    return id
  },
  updateQty: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id)
      return
    }
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, quantity } : i)) }))
  },
  updateNotes: (id, notes) => {
    const trimmed = notes.trim()
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, notes: trimmed || undefined } : i)),
    }))
  },
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
  subtotal: () =>
    get().items.reduce((acc, item) => {
      const adds = item.addons.reduce((s, a) => s + a.price, 0)
      return acc + (item.unitPrice + adds) * item.quantity
    }, 0),
}))
