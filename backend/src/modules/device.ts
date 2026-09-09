import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../config/db'
import { env } from '../config/env'
import { AppError } from '../middleware/errorHandler'
import { createRecordWithResults } from './records'

export const deviceRouter = Router()

/**
 * Detection equipment authenticates with a shared key instead of a user token.
 * Header: X-Device-Key: <DEVICE_API_KEY>
 */
function requireDeviceKey(req: Request, _res: Response, next: NextFunction) {
  const key = req.header('x-device-key') ?? ''
  if (!key || key !== env.DEVICE_API_KEY) throw new AppError(401, '设备密钥无效')
  next()
}

const ingestSchema = z.object({
  device_code: z.string().min(1).max(40),
  model: z.string().min(1).max(40),
  batch_no: z.string().max(40).optional(),
  detected_at: z.string().optional(),
  env_note: z.string().optional(),
  // item code or item name -> measured value, e.g. { "LEAK": 0.18, "水温": 38.2 }
  values: z.record(z.number()),
})

deviceRouter.get('/schema', requireDeviceKey, async (_req, res, next) => {
  try {
    const items = await query('SELECT code, name, unit, group_name FROM detection_items ORDER BY group_name, code')
    const products = await query('SELECT model, name FROM products ORDER BY model')
    res.json({ items, products })
  } catch (e) { next(e) }
})

/** Test-bench / inline device pushes one finished measurement set. */
deviceRouter.post('/ingest', requireDeviceKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = ingestSchema.parse(req.body)

    const product = await query('SELECT id FROM products WHERE model = $1', [b.model])
    if (!product.length) throw new AppError(404, `未找到产品型号 ${b.model}`)

    let batchId: number | null = null
    if (b.batch_no) {
      const bt = await query('SELECT id FROM batches WHERE batch_no = $1', [b.batch_no])
      if (bt.length) batchId = bt[0].id
    }

    const items = await query('SELECT id, code, name FROM detection_items')
    const results: { item_id: number; value: number | null }[] = []
    const unknown: string[] = []
    for (const [key, value] of Object.entries(b.values)) {
      const item = items.find((i: any) => i.code === key || i.name === key)
      if (!item) { unknown.push(key); continue }
      results.push({ item_id: item.id, value })
    }
    if (!results.length) throw new AppError(400, '未匹配到任何检测项')

    const record = await createRecordWithResults({
      product_id: product[0].id,
      batch_id: batchId,
      inspector_id: null,
      detected_at: b.detected_at ?? new Date().toISOString(),
      env_note: b.env_note ?? `设备 ${b.device_code} 自动采集`,
      results,
    })

    res.status(201).json({
      record_id: record.id,
      record_no: record.record_no,
      result: record.result,
      unknown_items: unknown,
    })
  } catch (e) { next(e) }
})
