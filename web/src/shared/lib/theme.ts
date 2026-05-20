// Personalização visual da loja (v2.9).
// Tailwind consome cores via `hsl(var(--primary))`, então o admin guarda HEX
// e o cardápio público converte pra HSL e injeta nas CSS variables em runtime.

export interface PalettePreset {
  /** Slug curto, usado como key no React. */
  id: string
  /** Nome exibido pro admin. */
  label: string
  /** HEX da cor primária — botões, links, destaques. */
  primary: string
  /** HEX da cor secundária — acentos, ícones, hover sutil. */
  secondary: string
}

/**
 * Paleta predefinida — 10 combos curados de primária+secundária. Admin pode
 * escolher um destes (clique único) ou abrir "Customizar" pra picker livre.
 * Cores baseadas em Tailwind defaults (500/600 da primária + 100/200 da secundária)
 * pra garantir contraste mínimo sobre fundo branco.
 */
export const PALETTE_PRESETS: PalettePreset[] = [
  { id: 'red', label: 'Vermelho', primary: '#EF4444', secondary: '#FEE2E2' },
  { id: 'orange', label: 'Laranja', primary: '#F97316', secondary: '#FFEDD5' },
  { id: 'amber', label: 'Âmbar', primary: '#F59E0B', secondary: '#FEF3C7' },
  { id: 'green', label: 'Verde', primary: '#22C55E', secondary: '#DCFCE7' },
  { id: 'emerald', label: 'Esmeralda', primary: '#10B981', secondary: '#D1FAE5' },
  { id: 'cyan', label: 'Ciano', primary: '#06B6D4', secondary: '#CFFAFE' },
  { id: 'blue', label: 'Azul', primary: '#3B82F6', secondary: '#DBEAFE' },
  { id: 'purple', label: 'Roxo', primary: '#8B5CF6', secondary: '#EDE9FE' },
  { id: 'pink', label: 'Rosa', primary: '#EC4899', secondary: '#FCE7F3' },
  { id: 'slate', label: 'Grafite', primary: '#334155', secondary: '#E2E8F0' },
]

interface Hsl {
  h: number
  s: number
  l: number
}

function hexToHsl(hex: string): Hsl {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!match) throw new Error(`HEX inválido: ${hex}`)

  const intVal = parseInt(match[1], 16)
  const r = ((intVal >> 16) & 0xff) / 255
  const g = ((intVal >> 8) & 0xff) / 255
  const b = (intVal & 0xff) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h *= 60
  }

  return { h, s: s * 100, l: l * 100 }
}

/**
 * HEX (#RRGGBB) → string `H S% L%` no formato exigido pelo Tailwind
 * (`hsl(var(--primary))` expande pra `hsl(H S% L%)`). Lança erro se o
 * input não bate no regex — paleta predefinida já está validada, custom
 * passa pelo mesmo regex do Zod no backend.
 */
export function hexToHslString(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`
}

/**
 * HEX → `hsl(H S% L%)` (CSS-pronto). Usado pelas variáveis `--menu-*` que
 * o tailwind.config consome direto (sem o `hsl(var(...))` wrapper).
 */
export function hexToCssHsl(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
}

/**
 * Gera o trio { primary, gradientFrom, gradientTo } a partir de um HEX de marca.
 * `from` é a primária ligeiramente mais clara, `to` ligeiramente mais escura —
 * mantém o efeito de degradê do header do cardápio (`bg-gradient-to-r`).
 * Saída em `hsl(...)` CSS-pronto pra `setProperty`.
 */
export function deriveMenuPalette(hex: string): {
  primary: string
  gradientFrom: string
  gradientTo: string
} {
  const base = hexToHsl(hex)
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  const fmt = (h: Hsl) =>
    `hsl(${Math.round(h.h)} ${Math.round(h.s)}% ${Math.round(h.l)}%)`
  return {
    primary: fmt(base),
    gradientFrom: fmt({ h: base.h, s: base.s, l: clamp(base.l + 4) }),
    gradientTo: fmt({ h: base.h, s: base.s, l: clamp(base.l - 8) }),
  }
}

/**
 * Retorna `#000000` ou `#FFFFFF` conforme a luminância da cor de fundo —
 * usado pra escolher a cor do texto sobre botões custom.
 */
export function readableTextColor(hexBg: string): '#000000' | '#FFFFFF' {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hexBg)
  if (!match) return '#FFFFFF'
  const intVal = parseInt(match[1], 16)
  const r = ((intVal >> 16) & 0xff) / 255
  const g = ((intVal >> 8) & 0xff) / 255
  const b = (intVal & 0xff) / 255
  // Relative luminance (WCAG)
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
  return L > 0.5 ? '#000000' : '#FFFFFF'
}

/** HEX default usado pelo tema (mesmo `--primary` do `:root`). */
export const DEFAULT_PRIMARY = '#EF4444'
export const DEFAULT_SECONDARY = '#FEE2E2'
