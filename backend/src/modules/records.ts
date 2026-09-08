import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../config/db'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { judgeMeasurement, aggregateResult } from '../lib/judge'
import { writeLog } from '../lib/logger'

export const recordsRouter = Router()
recordsRouter.use(authenticate)

interface StdMap {
  [itemId: number]: { nominal: number | null; lower: number | null; upper: number | null }
}

async function loadStandards(productId: number): Promise<StdMap> {
  const rows = await query(
    'SELECT item_id, nominal, lower_bound, upper_bound FROM standards WHERE product_id = $1',
    [productId]
  )
  const map: StdMap = {}
  for (const r of rows) {
    map[r.item_id] = {
      nominal: r.nominal == null ? null : Number(r.nominal),
      lower: r.lower_bound == null ? null : Number(r.lower_bound),
      upper: r.upper_bound == null ? null : Number(r.upper_bound),
    }
  }
  return map
}

/**
 * Create a record together with its measurement results.
 * Each result is judged against the product's detection standard; the overall
 * record verdict (pass/fail) is aggregated, and unqualified items automatically
 * generate nonconforming records.
 */
async function createRecordWithResults(
  input: {
    task_id?: number | null
    product_id: number
    batch_id?: number | null
    inspector_id: number
    detected_at?: string
    env_note?: string | null
    results: { item_id: number; value: number | null }[]
  }
) {
  const stdMap = await loadStandards(input.product_id)
  const judged: boolean[] = []

  // First insert the record row
  const rec = await query(
    `INSERT INTO records (record_no, task_id, product_id, batch_id, inspector_id, detected_at, status, result, env_note)
     VALUES ($1,$2,$3,$4,$5,$6,'待审核','pending',$7) RETURNING *`,
    [
      `R${Date.now()}${Math.floor(Math.random() * 1000)}`,
      input.task_id ?? null,
      input.product_id,
      input.batch_id ?? null,
      input.inspector_id,
      input.detected_at ?? new Date().toISOString(),
      input.env_note ?? null,
    ]
  )
  const record = rec[0]

  for (const r of input.results) {
    const std = stdMap[r.item_id]
    let qualified: boolean | null = null
    let deviation: number | null = null
    if (std && r.value != null && !Number.isNaN(r.value)) {
      const jr = judgeMeasurement({
        value: r.value,
        nominal: std.nominal,
        lowerBound: std.lower,
        upperBound: std.upper,
      })
      qualified = jr.qualified
      deviation = jr.deviation
      judged.push(jr.qualified)
    }
    const ins = await query(
      `INSERT INTO results (record_id, item_id, value, qualified, deviation) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [record.id, r.item_id, r.value, qualified, deviation]
    )
    // Auto open a nonconforming record for unqualified measurements
    if (qualified === false) {
      await query(
        `INSERT INTO nonconforming (record_id, item_id, defect_level, phenomenon, status)
         VALUES ($1,$2,'一般','检测值超出标准上下限','待处理')`,
        [record.id, r.item_id]
      )
    }
    void ins
  }

  const verdict = aggregateResult(judged)
  await query('UPDATE records SET result = $1 WHERE id = $2', [verdict, record.id])
  record.result = verdict
  return record
}

const resultItemSchema = z.object({
  item_id: z.number().int(),
  value: z.number().nullable(),
})
const createSchema = z.object({
  task_id: z.number().int().nullable().optional(),
  product_id: z.number().int(),
  batch_id: z.number().int().nullable().optional(),
  inspector_id: z.number().int().optional(),
  detected_at: z.string().optional(),
  env_note: z.string().nullable().optional(),
  results: z.array(resultItemSchema).min(1),
})

recordsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = createSchema.parse(req.body)
    const inspectorId = b.inspector_id ?? req.user!.userId
    const record = await createRecordWithResults({
      task_id: b.task_id,
      product_id: b.product_id,
      batch_id: b.batch_id,
      inspector_id: inspectorId,
      detected_at: b.detected_at,
      env_note: b.env_note,
      results: b.results,
    })
    const verdictLabel = record.result === 'pass' ? '合格' : record.result === 'fail' ? '不合格' : '待判定'
    await writeLog(req.user!.userId, 'record.create', `录入检测记录 ${record.record_no}，判定：${verdictLabel}`)
    res.status(201).json(record)
  } catch (e) { next(e) }
})

// Bulk import (simulates Excel / device upload)
const bulkSchema = z.object({
  records: z.array(
    z.object({
      product_id: z.number().int(),
      batch_id: z.number().int().nullable().optional(),
      task_id: z.number().int().nullable().optional(),
      inspector_id: z.number().int().optional(),
      detected_at: z.string().optional(),
      results: z.array(resultItemSchema).min(1),
    })
  ).min(1),
})
recordsRouter.post('/bulk', async (req, res, next) => {
  try {
    const b = bulkSchema.parse(req.body)
    const created = []
    for (const item of b.records) {
      created.push(
        await createRecordWithResults({
          task_id: item.task_id,
          product_id: item.product_id,
          batch_id: item.batch_id,
          inspector_id: item.inspector_id ?? req.user!.userId,
          detected_at: item.detected_at,
          results: item.results,
        })
      )
    }
    res.status(201).json({ count: created.length, records: created })
  } catch (e) { next(e) }
})

// List records with filters
recordsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, batchId, result, inspectorId, from, to } = req.query as Record<string, string>
    const wheres: string[] = []
    const params: any[] = []
    let i = 1
    if (productId) { wheres.push(`r.product_id = $${i++}`); params.push(Number(productId)) }
    if (batchId) { wheres.push(`r.batch_id = $${i++}`); params.push(Number(batchId)) }
    if (result) { wheres.push(`r.result = $${i++}`); params.push(result) }
    if (inspectorId) { wheres.push(`r.inspector_id = $${i++}`); params.push(Number(inspectorId)) }
    if (from) { wheres.push(`r.detected_at >= $${i++}`); params.push(from) }
    if (to) { wheres.push(`r.detected_at <= $${i++}`); params.push(to) }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''
    const rows = await query(
      `SELECT r.*, p.model AS product_model, p.name AS product_name, b.batch_no,
              u.name AS inspector_name,
              (SELECT count(*) FROM results rs WHERE rs.record_id = r.id AND rs.qualified = false) AS fail_items
       FROM records r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN batches b ON r.batch_id = b.id
       LEFT JOIN users u ON r.inspector_id = u.id
       ${where} ORDER BY r.detected_at DESC LIMIT 500`,
      params
    )
    res.json(rows)
  } catch (e) { next(e) }
})

recordsRouter.get('/:id', async (req, res, next) => {
  try {
    const recRows = await query(
      `SELECT r.*, p.model AS product_model, p.name AS product_name, b.batch_no, u.name AS inspector_name
       FROM records r LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN batches b ON r.batch_id = b.id LEFT JOIN users u ON r.inspector_id = u.id
       WHERE r.id = $1`,
      [Number(req.params.id)]
    )
    if (!recRows.length) throw new AppError(404, '记录不存在')
    const results = await query(
      `SELECT res.*, i.code AS item_code, i.name AS item_name, i.unit, i.group_name,
              s.nominal, s.lower_bound, s.upper_bound
       FROM results res JOIN detection_items i ON res.item_id = i.id
       LEFT JOIN standards s ON s.product_id = $2 AND s.item_id = i.id
       WHERE res.record_id = $1 ORDER BY i.group_name, i.code`,
      [Number(req.params.id), recRows[0].product_id]
    )
    res.json({ record: recRows[0], results })
  } catch (e) { next(e) }
})

// Review (qc_manager): move 待审核 -> 已完成
recordsRouter.patch('/:id/review', async (req, res, next) => {
  try {
    const rows = await query(
      `UPDATE records SET status = '已完成' WHERE id = $1 RETURNING *`,
      [Number(req.params.id)]
    )
    if (!rows.length) throw new AppError(404, '记录不存在')
    await writeLog(req.user!.userId, 'record.review', `审核检测记录 ${rows[0].record_no ?? '#' + rows[0].id}，结论：已完成`)
    res.json(rows[0])
  } catch (e) { next(e) }
})

recordsRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM records WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})
