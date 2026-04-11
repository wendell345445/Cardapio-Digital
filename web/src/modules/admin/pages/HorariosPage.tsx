import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'

import { useBusinessHours, useUpdateBusinessHours } from '../hooks/useStore'
import type { BusinessHour } from '../services/store.service'

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Default hours for each day of week (0=Sun..6=Sat)
const DEFAULT_HOURS: Omit<BusinessHour, 'id' | 'storeId'>[] = [0, 1, 2, 3, 4, 5, 6].map(
  (day) => ({
    dayOfWeek: day,
    openTime: '08:00',
    closeTime: '22:00',
    isClosed: day === 0, // Domingo fechado por padrão
  })
)

interface HourRow {
  id?: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

export function HorariosPage() {
  const { data: hours, isLoading, isError } = useBusinessHours()
  const updateHours = useUpdateBusinessHours()

  const [rows, setRows] = useState<HourRow[]>([])

  useEffect(() => {
    if (hours) {
      // Merge loaded hours with defaults for missing days
      const merged = DEFAULT_HOURS.map((def) => {
        const loaded = hours.find((h) => h.dayOfWeek === def.dayOfWeek)
        return loaded
          ? { id: loaded.id, dayOfWeek: loaded.dayOfWeek, openTime: loaded.openTime, closeTime: loaded.closeTime, isClosed: loaded.isClosed }
          : def
      })
      setRows(merged)
    }
  }, [hours])

  function updateRow(dayOfWeek: number, patch: Partial<HourRow>) {
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r))
    )
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateHours.mutate({ hours: rows as BusinessHour[] })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Horários de Funcionamento</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure os horários de abertura e fechamento para cada dia da semana.
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-500 py-8 text-center">Carregando horários...</p>}
      {isError && <p className="text-sm text-red-600 py-8 text-center">Erro ao carregar horários.</p>}

      {!isLoading && !isError && (
        <form onSubmit={handleSave}>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[160px_1fr_1fr_120px] px-5 py-3 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Dia</span>
              <span>Abertura</span>
              <span>Fechamento</span>
              <span className="text-center">Fechado</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {rows.map((row) => (
                <div
                  key={row.dayOfWeek}
                  className={`grid grid-cols-[160px_1fr_1fr_120px] items-center px-5 py-4 transition-colors ${
                    row.isClosed ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Day label */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {DAY_NAMES[row.dayOfWeek]}
                    </p>
                    <p className="text-xs text-gray-400">{DAY_SHORT[row.dayOfWeek]}</p>
                  </div>

                  {/* Open time */}
                  <input
                    type="time"
                    value={row.openTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { openTime: e.target.value })}
                    disabled={row.isClosed}
                    className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  />

                  {/* Close time */}
                  <input
                    type="time"
                    value={row.closeTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { closeTime: e.target.value })}
                    disabled={row.isClosed}
                    className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  />

                  {/* Closed toggle */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateRow(row.dayOfWeek, { isClosed: !row.isClosed })}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        row.isClosed ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          row.isClosed ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-xs ${row.isClosed ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {row.isClosed ? 'Fechado' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={updateHours.isPending}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {updateHours.isPending ? 'Salvando...' : 'Salvar horários'}
            </button>
          </div>

          {updateHours.isError && (
            <p className="text-sm text-red-600 text-right mt-2">Erro ao salvar. Tente novamente.</p>
          )}
          {updateHours.isSuccess && (
            <p className="text-sm text-green-600 text-right mt-2">Horários salvos com sucesso!</p>
          )}
        </form>
      )}
    </div>
  )
}
