import { createApp } from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import { ensureSchema, ensureAdminUsers } from './db/init'
import { seedIfEmpty, seedOperationLogsIfEmpty } from './db/seed'
import { startReminderJob } from './jobs/reminder'

const startServer = async () => {
  try {
    // Ensure database schema, default accounts and demo data exist
    await ensureSchema()
    await ensureAdminUsers()
    await seedIfEmpty()
    await seedOperationLogsIfEmpty()

    // Periodic overdue / pending-review reminders
    startReminderJob()

    const app = createApp()

    app.listen(env.PORT, () => {
      // Only show minimal startup info in development
      if (env.NODE_ENV === 'development') {
        console.log(`Server running on http://localhost:${env.PORT}${env.API_PREFIX}`)
      }
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server')
    process.exit(1)
  }
}

// Handle graceful shutdown silently
process.on('SIGTERM', async () => {
  process.exit(0)
})

process.on('SIGINT', async () => {
  process.exit(0)
})

startServer()
