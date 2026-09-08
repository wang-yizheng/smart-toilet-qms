import { Router, Request, Response, NextFunction } from 'express'
import { query } from '../config/db'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const reportsRouter = Router()
reportsRouter.use(authenticate)

// Generate an outgoing-inspection report for a batch
reportsRouter.get('/batch/:batchId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = Number(req.params.batchId)
    const batch = await query(
      `SELECT b.*, p.model, p.name AS product_name, p.description, c.name AS category_name, s.name AS supplier_name
       FROM batches b JOIN products p ON b.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE b.id = $1`,
      [batchId]
    )
    if (!batch.length) throw new AppError(404, '批次不存在')
    const records = await query(
      `SELECT r.*, u.name AS inspector_name
       FROM records r LEFT JOIN users u ON r.inspector_id = u.id
       WHERE r.batch_id = $1 ORDER BY r.detected_at`,
      [batchId]
    )
    const total = records.length
    const pass = records.filter((r: any) => r.result === 'pass').length
    const fail = total - pass
    const nc = await query(
      `SELECT n.*, i.name AS item_name, i.unit
       FROM nonconforming n JOIN records r ON n.record_id = r.id
       LEFT JOIN detection_items i ON n.item_id = i.id
       WHERE r.batch_id = $1`,
      [batchId]
    )
    const rate = total ? Math.round((pass / total) * 1000) / 10 : 0
    res.json({
      batch: batch[0],
      summary: { total, pass, fail, passRate: rate },
      records,
      nonconforming: nc,
      conclusion: fail === 0 ? '合格，准予出厂' : `不合格 ${fail} 条，需处置后复检`,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) { next(e) }
})
