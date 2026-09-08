import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import 'express-async-errors'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { httpLogger } from './middleware/logger'
import { systemRouter } from './modules/system'

import { authRouter } from './modules/auth'
import { usersRouter } from './modules/users'
import { categoriesRouter, suppliersRouter, productsRouter, batchesRouter } from './modules/products'
import { itemsRouter, standardsRouter } from './modules/standards'
import { tasksRouter } from './modules/tasks'
import { recordsRouter } from './modules/records'
import { nonconformingRouter } from './modules/nonconforming'
import { statsRouter } from './modules/stats'
import { reportsRouter } from './modules/reports'
import { announcementsRouter } from './modules/announcements'
import { logsRouter } from './modules/logs'

export const createApp = (): Application => {
  const app = express()

  app.use(httpLogger)
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN,
      credentials: env.CORS_ORIGIN !== '*',
    })
  )
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(compression())

  // System & Health
  app.use(env.API_PREFIX, systemRouter)

  // Auth
  app.use(`${env.API_PREFIX}/auth`, authRouter)
  app.use(`${env.API_PREFIX}/users`, usersRouter)

  // Basic data
  app.use(`${env.API_PREFIX}/categories`, categoriesRouter)
  app.use(`${env.API_PREFIX}/suppliers`, suppliersRouter)
  app.use(`${env.API_PREFIX}/products`, productsRouter)
  app.use(`${env.API_PREFIX}/batches`, batchesRouter)

  // Detection standards
  app.use(`${env.API_PREFIX}/items`, itemsRouter)
  app.use(`${env.API_PREFIX}/standards`, standardsRouter)

  // Business
  app.use(`${env.API_PREFIX}/tasks`, tasksRouter)
  app.use(`${env.API_PREFIX}/records`, recordsRouter)
  app.use(`${env.API_PREFIX}/nonconforming`, nonconformingRouter)
  app.use(`${env.API_PREFIX}/stats`, statsRouter)
  app.use(`${env.API_PREFIX}/reports`, reportsRouter)
  app.use(`${env.API_PREFIX}/announcements`, announcementsRouter)
  app.use(`${env.API_PREFIX}/logs`, logsRouter)

  app.use(errorHandler)

  return app
}
