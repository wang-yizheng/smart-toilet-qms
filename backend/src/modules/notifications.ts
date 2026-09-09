import { Router, Request, Response, NextFunction } from 'express'
import { query } from '../config/db'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const notificationsRouter = Router()
notificationsRouter.use(authenticate)

const TYPES: Record<string, string> = {
  task_overdue: '任务超期',
  review_pending: '待审核',
  nc_open: '不合格待处置',
  system: '系统通知',
}

/** Current user's notifications plus the unread count. */
notificationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT * FROM notifications WHERE user_id = $1
       ORDER BY is_read ASC, created_at DESC LIMIT 50`,
      [req.user!.userId]
    )
    const unread = await query(
      `SELECT count(*)::int AS cnt FROM notifications WHERE user_id = $1 AND is_read = false`,
      [req.user!.userId]
    )
    res.json({
      items: rows.map((r: any) => ({ ...r, type_label: TYPES[r.type] ?? r.type })),
      unread: unread[0]?.cnt ?? 0,
    })
  } catch (e) { next(e) }
})

notificationsRouter.get('/types', (_req: Request, res: Response) => {
  res.json(TYPES)
})

notificationsRouter.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user!.userId])
    res.json({ message: 'ok' })
  } catch (e) { next(e) }
})

notificationsRouter.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [Number(req.params.id), req.user!.userId]
    )
    if (!rows.length) throw new AppError(404, '消息不存在')
    res.json(rows[0])
  } catch (e) { next(e) }
})
