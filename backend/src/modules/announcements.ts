import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../config/db'
import { authenticate, requireRole } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const announcementsRouter = Router()
announcementsRouter.use(authenticate)

announcementsRouter.get('/', async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT a.*, u.name AS author_name FROM announcements a
     LEFT JOIN users u ON a.created_by = u.id
     ORDER BY a.pinned DESC, a.created_at DESC`
  )
  res.json(rows)
})

const createSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().optional(),
  pinned: z.boolean().optional(),
})
announcementsRouter.post('/', requireRole('admin', 'qc_manager'), async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body)
    const r = await query(
      `INSERT INTO announcements (title, content, pinned, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.title, b.content ?? null, b.pinned ?? false, req.user!.userId]
    )
    res.status(201).json(r[0])
  } catch (e) { next(e) }
})

announcementsRouter.patch('/:id', requireRole('admin', 'qc_manager'), async (req, res, next) => {
  try {
    const b = createSchema.partial().parse(req.body)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(b)) {
      sets.push(`${k} = $${i++}`)
      params.push(v === undefined ? null : v)
    }
    params.push(Number(req.params.id))
    const r = await query(`UPDATE announcements SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params)
    res.json(r[0])
  } catch (e) { next(e) }
})

announcementsRouter.delete('/:id', requireRole('admin', 'qc_manager'), async (req, res, next) => {
  try {
    await query('DELETE FROM announcements WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})
