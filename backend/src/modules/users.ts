import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { query } from '../config/db'
import { authenticate, requireRole } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const usersRouter = Router()

const ROLES = ['admin', 'qc_manager', 'inspector', 'producer']

usersRouter.use(authenticate)

usersRouter.get('/', requireRole('admin', 'qc_manager'), async (_req: Request, res: Response) => {
  const rows = await query(
    `SELECT id, username, name, role, status, created_at FROM users ORDER BY id`
  )
  res.json(rows)
})

const createSchema = z.object({
  username: z.string().min(2).max(50),
  name: z.string().min(1).max(50),
  role: z.enum(['admin', 'qc_manager', 'inspector', 'producer']),
  password: z.string().min(6).max(50),
})
usersRouter.post('/', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body)
    const exists = await query('SELECT id FROM users WHERE username = $1', [body.username])
    if (exists.length) throw new AppError(409, '用户名已存在')
    const hash = await bcrypt.hash(body.password, 10)
    const rows = await query(
      `INSERT INTO users (username, password_hash, name, role, status)
       VALUES ($1,$2,$3,$4,'active') RETURNING id, username, name, role, status`,
      [body.username, hash, body.name, body.role]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  role: z.enum(['admin', 'qc_manager', 'inspector', 'producer']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})
usersRouter.patch('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id)
    const body = updateSchema.parse(req.body)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(body)) {
      sets.push(`${k} = $${i++}`)
      params.push(v)
    }
    if (!sets.length) throw new AppError(400, '无可更新字段')
    params.push(id)
    const rows = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, username, name, role, status`,
      params
    )
    if (!rows.length) throw new AppError(404, '用户不存在')
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

const resetSchema = z.object({ password: z.string().min(6).max(50) })
usersRouter.post('/:id/reset-password', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id)
    const { password } = resetSchema.parse(req.body)
    const hash = await bcrypt.hash(password, 10)
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id])
    res.json({ message: '密码已重置' })
  } catch (err) {
    next(err)
  }
})

usersRouter.get('/roles', (_req: Request, res: Response) => {
  res.json(ROLES)
})
