/**
 * Serializa operações por loja (in-process). Cada chamada encadeia na promise
 * anterior daquela storeId — garante que dois processamentos concorrentes da mesma
 * loja não corram (ex: dois eventos iFood no mesmo poll, ou dois imports).
 * Implementado com Map<storeId, Promise>. Escopo é por instância do processo.
 */
const storeLocks = new Map<string, Promise<unknown>>()

export async function withStoreLock<T>(storeId: string, fn: () => Promise<T>): Promise<T> {
  const prev = storeLocks.get(storeId) ?? Promise.resolve()
  const next = prev.then(() => fn(), () => fn())
  storeLocks.set(storeId, next)
  try {
    return (await next) as T
  } finally {
    if (storeLocks.get(storeId) === next) {
      storeLocks.delete(storeId)
    }
  }
}
