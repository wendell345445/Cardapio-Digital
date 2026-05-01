import { useSearchParams } from 'react-router-dom'

import { HistoricoPanel } from './mesas/HistoricoPanel'
import { MesasPanel } from './mesas/MesasPanel'
import { QRCodesPanel } from './mesas/QRCodesPanel'

type Tab = 'mesas' | 'qrcodes' | 'historico'

function isValidTab(v: string | null): v is Tab {
  return v === 'mesas' || v === 'qrcodes' || v === 'historico'
}

export function MesasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: Tab = isValidTab(rawTab) ? rawTab : 'mesas'

  function changeTab(next: Tab) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gestão de mesas e QR Codes do cardápio.
        </p>
      </div>

      {/* Segmented control */}
      <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
        {(
          [
            { id: 'mesas', label: 'Mesas' },
            { id: 'qrcodes', label: 'QR Codes' },
            { id: 'historico', label: 'Histórico' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => changeTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-red-500 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mesas' && <MesasPanel />}
      {tab === 'qrcodes' && <QRCodesPanel />}
      {tab === 'historico' && <HistoricoPanel />}
    </div>
  )
}
