import { Router } from 'express'

import {
  printerAuthMiddleware,
  printerLoginController,
  printerMarkPrintedController,
  printerMeController,
  printerPendingController,
} from './print.controller'

// Rotas montadas em /api/print/* (fora de /api/v1) para casar com o contrato
// fixo esperado pelo app desktop Menuziprinter (.local/Menuziprinter-module-
// estavel-final/electron/ipc/settings.ts + services/poller.ts).
export const printRouter = Router()

printRouter.post('/login', printerLoginController)
printRouter.get('/me', printerAuthMiddleware, printerMeController)
printRouter.get('/pending', printerAuthMiddleware, printerPendingController)
printRouter.post('/mark-printed', printerAuthMiddleware, printerMarkPrintedController)
