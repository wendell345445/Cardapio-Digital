import { useEffect } from 'react'

import { hexToHslString } from '@/shared/lib/theme'

interface ThemeInjectorProps {
  primaryColor?: string | null
  secondaryColor?: string | null
}

/**
 * Aplica as cores customizadas da loja sobre as CSS variables do Tailwind
 * (`--primary`, `--accent`) em runtime. Quando ambos os campos vêm vazios,
 * o componente vira no-op — herda o tema default do `:root` em index.css.
 *
 * Aplica em `document.documentElement` (e não num <style> dinâmico) porque o
 * cardápio público compartilha o mesmo bundle do admin via React Router. Mudar
 * inline garante reset automático ao navegar pra rotas administrativas. Cleanup
 * remove os overrides ao desmontar.
 */
export function ThemeInjector({ primaryColor, secondaryColor }: ThemeInjectorProps) {
  useEffect(() => {
    if (!primaryColor && !secondaryColor) return

    const root = document.documentElement
    const previousPrimary = root.style.getPropertyValue('--primary')
    const previousAccent = root.style.getPropertyValue('--accent')

    try {
      if (primaryColor) {
        root.style.setProperty('--primary', hexToHslString(primaryColor))
      }
      if (secondaryColor) {
        // Tailwind expõe `--accent` pros tons sutis (badges, hover). Reutilizamos
        // ele pra "secondary" do produto — `--secondary` da paleta Tailwind padrão
        // já é cinza neutro e está acoplado a vários componentes admin.
        root.style.setProperty('--accent', hexToHslString(secondaryColor))
      }
    } catch (err) {
      // HEX inválido — silently bail out. Backend já valida no Zod, mas defensive.
      console.warn('[ThemeInjector] cor inválida, mantendo default:', err)
    }

    return () => {
      if (previousPrimary) {
        root.style.setProperty('--primary', previousPrimary)
      } else {
        root.style.removeProperty('--primary')
      }
      if (previousAccent) {
        root.style.setProperty('--accent', previousAccent)
      } else {
        root.style.removeProperty('--accent')
      }
    }
  }, [primaryColor, secondaryColor])

  return null
}
