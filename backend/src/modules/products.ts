import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { query } from '../config/db'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const categoriesRouter = Router()
export const suppliersRouter = Router()
export const productsRouter = Router()
export const batchesRouter = Router()

categoriesRouter.use(authenticate)
suppliersRouter.use(authenticate)
productsRouter.use(authenticate)
batchesRouter.use(authenticate)

// ---------------- Categories ----------------
categoriesRouter.get('/', async (_req, res) => {
  res.json(await query('SELECT * FROM categories ORDER BY code'))
})
const catSchema = z.object({ code: z.string().min(1).max(20), name: z.string().min(1).max(50) })
categoriesRouter.post('/', async (req, res, next) => {
  try {
    const b = catSchema.parse(req.body)
    const r = await query('INSERT INTO categories (code,name) VALUES ($1,$2) RETURNING *', [b.code, b.name])
    res.status(201).json(r[0])
  } catch (e) { next(e) }
})
categoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})

// ---------------- Suppliers ----------------
suppliersRouter.get('/', async (_req, res) => {
  res.json(await query('SELECT * FROM suppliers ORDER BY code'))
})
const supSchema = z.object({ code: z.string().min(1).max(20), name: z.string().min(1).max(80), contact: z.string().max(50).optional() })
suppliersRouter.post('/', async (req, res, next) => {
  try {
    const b = supSchema.parse(req.body)
    const r = await query('INSERT INTO suppliers (code,name,contact) VALUES ($1,$2,$3) RETURNING *', [b.code, b.name, b.contact ?? null])
    res.status(201).json(r[0])
  } catch (e) { next(e) }
})
suppliersRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM suppliers WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})

// ---------------- Products ----------------
productsRouter.get('/', async (_req, res) => {
  const rows = await query(`
    SELECT p.*, c.name AS category_name, s.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY p.model
  `)
  res.json(rows)
})
const prodSchema = z.object({
  model: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  category_id: z.number().int().optional(),
  supplier_id: z.number().int().optional(),
  description: z.string().optional(),
})
productsRouter.post('/', async (req, res, next) => {
  try {
    const b = prodSchema.parse(req.body)
    const r = await query(
      `INSERT INTO products (model,name,category_id,supplier_id,description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.model, b.name, b.category_id ?? null, b.supplier_id ?? null, b.description ?? null]
    )
    res.status(201).json(r[0])
  } catch (e) { next(e) }
})
productsRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM products WHERE id = $1', [Number(req.params.id)])
    if (!r.length) throw new AppError(404, '产品不存在')
    res.json(r[0])
  } catch (e) { next(e) }
})
productsRouter.patch('/:id', async (req, res, next) => {
  try {
    const b = prodSchema.partial().parse(req.body)
    const sets: string[] = []
    const params: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(b)) {
      sets.push(`${k} = $${i++}`)
      params.push(v ?? null)
    }
    params.push(Number(req.params.id))
    const r = await query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params)
    res.json(r[0])
  } catch (e) { next(e) }
})
productsRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM products WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})

// ---------------- Batches ----------------
batchesRouter.get('/', async (req, res) => {
  const productId = req.query.productId ? Number(req.query.productId) : null
  const rows = productId
    ? await query('SELECT * FROM batches WHERE product_id = $1 ORDER BY batch_no DESC', [productId])
    : await query('SELECT * FROM batches ORDER BY batch_no DESC')
  res.json(rows)
})
const batchSchema = z.object({
  batch_no: z.string().min(1).max(40),
  product_id: z.number().int(),
  quantity: z.number().int().min(0).default(0),
  produce_date: z.string().optional(),
})
batchesRouter.post('/', async (req, res, next) => {
  try {
    const b = batchSchema.parse(req.body)
    const r = await query(
      `INSERT INTO batches (batch_no,product_id,quantity,produce_date) VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.batch_no, b.product_id, b.quantity, b.produce_date ?? null]
    )
    res.status(201).json(r[0])
  } catch (e) { next(e) }
})
batchesRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM batches WHERE id = $1', [Number(req.params.id)])
    res.json({ message: 'deleted' })
  } catch (e) { next(e) }
})
