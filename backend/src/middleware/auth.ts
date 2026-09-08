import { Request, Response, NextFunction } from 'express'
import { verifyToken, JwtPayload } from '../config/jwt'
import { AppError } from './errorHandler'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, '未提供认证令牌'))
  }
  const token = header.slice(7)
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    next(new AppError(401, '令牌无效或已过期'))
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, '未认证'))
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, '权限不足，无法访问该资源'))
    }
    next()
  }
}
