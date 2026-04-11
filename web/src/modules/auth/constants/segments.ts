/**
 * Opções de segmento de loja exibidas no formulário de auto-cadastro (`/cadastro`).
 * Os values batem com o enum `StoreSegment` do Prisma (api).
 */
export const SEGMENT_OPTIONS = [
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'PIZZERIA', label: 'Pizzaria' },
  { value: 'BURGER', label: 'Hamburgueria' },
  { value: 'BAKERY', label: 'Padaria / Cafeteria' },
  { value: 'ACAI', label: 'Açaí / Sorveteria' },
  { value: 'JAPANESE', label: 'Japonês / Sushi' },
  { value: 'MARKET', label: 'Mercado / Conveniência' },
  { value: 'OTHER', label: 'Outro' },
] as const

export type StoreSegmentValue = (typeof SEGMENT_OPTIONS)[number]['value']
