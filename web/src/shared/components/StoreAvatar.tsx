import { resolveImageUrl } from '@/shared/lib/imageUrl'
import { DEFAULT_PRIMARY, readableTextColor } from '@/shared/lib/theme'

interface StoreAvatarProps {
  /** Nome da loja — usado pra gerar iniciais quando não há logo. */
  name?: string | null
  /** URL da logo (absoluta ou /uploads/...). Se vazia/null, exibe iniciais. */
  logoUrl?: string | null
  /** Cor de fundo das iniciais (HEX). Default = primária do tema. */
  fallbackBg?: string | null
  /** Diâmetro em px. Default 48. */
  size?: number
  /** Classe extra (ex: ring/shadow). */
  className?: string
}

/**
 * Gera iniciais estilo WhatsApp/contatos:
 *  - Nome composto (2+ palavras) → 1ª letra da 1ª palavra + 1ª letra da última
 *  - Nome simples (1 palavra) → primeiras 2 letras
 *  - Vazio → '?'
 *
 * Stopwords curtas (de/da/do/dos/e) são ignoradas pra evitar "B D" em
 * "Burguer da Esquina".
 */
export function getStoreInitials(name?: string | null): string {
  if (!name) return '?'
  const stopwords = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p && !stopwords.has(p.toLowerCase()))

  if (parts.length === 0) return '?'

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  const first = parts[0].charAt(0)
  const last = parts[parts.length - 1].charAt(0)
  return (first + last).toUpperCase()
}

/**
 * Avatar circular da loja — exibe logo quando disponível ou iniciais com
 * fundo na cor primária (padrão WhatsApp / redes sociais).
 */
export function StoreAvatar({
  name,
  logoUrl,
  fallbackBg,
  size = 48,
  className = '',
}: StoreAvatarProps) {
  const dimension = { width: size, height: size }

  if (logoUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden bg-white ${className}`}
        style={dimension}
      >
        <img
          src={resolveImageUrl(logoUrl) ?? logoUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  const bg = fallbackBg || DEFAULT_PRIMARY
  const fg = readableTextColor(bg)
  const initials = getStoreInitials(name)
  // Tamanho da fonte proporcional: 40% do diâmetro, escala bem entre 32 e 96.
  const fontSize = Math.round(size * 0.4)

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold uppercase tracking-tight ${className}`}
      style={{
        ...dimension,
        backgroundColor: bg,
        color: fg,
        fontSize,
        lineHeight: 1,
      }}
      aria-label={name ? `Iniciais de ${name}` : 'Loja sem logo'}
    >
      {initials}
    </div>
  )
}
