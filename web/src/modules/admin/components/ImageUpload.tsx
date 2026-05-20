import { useRef, useState } from 'react'

import { api } from '@/shared/lib/api'
import { resolveImageUrl } from '@/shared/lib/imageUrl'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  className?: string
  variant?: 'button' | 'card'
}

export function ImageUpload({
  value,
  onChange,
  className = '',
  variant = 'button',
}: ImageUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      const { data } = await api.post('/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onChange(data.data.url)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao fazer upload')
    } finally {
      setLoading(false)
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={handleFileChange}
    />
  )

  if (variant === 'card') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="block w-full overflow-hidden rounded-md disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          {value ? (
            <div className="relative w-full h-56 group">
              <img
                src={resolveImageUrl(value)}
                alt="Preview"
                className="w-full h-56 object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-medium">
                  {loading ? 'Enviando...' : 'Trocar imagem'}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-56 flex flex-col items-center justify-center bg-red-50 hover:bg-red-100 transition-colors text-red-500 px-4">
              <svg
                width={36}
                height={36}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
              <p className="mt-2 text-sm font-semibold">
                {loading ? 'Enviando...' : 'Adicione uma foto'}
              </p>
              <p className="mt-1 text-xs text-gray-500 text-center">
                Atraia os clientes com uma foto linda do seu produto.
                <br />
                (JPEG, PNG até 3MB)
              </p>
            </div>
          )}
        </button>
        {error && <p className="mt-2 text-sm text-red-500 px-4 pb-2">{error}</p>}
        {fileInput}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {value && (
        <img
          src={resolveImageUrl(value)}
          alt="Preview"
          className="w-32 h-32 object-cover rounded-lg border"
        />
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 disabled:opacity-50"
      >
        {loading ? 'Enviando...' : value ? 'Trocar imagem' : 'Selecionar imagem'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {fileInput}
    </div>
  )
}
