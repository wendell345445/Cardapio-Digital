import { v2 as cloudinary } from 'cloudinary'

import { AppError } from '../../shared/middleware/error.middleware'

cloudinary.config()  // usa CLOUDINARY_URL da env

export async function uploadImage(
  file: Express.Multer.File,
  storeId: string
): Promise<{ url: string; publicId: string }> {
  // Validar tipo: só jpeg, png, webp
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.mimetype)) {
    throw new AppError('Tipo de arquivo inválido. Use JPEG, PNG ou WebP', 422)
  }

  // Upload para Cloudinary usando buffer
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `menupanda/${storeId}/products`,
        format: 'auto',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(new AppError('Falha no upload', 500))
        resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    uploadStream.end(file.buffer)
  })
}
