import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../config/db'
import { authenticate, requireRole } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { writeLog } from '../lib/logger'

export const nonconformingRouter = Router()
nonconformingRouter.use(authenticate)

nonconformingRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, defectLevel } = req.query as Record<string, string>
    const wheres: string[] = []
    const params: any[] = []
    let i = 1
    if (status) { wheres.push(`n.status = $${i++}`); params.push(status) }
    if (defectLevel) { wheres.push(`n.defect_level = $${i++}`); params.push(defectLevel) }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
    const rows = await query(
      `SELECT n.*, i.name AS item_name, i.unit, i.group_name,
              p.model AS product_model, b.batch_no, r.record_no,
              u.name AS inspector_name
       FROM nonconforming n
       JOIN records r ON n.record_id = r.id
       LEFT JOIN detection_items i ON n.item_id = i.id
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN batches b ON r.batch_id = b.id
       LEFT JOIN users u ON r.inspector_id = u.id
       ${where} ORDER BY n.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (e) { next(e) }
})

const updateSchema = z.object({
  defect_level: z.enum(['轻微', '一般', '严重']).optional(),
  phenomenon: z.string().optional(),
  cause: z.string().optional(),
  responsibility_dept: z.string().max(40).optional(),
  disposition: z.enum(['待处理', '返工', '返修', '让步接收', '报废']).optional(),
  status: z.enum(['待处理', '审批中', '已闭环']).optional(),
  recheck_result: z.enum(['pass', 'fail']).nullable().optional(),
})
nonconformingRouter.patch('/:id', requireRole('admin', 'qc_manager', 'inspector'), async (req, res, next) => {
  try {
    const b = updateSchema.parse(req.body)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(b)) {
      sets.push(`${k} = $${i++}`)
      params.push(v === undefined ? null : v)
    }
    if (!sets.length) throw new AppError(400, '无可更新字段')
    params.push(Number(req.params.id))
    const rows = await query(`UPDATE nonconforming SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params)
    if (!rows.length) throw new AppError(404, '记录不存在')
    await writeLog(
      req.user!.userId,
      'nc.dispose',
      `不合格品 #${rows[0].id} 处置：${rows[0].disposition ?? '待处理'}，状态：${rows[0].status}`
    )
    res.json(rows[0])
  } catch (e) { next(e) }
})

// Summary for dashboard cards
nonconformingRouter.get('/stats/summary', async (_req, res) => {
  const rows = await query(`
    SELECT status, count(*)::int AS cnt FROM nonconforming GROUP BY status
    UNION ALL
    SELECT 'total' AS status, count(*)::int FROM nonconforming
  `)
  res.json(rows)
})
