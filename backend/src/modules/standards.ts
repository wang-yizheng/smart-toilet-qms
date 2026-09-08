import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../config/db'
import { authenticate, requireRole } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { writeLog } from '../lib/logger'

export const itemsRouter = Router()
export const standardsRouter = Router()

itemsRouter.use(authenticate)
standardsRouter.use(authenticate)

// ---------------- Detection item library ----------------
itemsRouter.get('/', async (_req, res) => {
  res.json(await query('SELECT * FROM detection_items ORDER BY group_name, code'))
})
const itemSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(60),
  unit: z.string().max(20).optional(),
  group_name: z.string().max(40).optional(),
  description: z.string().optional(),
})
itemsRouter.post('/', requireRole('admin', 'qc_manager'), async (req, res, next) => {
  try {
    const b = itemSchema.parse(req.body)
    const r = await query(
      `INSERT INTO detection_items (code,name,unit,group_name,description) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.code, b.name, b.unit ?? null, b.group_name ?? null, b.description ?? null]
    )
    res.status(201).json(r[0])
  } catch (e) { next(e) }
})

// ---------------- Per-product standards ----------------
standardsRouter.get('/', async (req, res, next) => {
  try {
    const productId = Number(req.query.productId)
    if (!productId) throw new AppError(400, '缺少 productId')
    const rows = await query(
      `SELECT s.*, i.code AS item_code, i.name AS item_name, i.unit, i.group_name
       FROM standards s JOIN detection_items i ON s.item_id = i.id
       WHERE s.product_id = $1 ORDER BY i.group_name, i.code`,
      [productId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})
const stdSchema = z.object({
  product_id: z.number().int(),
  item_id: z.number().int(),
  nominal: z.number().optional(),
  lower_bound: z.number().nullable().optional(),
  upper_bound: z.number().nullable().optional(),
  method: z.string().max(120).optional(),
})
standardsRouter.post('/', requireRole('admin', 'qc_manager'), async (req, res, next) => {
  try {
    const b = stdSchema.parse(req.body)
    const r = await query(
      `INSERT INTO standards (product_id,item_id,nominal,lower_bound,upper_bound,method)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (product_id,item_id) DO UPDATE SET
         nominal=EXCLUDED.nominal, lower_bound=EXCLUDED.lower_bound,
         upper_bound=EXCLUDED.upper_bound, method=EXCLUDED.method
       RETURNING *`,
      [b.product_id, b.item_id, b.nominal ?? null, b.lower_bound ?? null, b.upper_bound ?? null, b.method ?? null]
    )
    await writeLog(
      req.user!.userId,
      'standard.update',
      `调整产品 #${b.product_id} 检测项 #${b.item_id} 标准：${b.nominal ?? '-'}（${b.lower_bound ?? '-∞'} ~ ${b.upper_bound ?? '+∞'}）`
    )
    res.status(201).json(r[0])
  } catch (e) { next(e) }
})
standardsRouter.patch('/:id', requireRole('admin', 'qc_manager'), async (req, res, next) => {
  try {
    const b = stdSchema.partial().parse(req.body)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(b)) {
      sets.push(`${k} = $${i++}`)
      params.push(v === undefined ? null : v)
    }
    params.push(Number(req.params.id))
    const r = await query(`UPDATE standards SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params)
    res.json(r[0])
  } catch (e) { next(e) }
})
standardsRouter.delete('/:id', requireRole('admin', 'qc_manager'), async (req, res, next) => {
  try {
    await query('DELETE FROM standards WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})
