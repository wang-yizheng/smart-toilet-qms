import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { query } from '../config/db'
import { signToken } from '../config/jwt'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { writeLog } from '../lib/logger'

export const authRouter = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = loginSchema.parse(req.body)
    const rows = await query('SELECT * FROM users WHERE username = $1', [username])
    const user = rows[0]
    if (!user || user.status !== 'active') {
      throw new AppError(401, '用户名或密码错误')
    }
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) throw new AppError(401, '用户名或密码错误')

    const token = signToken({ userId: user.id, username: user.username, role: user.role })
    await writeLog(user.id, 'login', `${user.name}（${user.username}）登录系统`)
    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  const rows = await query(
    'SELECT id, username, name, role, status, created_at FROM users WHERE id = $1',
    [req.user!.userId]
  )
  res.json(rows[0])
})

// light health check that requires auth (used by frontend to validate token)
authRouter.get('/profile', authenticate, async (req: Request, res: Response) => {
  res.json({ user: req.user })
})
