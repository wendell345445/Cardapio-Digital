import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { ManualCoordinatesModal } from '../ManualCoordinatesModal'

describe('ManualCoordinatesModal', () => {
  it('não renderiza quando isOpen=false', () => {
    render(<ManualCoordinatesModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByText(/Confirmar coordenadas/)).toBeNull()
  })

  it('renderiza com título e descrição padrão quando isOpen=true', () => {
    render(<ManualCoordinatesModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/Não conseguimos localizar/)).toBeInTheDocument()
    expect(screen.getByText(/Abra o Google Maps/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('-23.5505')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('-46.6333')).toBeInTheDocument()
  })

  it('aceita título e descrição customizados', () => {
    render(
      <ManualCoordinatesModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Localização da loja"
        description="Marque a posição exata."
      />
    )
    expect(screen.getByText('Localização da loja')).toBeInTheDocument()
    expect(screen.getByText('Marque a posição exata.')).toBeInTheDocument()
  })

  it('tutorial expandido revela passos do Google Maps', () => {
    render(<ManualCoordinatesModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByText(/maps.google.com/)).toBeNull()
    fireEvent.click(screen.getByText(/Como pegar as coordenadas/))
    expect(screen.getByText(/maps.google.com/)).toBeInTheDocument()
    expect(screen.getByText(/Toque e segure/)).toBeInTheDocument()
  })

  it('chama onConfirm com lat/lng numéricos válidos', () => {
    const onConfirm = vi.fn()
    render(<ManualCoordinatesModal isOpen onClose={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByPlaceholderText('-23.5505'), { target: { value: '-23.5505' } })
    fireEvent.change(screen.getByPlaceholderText('-46.6333'), { target: { value: '-46.6333' } })
    fireEvent.click(screen.getByText('Confirmar coordenadas'))

    expect(onConfirm).toHaveBeenCalledWith({ latitude: -23.5505, longitude: -46.6333 })
  })

  it('aceita vírgula como separador decimal (ex: "-23,5505")', () => {
    const onConfirm = vi.fn()
    render(<ManualCoordinatesModal isOpen onClose={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByPlaceholderText('-23.5505'), { target: { value: '-23,5505' } })
    fireEvent.change(screen.getByPlaceholderText('-46.6333'), { target: { value: '-46,6333' } })
    fireEvent.click(screen.getByText('Confirmar coordenadas'))

    expect(onConfirm).toHaveBeenCalledWith({ latitude: -23.5505, longitude: -46.6333 })
  })

  it('mostra erro quando latitude está fora do range', () => {
    const onConfirm = vi.fn()
    render(<ManualCoordinatesModal isOpen onClose={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByPlaceholderText('-23.5505'), { target: { value: '999' } })
    fireEvent.change(screen.getByPlaceholderText('-46.6333'), { target: { value: '-46.6333' } })
    fireEvent.click(screen.getByText('Confirmar coordenadas'))

    expect(screen.getByRole('alert')).toHaveTextContent(/Latitude inválida/)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('mostra erro quando longitude está fora do range', () => {
    const onConfirm = vi.fn()
    render(<ManualCoordinatesModal isOpen onClose={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByPlaceholderText('-23.5505'), { target: { value: '-23.5' } })
    fireEvent.change(screen.getByPlaceholderText('-46.6333'), { target: { value: '999' } })
    fireEvent.click(screen.getByText('Confirmar coordenadas'))

    expect(screen.getByRole('alert')).toHaveTextContent(/Longitude inválida/)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('mostra erro quando latitude não é número', () => {
    const onConfirm = vi.fn()
    render(<ManualCoordinatesModal isOpen onClose={vi.fn()} onConfirm={onConfirm} />)

    fireEvent.change(screen.getByPlaceholderText('-23.5505'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByPlaceholderText('-46.6333'), { target: { value: '-46.6' } })
    fireEvent.click(screen.getByText('Confirmar coordenadas'))

    expect(screen.getByRole('alert')).toHaveTextContent(/Latitude inválida/)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('chama onClose quando clica em Cancelar', () => {
    const onClose = vi.fn()
    render(<ManualCoordinatesModal isOpen onClose={onClose} onConfirm={vi.fn()} />)

    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chama onClose quando clica no X', () => {
    const onClose = vi.fn()
    render(<ManualCoordinatesModal isOpen onClose={onClose} onConfirm={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
