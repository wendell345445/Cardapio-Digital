import { useState } from 'react'

import { useCashFlowSummary, useCurrentCashFlow } from '../hooks/useCashFlow'

import { CloseCashFlowModal, OpenCashFlowModal } from './CashFlowModals'

export function CashFlowToggle() {
  const { data: currentCashFlow, isLoading } = useCurrentCashFlow()
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)

  const isOpen = currentCashFlow?.status === 'OPEN'
  const { data: summaryResponse } = useCashFlowSummary(isOpen ? currentCashFlow?.id : undefined)
  const expectedBalance = summaryResponse?.summary?.expectedCash ?? 0

  function handleToggle() {
    if (isOpen) {
      setShowCloseModal(true)
    } else {
      setShowOpenModal(true)
    }
  }

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className="flex items-center gap-2 w-full group"
        aria-label={isOpen ? 'Fechar caixa' : 'Abrir caixa'}
      >
        <div
          className={`relative w-9 h-5 rounded-full transition-colors ${
            isOpen ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              isOpen ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>
        <span
          className={`text-xs font-medium ${isOpen ? 'text-green-600' : 'text-gray-400'}`}
        >
          {isOpen ? 'Caixa aberto' : 'Caixa fechado'}
        </span>
      </button>

      {showOpenModal && <OpenCashFlowModal onClose={() => setShowOpenModal(false)} />}
      {showCloseModal && currentCashFlow && (
        <CloseCashFlowModal
          cashFlowId={currentCashFlow.id}
          expectedBalance={expectedBalance}
          onClose={() => setShowCloseModal(false)}
        />
      )}
    </>
  )
}
