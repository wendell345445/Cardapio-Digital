import { Router } from 'express'

import { whatsappRouter } from '../whatsapp/whatsapp.routes'

import categoriesRouter from './categories.routes'
import motoboysRouter from './motoboys.routes'
import ordersRouter from './orders.routes'
import paymentAccessRouter from './payment-access.routes'
import productsRouter from './products.routes'
import tablesRouter from './tables.routes'
import uploadRouter from './upload.routes'
import storeRouter from './store.routes'
import couponsRouter from './coupons.routes'
import deliveryRouter from './delivery.routes'
import analyticsRouter from './analytics.routes'
import cashflowRouter from './cashflow.routes'
import additionalsRouter from './additionals.routes'
import conversationsRouter from './conversations.routes'

export const adminRouter = Router()

adminRouter.use('/categories', categoriesRouter)
adminRouter.use('/store/motoboys', motoboysRouter)
adminRouter.use('/orders', ordersRouter)
adminRouter.use('/products', productsRouter)
adminRouter.use('/upload', uploadRouter)
adminRouter.use('/tables', tablesRouter)
adminRouter.use('/store', storeRouter)
adminRouter.use('/store', paymentAccessRouter)
adminRouter.use('/whatsapp', whatsappRouter)
// TASK-090: Cupons
adminRouter.use('/coupons', couponsRouter)
// TASK-091: Área de Entrega
adminRouter.use('/delivery', deliveryRouter)
// TASK-093/094: Analytics e Ranking
adminRouter.use('/analytics', analyticsRouter)
// TASK-095: Controle de Caixa
adminRouter.use('/cashflows', cashflowRouter)
// TASK-109: Adicionais centralizados
adminRouter.use('/additionals', additionalsRouter)
// TASK-103/Epic 10: Conversas WhatsApp
adminRouter.use('/whatsapp/conversations', conversationsRouter)
