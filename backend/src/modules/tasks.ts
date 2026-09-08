import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../config/db'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const tasksRouter = Router()
tasksRouter.use(authenticate)

const TASK_STATUSES = ['待派工', '待检测', '检测中', '待审核', '已完成', '已终止']
const TASK_TYPES = ['出厂', '过程', '型式']

function buildTaskSelect() {
  return `
    SELECT t.*, p.model AS product_model, p.name AS product_name,
           b.batch_no, u.name AS assignee_name, c.name AS creator_name
    FROM tasks t
    LEFT JOIN products p ON t.product_id = p.id
    LEFT JOIN batches b ON t.batch_id = b.id
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.created_by = c.id
  `
}

tasksRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, productId, assigneeId, type } = req.query as Record<string, string>
    const wheres: string[] = []
    const params: any[] = []
    let i = 1
    if (status) { wheres.push(`t.status = $${i++}`); params.push(status) }
    if (productId) { wheres.push(`t.product_id = $${i++}`); params.push(Number(productId)) }
    if (assigneeId) { wheres.push(`t.assignee_id = $${i++}`); params.push(Number(assigneeId)) }
    if (type) { wheres.push(`t.type = $${i++}`); params.push(type) }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
    const rows = await query(`${buildTaskSelect()} ${where} ORDER BY t.created_at DESC`, params)
    res.json(rows)
  } catch (e) { next(e) }
})

tasksRouter.get('/mine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `${buildTaskSelect()} WHERE t.assignee_id = $1 ORDER BY t.created_at DESC`,
      [req.user!.userId]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

tasksRouter.get('/:id', async (req, res, next) => {
  try {
    const rows = await query(`${buildTaskSelect()} WHERE t.id = $1`, [Number(req.params.id)])
    if (!rows.length) throw new AppError(404, '任务不存在')
    res.json(rows[0])
  } catch (e) { next(e) }
})

const createSchema = z.object({
  product_id: z.number().int(),
  batch_id: z.number().int().optional(),
  type: z.enum(['出厂', '过程', '型式']).default('出厂'),
  assignee_id: z.number().int().optional(),
  plan_date: z.string().optional(),
  due_date: z.string().optional(),
  note: z.string().optional(),
})
tasksRouter.post('/', async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body)
    const status = b.assignee_id ? '待检测' : '待派工'
    const rows = await query(
      `INSERT INTO tasks (task_no, product_id, batch_id, type, status, assignee_id, plan_date, due_date, created_by, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        `T${Date.now()}`,
        b.product_id,
        b.batch_id ?? null,
        b.type,
        status,
        b.assignee_id ?? null,
        b.plan_date ?? null,
        b.due_date ?? null,
        req.user!.userId,
        b.note ?? null,
      ]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

const updateSchema = z.object({
  status: z.enum(['待派工', '待检测', '检测中', '待审核', '已完成', '已终止']).optional(),
  assignee_id: z.number().int().nullable().optional(),
  plan_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  note: z.string().optional(),
})
tasksRouter.patch('/:id', async (req, res, next) => {
  try {
    const b = updateSchema.parse(req.body)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(b)) {
      sets.push(`${k} = $${i++}`)
      params.push(v === undefined ? null : v)
    }
    params.push(Number(req.params.id))
    const rows = await query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params)
    if (!rows.length) throw new AppError(404, '任务不存在')
    res.json(rows[0])
  } catch (e) { next(e) }
})

tasksRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM tasks WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})

export { TASK_STATUSES }
