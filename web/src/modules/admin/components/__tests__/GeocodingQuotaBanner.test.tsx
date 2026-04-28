import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import * as hooks from '../../hooks/useGeocodingUsage'
import { GeocodingQuotaBanner } from '../GeocodingQuotaBanner'

import { useAuthStore } from '@/modules/auth/store/useAuthStore'

vi.mock('../../hooks/useGeocodingUsage', () => ({
  useGeocodingUsage: vi.fn(),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function setRole(role: 'OWNER' | 'ADMIN' | 'MOTOBOY' | 'CLIENT' | null) {
  useAuthStore.setState({
    user: role ? { id: 'u', role, storeId: 's' } : null,
    token: role ? 't' : null,
    isAuthenticated: !!role,
  })
}

beforeEach(() => {
  sessionStorage.clear()
  setRole('OWNER')
})

afterEach(() => {
  vi.clearAllMocks()
})

function setUsage(used: number, quota = 10000) {
  const percent = Math.min(100, Math.round((used / quota) * 100))
  vi.mocked(hooks.useGeocodingUsage).mockReturnValue({
    data: { used, quota, percent, month: '2026-04' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof hooks.useGeocodingUsage>)
}

describe('GeocodingQuotaBanner', () => {
  it('não renderiza quando usuário não é OWNER', () => {
    setRole('ADMIN')
    setUsage(9000)
    render(<GeocodingQuotaBanner />, { wrapper })
    expect(screen.queryByRole('button', { name: /dispensar/i })).toBeNull()
  })

  it('não renderiza quando percent < 70', () => {
    setUsage(6900)
    render(<GeocodingQuotaBanner />, { wrapper })
    expect(screen.queryByText(/Cota da Google Geocoding/)).toBeNull()
  })

  it('renderiza banner amarelo (warn) em 70%', () => {
    setUsage(7000)
    const { container } = render(<GeocodingQuotaBanner />, { wrapper })
    expect(screen.getByText(/Cota da Google Geocoding API em 70%/)).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('bg-yellow-400')
  })

  it('renderiza banner laranja (high) em 80%', () => {
    setUsage(8000)
    const { container } = render(<GeocodingQuotaBanner />, { wrapper })
    expect(screen.getByText(/Risco de falhas em horário de pico/)).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('bg-orange-500')
  })

  it('renderiza banner vermelho (critical) em 90%', () => {
    setUsage(9000)
    const { container } = render(<GeocodingQuotaBanner />, { wrapper })
    expect(screen.getByText(/Aumente o limite no Google Cloud/)).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('bg-red-600')
  })

  it('renderiza banner vermelho-escuro (exceeded) em 100%', () => {
    setUsage(10000)
    const { container } = render(<GeocodingQuotaBanner />, { wrapper })
    expect(screen.getByText(/Cota da Google Geocoding API esgotada/)).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('bg-red-700')
  })

  it('é dispensável e persiste a dispensa por sessão na faixa atual', () => {
    setUsage(7000)
    const { rerender } = render(<GeocodingQuotaBanner />, { wrapper })
    expect(screen.getByText(/em 70%/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /dispensar/i }))
    expect(screen.queryByText(/em 70%/)).toBeNull()

    // Re-renderizar (ex: navegação) — mesma faixa, continua dispensado
    rerender(<GeocodingQuotaBanner />)
    expect(screen.queryByText(/em 70%/)).toBeNull()
  })

  it('reaparece quando muda de faixa (70% → 80%) mesmo após dispensa', () => {
    setUsage(7000)
    const { rerender } = render(<GeocodingQuotaBanner />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /dispensar/i }))
    expect(screen.queryByText(/em 70%/)).toBeNull()

    setUsage(8000)
    rerender(<GeocodingQuotaBanner />)
    expect(screen.getByText(/em 80%/)).toBeInTheDocument()
  })
})
