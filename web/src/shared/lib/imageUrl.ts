// O backend serve uploads locais como caminho relativo `/uploads/<storeId>/...`
// (ver api/src/modules/admin/upload.service.ts). Em dev o Vite faz proxy de
// /uploads pra :3001, mas em prod o frontend e a API moram em hosts distintos
// (ex: menupanda.com.br vs api.menupanda.com.br), então precisamos prefixar.
//
// URLs Cloudinary recebem f_auto,q_auto pra servir WebP/AVIF otimizado.
// data:/blob: passam intactos.
export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^(data:|blob:)/.test(url)) return url

  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/f_')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto/')
  }

  if (/^https?:/.test(url)) return url
  if (!url.startsWith('/uploads/')) return url

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (!apiUrl) return url
  return `${apiUrl.replace(/\/+$/, '')}${url}`
}
