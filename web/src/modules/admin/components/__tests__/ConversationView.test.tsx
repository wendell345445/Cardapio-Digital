import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── TASK-115: ConversationView Tests ────────────────────────────────────────

vi.mock('../../hooks/useConversations', () => ({
  useConversation: vi.fn(),
  useTakeoverConversation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useReleaseConversation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useSendAgentMessage: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

import * as hooks from '../../hooks/useConversations'
import { ConversationView } from '../ConversationView'

const mockConversation = {
  id: 'conv-1',
  storeId: 'store-1',
  customerPhone: '11999999999',
  customerName: 'João Silva',
  isHumanMode: false,
  humanAgentId: null,
  createdAt: '2026-04-07T10:00:00Z',
  updatedAt: '2026-04-07T10:05:00Z',
  messages: [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'CUSTOMER' as const,
      content: 'Olá, quero fazer um pedido!',
      createdAt: '2026-04-07T10:00:00Z',
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      role: 'AI' as const,
      content: 'Olá! Seja bem-vindo! Como posso ajudar?',
      createdAt: '2026-04-07T10:01:00Z',
    },
  ],
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(hooks.useConversation).mockReturnValue({
    data: mockConversation,
    isLoading: false,
  } as any)
})

describe('ConversationView', () => {
  it('exibe o nome do cliente no header', () => {
    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.getByText('João Silva')).toBeDefined()
  })

  it('exibe o número do cliente', () => {
    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.getByText('11999999999')).toBeDefined()
  })

  it('mostra mensagens do cliente e da IA', () => {
    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.getByText('Olá, quero fazer um pedido!')).toBeDefined()
    expect(screen.getByText('Olá! Seja bem-vindo! Como posso ajudar?')).toBeDefined()
  })

  it('mostra banner verde (modo IA) quando isHumanMode=false', () => {
    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.getByText(/Modo IA\/Bot/)).toBeDefined()
  })

  it('mostra botão "Assumir Atendimento" quando isHumanMode=false', () => {
    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.getAllByText('Assumir Atendimento').length).toBeGreaterThan(0)
  })

  it('NÃO exibe input de envio quando isHumanMode=false', () => {
    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.queryByPlaceholderText('Digite uma mensagem...')).toBeNull()
  })

  it('exibe banner azul e input quando isHumanMode=true', () => {
    vi.mocked(hooks.useConversation).mockReturnValue({
      data: { ...mockConversation, isHumanMode: true },
      isLoading: false,
    } as any)

    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.getByText(/Modo Humano/)).toBeDefined()
    expect(screen.getByPlaceholderText('Digite uma mensagem...')).toBeDefined()
    expect(screen.getByText('Devolver para IA/Bot')).toBeDefined()
  })

  it('chama takeover.mutate ao clicar em "Assumir"', () => {
    const mutateFn = vi.fn()
    vi.mocked(hooks.useTakeoverConversation).mockReturnValue({ mutate: mutateFn, isPending: false } as any)

    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    fireEvent.click(screen.getAllByText('Assumir Atendimento')[0])
    expect(mutateFn).toHaveBeenCalledWith('conv-1')
  })

  it('chama onBack ao clicar na seta de voltar', () => {
    const onBack = vi.fn()
    render(<ConversationView conversationId="conv-1" onBack={onBack} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: '' })) // ArrowLeft button
    expect(onBack).toHaveBeenCalled()
  })

  it('exibe spinner de loading enquanto carrega', () => {
    vi.mocked(hooks.useConversation).mockReturnValue({ data: undefined, isLoading: true } as any)
    const { container } = render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(container.querySelector('.animate-spin')).toBeDefined()
  })

  it('mensagem SYSTEM aparece centralizada sem bubble lateral', () => {
    vi.mocked(hooks.useConversation).mockReturnValue({
      data: {
        ...mockConversation,
        messages: [
          { id: 'sys-1', conversationId: 'conv-1', role: 'SYSTEM', content: 'Atendente assumiu.', createdAt: '2026-04-07T10:00:00Z' },
        ],
      },
      isLoading: false,
    } as any)

    render(<ConversationView conversationId="conv-1" onBack={vi.fn()} />, { wrapper })
    expect(screen.getByText('Atendente assumiu.')).toBeDefined()
  })
})
