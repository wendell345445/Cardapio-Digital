import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useNewOrdersCount } from '../useNewOrdersCount'

// ─── Mocks ───────────────────────────────────────────────────────────────────
type SocketHandler = (...args: unknown[]) => void

const listeners = new Map<string, Set<SocketHandler>>()
const mockSocket = {
  on: vi.fn((event: string, handler: SocketHandler) => {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)!.add(handler)
  }),
  off: vi.fn((event: string, handler: SocketHandler) => {
    listeners.get(event)?.delete(handler)
  }),
  emit: (event: string, ...args: unknown[]) => {
    listeners.get(event)?.forEach((h) => h(...args))
  },
}

vi.mock('@/shared/hooks/useSocket', () => ({
  useSocket: () => mockSocket,
}))

vi.mock('@/modules/auth/store/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: { storeId: string } }) => unknown) =>
    selector({ user: { storeId: 'store-1' } }),
}))

const fetchOrdersMock = vi.fn()
vi.mock('../../services/orders.service', () => ({
  fetchOrders: (...args: unknown[]) => fetchOrdersMock(...args),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

beforeEach(() => {
  listeners.clear()
  fetchOrdersMock.mockReset()
  mockSocket.on.mockClear()
  mockSocket.off.mockClear()
})

describe('useNewOrdersCount', () => {
  it('retorna count baseado em orders.length', async () => {
    fetchOrdersMock.mockResolvedValue({
      orders: [{ id: '1' }, { id: '2' }, { id: '3' }],
    })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useNewOrdersCount(), { wrapper })

    await waitFor(() => expect(result.current.count).toBe(3))
    expect(fetchOrdersMock).toHaveBeenCalledWith({
      status: 'PENDING,WAITING_PAYMENT_PROOF,WAITING_CONFIRMATION',
      limit: 100,
    })
  })

  it('registra listeners para order:new e order:status', () => {
    fetchOrdersMock.mockResolvedValue({ orders: [] })
    const { wrapper } = makeWrapper()

    renderHook(() => useNewOrdersCount(), { wrapper })

    expect(mockSocket.on).toHaveBeenCalledWith('order:new', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('order:status', expect.any(Function))
  })

  it('refetcha e atualiza count quando recebe order:new', async () => {
    fetchOrdersMock.mockResolvedValueOnce({ orders: [{ id: '1' }] })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useNewOrdersCount(), { wrapper })
    await waitFor(() => expect(result.current.count).toBe(1))

    fetchOrdersMock.mockResolvedValueOnce({ orders: [{ id: '1' }, { id: '2' }] })
    act(() => {
      mockSocket.emit('order:new', { id: '2', status: 'PENDING' })
    })

    await waitFor(() => expect(result.current.count).toBe(2))
    expect(fetchOrdersMock).toHaveBeenCalledTimes(2)
  })

  it('refetcha quando recebe order:status (pedido sai do grupo de novos)', async () => {
    fetchOrdersMock.mockResolvedValueOnce({ orders: [{ id: '1' }, { id: '2' }] })
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useNewOrdersCount(), { wrapper })
    await waitFor(() => expect(result.current.count).toBe(2))

    fetchOrdersMock.mockResolvedValueOnce({ orders: [{ id: '2' }] })
    act(() => {
      mockSocket.emit('order:status', { orderId: '1', status: 'CONFIRMED' })
    })

    await waitFor(() => expect(result.current.count).toBe(1))
  })

  it('desregistra listeners no unmount', () => {
    fetchOrdersMock.mockResolvedValue({ orders: [] })
    const { wrapper } = makeWrapper()

    const { unmount } = renderHook(() => useNewOrdersCount(), { wrapper })
    unmount()

    expect(mockSocket.off).toHaveBeenCalledWith('order:new', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('order:status', expect.any(Function))
  })
})
