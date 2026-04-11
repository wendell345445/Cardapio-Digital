import { NextFunction, Request, Response } from 'express'

import { AppError } from '../../shared/middleware/error.middleware'

import { uploadImage } from './upload.service'

export async function uploadImageController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Nenhum arquivo enviado', 400)
    const storeId = req.tenant!.storeId
    const result = await uploadImage(req.file, storeId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
