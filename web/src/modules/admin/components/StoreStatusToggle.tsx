import { useStore, useUpdateStoreStatus } from '../hooks/useStore'

export function StoreStatusToggle() {
  const { data: store } = useStore()
  const updateStatus = useUpdateStoreStatus()

  const isOpen = store?.manualOpen === true

  function handleToggle() {
    updateStatus.mutate(
      { manualOpen: !isOpen },
      {
        onError: () => {
          // optimistic update reverted by react-query on error
        },
      }
    )
  }

  return (
    <button
      onClick={handleToggle}
      disabled={updateStatus.isPending}
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
  )
}
