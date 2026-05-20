import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'

import { uploadImage } from './upload.service'

export async function uploadImageController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Nenhum arquivo enviado', 400)
    const storeId = req.tenant!.storeId
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const result = await uploadImage(req.file, storeId, type)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
