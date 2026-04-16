import '@testing-library/jest-dom'

// Zustand `persist` exige um storage com setItem/getItem/removeItem.
// jsdom provê window.localStorage, mas quando o módulo da store é carregado
// antes do ambiente estar pronto o persist resolve um storage vazio.
// Garantimos aqui um shim idempotente para estabilizar os testes.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  const memory = new Map<string, string>()
  const storage: Storage = {
    get length() { return memory.size },
    clear: () => memory.clear(),
    getItem: (k) => memory.get(k) ?? null,
    key: (i) => Array.from(memory.keys())[i] ?? null,
    removeItem: (k) => { memory.delete(k) },
    setItem: (k, v) => { memory.set(k, String(v)) },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
}
