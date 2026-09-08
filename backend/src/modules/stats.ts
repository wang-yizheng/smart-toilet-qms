import { Router, Request, Response, NextFunction } from 'express'
import { query } from '../config/db'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const statsRouter = Router()
statsRouter.use(authenticate)

async function num(sql: string, params: any[] = []): Promise<number> {
  const r = await query(sql, params)
  return r.length ? Number(r[0].count) : 0
}

// Overall KPI cards
statsRouter.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const total = await num('SELECT count(*) FROM records')
    const pass = await num("SELECT count(*) FROM records WHERE result = 'pass'")
    const fail = await num("SELECT count(*) FROM records WHERE result = 'fail'")
    const openTasks = await num("SELECT count(*) FROM tasks WHERE status NOT IN ('已完成','已终止')")
    const openNc = await num("SELECT count(*) FROM nonconforming WHERE status <> '已闭环'")
    const rate = total ? Math.round((pass / total) * 1000) / 10 : 0
    res.json({ total, pass, fail, passRate: rate, openTasks, openNc })
  } catch (e) { next(e) }
})

// Daily pass-rate trend
statsRouter.get('/pass-rate-trend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 180)
    const rows = await query(
      `SELECT to_char(detected_at, 'YYYY-MM-DD') AS day,
              count(*)::int AS total,
              count(*) FILTER (WHERE result = 'pass')::int AS pass
       FROM records
       WHERE detected_at >= now() - ($1 || ' days')::interval
       GROUP BY day ORDER BY day`,
      [String(days)]
    )
    const data = rows.map((r) => ({
      day: r.day,
      total: Number(r.total),
      pass: Number(r.pass),
      fail: Number(r.total) - Number(r.pass),
      rate: Number(r.total) ? Math.round((Number(r.pass) / Number(r.total)) * 1000) / 10 : 0,
    }))
    res.json(data)
  } catch (e) { next(e) }
})

// Defect Pareto (nonconforming count by detection item)
statsRouter.get('/defect-pareto', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT i.name AS item, i.unit, count(*)::int AS count
       FROM nonconforming n LEFT JOIN detection_items i ON n.item_id = i.id
       GROUP BY i.name, i.unit ORDER BY count DESC LIMIT 12`
    )
    const total = rows.reduce((s, r) => s + Number(r.count), 0)
    let acc = 0
    const data = rows.map((r) => {
      acc += Number(r.count)
      return {
        item: r.item,
        unit: r.unit,
        count: Number(r.count),
        cumulative: Math.round((acc / (total || 1)) * 1000) / 10,
      }
    })
    res.json(data)
  } catch (e) { next(e) }
})

// Pass-rate comparison by product model
statsRouter.get('/model-comparison', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT p.model, p.name,
              count(*)::int AS total,
              count(*) FILTER (WHERE r.result = 'pass')::int AS pass
       FROM records r JOIN products p ON r.product_id = p.id
       GROUP BY p.model, p.name ORDER BY total DESC LIMIT 12`
    )
    res.json(
      rows.map((r) => ({
        model: r.model,
        name: r.name,
        total: Number(r.total),
        pass: Number(r.pass),
        rate: Number(r.total) ? Math.round((Number(r.pass) / Number(r.total)) * 1000) / 10 : 0,
      }))
    )
  } catch (e) { next(e) }
})

// SPC control chart data + Cpk for a given product & item
statsRouter.get('/spc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = Number(req.query.productId)
    const itemId = Number(req.query.itemId)
    if (!productId || !itemId) throw new AppError(400, '缺少 productId 或 itemId')

    const stdRows = await query(
      'SELECT nominal, lower_bound, upper_bound FROM standards WHERE product_id = $1 AND item_id = $2',
      [productId, itemId]
    )
    if (!stdRows.length) throw new AppError(404, '该产品未配置此检测项标准')
    const std = stdRows[0]
    const LSL = std.lower_bound == null ? null : Number(std.lower_bound)
    const USL = std.upper_bound == null ? null : Number(std.upper_bound)
    const nominal = std.nominal == null ? null : Number(std.nominal)

    const rows = await query(
      `SELECT res.value, r.detected_at
       FROM results res JOIN records r ON res.record_id = r.id
       WHERE res.item_id = $1 AND r.product_id = $2 AND res.value IS NOT NULL
       ORDER BY r.detected_at`,
      [itemId, productId]
    )
    const values = rows.map((r) => Number(r.value))
    const points = rows.map((r, idx) => ({ idx: idx + 1, time: r.detected_at, value: Number(r.value) }))

    const n = values.length
    const mean = n ? values.reduce((a, b) => a + b, 0) / n : 0
    const variance = n ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0
    const stddev = Math.sqrt(variance)
    const UCL = mean + 3 * stddev
    const LCL = mean - 3 * stddev

    let cpk = null as number | null
    if (n && stddev > 0 && LSL != null && USL != null) {
      cpk = Math.min((USL - mean) / (3 * stddev), (mean - LSL) / (3 * stddev))
      cpk = Math.round(cpk * 1000) / 1000
    }

    res.json({
      points,
      stats: {
        n,
        mean: round(mean),
        stddev: round(stddev),
        UCL: round(UCL),
        LCL: round(LCL),
        USL,
        LSL,
        nominal,
        cpk,
      },
    })
  } catch (e) { next(e) }
})

function round(x: number): number {
  return Math.round(x * 10000) / 10000
}
