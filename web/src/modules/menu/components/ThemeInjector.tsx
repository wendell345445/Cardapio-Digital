import { useEffect } from 'react'

import { deriveMenuPalette, hexToHslString } from '@/shared/lib/theme'

interface ThemeInjectorProps {
  primaryColor?: string | null
  secondaryColor?: string | null
}

// CSS variables que o cardápio público usa pra cor de marca. Defaults em
// src/index.css :root. Tailwind config aponta `menu-primary` → var(--menu-primary), etc.
const MENU_VARS = ['--menu-primary', '--menu-gradient-from', '--menu-gradient-to'] as const
// Variáveis Tailwind compartilhadas com o admin — guardadas pra cleanup também.
const SHARED_VARS = ['--primary', '--accent'] as const

/**
 * Aplica as cores customizadas da loja sobre as CSS variables do Tailwind
 * (`--menu-primary`, `--menu-gradient-from/to`, `--primary`, `--accent`) em
 * runtime. Quando ambos os campos vêm vazios, é no-op — herda o tema default
 * do `:root` em index.css.
 *
 * Aplica em `document.documentElement` (não num <style> dinâmico) porque o
 * cardápio público compartilha o mesmo bundle do admin via React Router.
 * Cleanup restaura os valores anteriores ao desmontar pra não vazar tema do
 * cardápio em telas administrativas.
 */
export function ThemeInjector({ primaryColor, secondaryColor }: ThemeInjectorProps) {
  useEffect(() => {
    if (!primaryColor && !secondaryColor) return

    const root = document.documentElement
    const previous: Record<string, string> = {}
    for (const v of [...MENU_VARS, ...SHARED_VARS]) {
      previous[v] = root.style.getPropertyValue(v)
    }

    try {
      if (primaryColor) {
        const palette = deriveMenuPalette(primaryColor)
        root.style.setProperty('--menu-primary', palette.primary)
        root.style.setProperty('--menu-gradient-from', palette.gradientFrom)
        root.style.setProperty('--menu-gradient-to', palette.gradientTo)
        // Tailwind admin/shared usa hsl(var(--primary)) — formato sem o `hsl()`.
        root.style.setProperty('--primary', hexToHslString(primaryColor))
      }
      if (secondaryColor) {
        // O cardápio público usa fundos neutros — a secondary só viaja pelo
        // `--accent` do Tailwind (botões e badges que usam `bg-accent`).
        root.style.setProperty('--accent', hexToHslString(secondaryColor))
      }
    } catch (err) {
      // HEX inválido — silently bail out. Backend já valida no Zod, mas defensive.
      console.warn('[ThemeInjector] cor inválida, mantendo default:', err)
    }

    return () => {
      for (const v of [...MENU_VARS, ...SHARED_VARS]) {
        if (previous[v]) {
          root.style.setProperty(v, previous[v])
        } else {
          root.style.removeProperty(v)
        }
      }
    }
  }, [primaryColor, secondaryColor])

  return null
}
