import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

import { v2 as cloudinary } from 'cloudinary'

import { AppError } from '../../shared/middleware/error.middleware'

// Diretório local usado como fallback quando Cloudinary não está configurado.
// Servido estaticamente em /uploads via app.ts.
export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')

type UploadBackend = 'cloudinary' | 'local'

const isPlaceholder = (v?: string) =>
  !v || v.startsWith('your-') || v === '""' || v === ''

// Detecção preguiçosa (lazy) pra garantir que .env já foi carregado.
let detectedBackend: UploadBackend | null = null
function resolveBackend(): UploadBackend {
  if (detectedBackend) return detectedBackend

  const url = process.env.CLOUDINARY_URL
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (url && !isPlaceholder(url)) {
    cloudinary.config()
    detectedBackend = 'cloudinary'
  } else if (!isPlaceholder(cloudName) && !isPlaceholder(apiKey) && !isPlaceholder(apiSecret)) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    })
    detectedBackend = 'cloudinary'
  } else {
    console.warn(
      '[upload] Cloudinary não configurado — usando armazenamento local em ./uploads. Defina CLOUDINARY_* no .env para produção.'
    )
    detectedBackend = 'local'
  }

  return detectedBackend
}

const extByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function uploadToLocal(
  file: Express.Multer.File,
  storeId: string
): Promise<{ url: string; publicId: string }> {
  const ext = extByMime[file.mimetype] ?? 'bin'
  const filename = `${randomUUID()}.${ext}`
  const dir = path.join(LOCAL_UPLOAD_DIR, storeId, 'products')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), file.buffer)

  // URL relativa — resolve via proxy Vite em dev e via Caddy/nginx em prod.
  const publicId = `${storeId}/products/${filename}`
  return { url: `/uploads/${publicId}`, publicId }
}

async function uploadToCloudinary(
  file: Express.Multer.File,
  storeId: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `menupanda/${storeId}/products`,
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          console.error('Cloudinary upload error:', error)
          const detail = error?.message ?? 'erro desconhecido'
          return reject(new AppError(`Falha no upload: ${detail}`, 500))
        }
        resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    uploadStream.end(file.buffer)
  })
}

export async function uploadImage(
  file: Express.Multer.File,
  storeId: string
): Promise<{ url: string; publicId: string }> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.mimetype)) {
    throw new AppError('Tipo de arquivo inválido. Use JPEG, PNG ou WebP', 422)
  }

  const backend = resolveBackend()
  if (backend === 'local') {
    return uploadToLocal(file, storeId)
  }
  return uploadToCloudinary(file, storeId)
}
