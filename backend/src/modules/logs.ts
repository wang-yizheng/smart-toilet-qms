import { Router, Request, Response, NextFunction } from 'express'
import { query } from '../config/db'
import { authenticate, requireRole } from '../middleware/auth'
import { LOG_ACTIONS } from '../lib/logger'

export const logsRouter = Router()
logsRouter.use(authenticate)

/**
 * List operation logs with optional filters.
 * Query: action, userId, keyword, from, to, limit, offset
 */
logsRouter.get('/', requireRole('admin', 'qc_manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, userId, keyword, from, to } = req.query as Record<string, string>
    const limit = Math.min(Number(req.query.limit) || 50, 500)
    const offset = Number(req.query.offset) || 0

    const wheres: string[] = []
    const params: any[] = []
    let i = 1
    if (action) { wheres.push(`l.action = $${i++}`); params.push(action) }
    if (userId) { wheres.push(`l.user_id = $${i++}`); params.push(Number(userId)) }
    if (from) { wheres.push(`l.created_at >= $${i++}`); params.push(from) }
    if (to) { wheres.push(`l.created_at <= $${i++}`); params.push(`${to} 23:59:59`) }
    if (keyword) {
      wheres.push(`(l.detail ILIKE $${i} OR COALESCE(u.name,'') ILIKE $${i})`)
      params.push(`%${keyword}%`)
      i++
    }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''

    const rows = await query(
      `SELECT l.*, u.name AS user_name, u.username
       FROM operation_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ${where}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    )
    const total = await query(
      `SELECT count(*)::int AS cnt FROM operation_logs l LEFT JOIN users u ON l.user_id = u.id ${where}`,
      params
    )
    res.json({ items: rows, total: total[0]?.cnt ?? 0, limit, offset })
  } catch (e) { next(e) }
})

/** Distinct action types that currently exist in the log table. */
logsRouter.get('/actions', requireRole('admin', 'qc_manager'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT action, count(*)::int AS cnt FROM operation_logs GROUP BY action ORDER BY cnt DESC`
    )
    res.json(
      rows.map((r: any) => ({
        action: r.action,
        count: r.cnt,
        label: LOG_ACTIONS[r.action] ?? r.action,
      }))
    )
  } catch (e) { next(e) }
})

/** Aggregate figures for the log page header cards. */
logsRouter.get('/stats', requireRole('admin', 'qc_manager'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const totals = await query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last7
      FROM operation_logs
    `)
    const byAction = await query(
      `SELECT action, count(*)::int AS cnt FROM operation_logs GROUP BY action ORDER BY cnt DESC`
    )
    const trend = await query(`
      SELECT to_char(d.day,'MM-DD') AS day, count(l.id)::int AS cnt
      FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d(day)
      LEFT JOIN operation_logs l ON date_trunc('day', l.created_at) = d.day
      GROUP BY d.day ORDER BY d.day
    `)
    res.json({
      total: totals[0]?.total ?? 0,
      today: totals[0]?.today ?? 0,
      last7: totals[0]?.last7 ?? 0,
      byAction: byAction.map((r: any) => ({
        action: r.action,
        count: r.cnt,
        label: LOG_ACTIONS[r.action] ?? r.action,
      })),
      trend,
    })
  } catch (e) { next(e) }
})
