import { query } from '../config/db'
import { judgeMeasurement, aggregateResult } from '../lib/judge'
import { ensureSchema, ensureAdminUsers } from './init'

/* ----------------------------- seeded RNG ----------------------------- */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261020)
const randn = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd())
const round2 = (n: number) => Math.round(n * 100) / 100
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]

/* --------------------------- detection items --------------------------- */
interface ItemDef {
  code: string
  name: string
  unit: string
  group: string
  nominal: number | null
  lower: number | null
  upper: number | null
}
const ITEMS: ItemDef[] = [
  { code: 'LEAK', name: '泄漏电流', unit: 'mA', group: '电气安全', nominal: 0.15, lower: null, upper: 0.25 },
  { code: 'INSUL', name: '绝缘电阻', unit: 'MΩ', group: '电气安全', nominal: 20, lower: 10, upper: null },
  { code: 'GROUND', name: '接地电阻', unit: 'Ω', group: '电气安全', nominal: 0.05, lower: null, upper: 0.1 },
  { code: 'STBY', name: '待机功率', unit: 'W', group: '电气安全', nominal: 1.2, lower: null, upper: 2.0 },
  { code: 'WTEMP', name: '水温', unit: '℃', group: '冲洗性能', nominal: 38, lower: 35, upper: 41 },
  { code: 'FLOW', name: '冲洗流量', unit: 'L/min', group: '冲洗性能', nominal: 0.5, lower: 0.4, upper: 0.7 },
  { code: 'FDUR', name: '冲洗时间', unit: 's', group: '冲洗性能', nominal: 40, lower: 30, upper: 60 },
  { code: 'PRESS', name: '进水压力', unit: 'MPa', group: '冲洗性能', nominal: 0.14, lower: 0.1, upper: 0.2 },
  { code: 'STEMP', name: '座圈温度', unit: '℃', group: '座圈舒适', nominal: 35, lower: 32, upper: 38 },
  { code: 'SHEAT', name: '座圈加热时间', unit: 'min', group: '座圈舒适', nominal: 5, lower: 3, upper: 8 },
  { code: 'DTRY', name: '烘干温度', unit: '℃', group: '座圈舒适', nominal: 40, lower: 35, upper: 45 },
  { code: 'SEAL', name: '水封深度', unit: 'mm', group: '水封', nominal: 55, lower: 50, upper: 65 },
  { code: 'REPL', name: '污水置换率', unit: '%', group: '水封', nominal: 95, lower: 90, upper: 100 },
]

const CATEGORIES = [
  { code: 'C01', name: '一体式智能马桶' },
  { code: 'C02', name: '分体式智能马桶' },
  { code: 'C03', name: '智能马桶盖' },
  { code: 'C04', name: '商用智能马桶' },
  { code: 'C05', name: '儿童智能马桶' },
  { code: 'C06', name: '壁挂式智能马桶' },
]
const SUPPLIERS = [
  { code: 'S01', name: '恒洁卫浴', contact: '13800000001' },
  { code: 'S02', name: '九牧厨卫', contact: '13800000002' },
  { code: 'S03', name: '箭牌家居', contact: '13800000003' },
  { code: 'S04', name: '松下家电', contact: '13800000004' },
  { code: 'S05', name: 'TOTO卫洗丽', contact: '13800000005' },
]
const PRODUCTS = [
  { model: 'ZN-2001', name: '睿享一体式智能马桶', cat: 'C01', sup: 'S01' },
  { model: 'ZN-2002', name: '云镜分体式智能马桶', cat: 'C02', sup: 'S02' },
  { model: 'ZN-2003', name: '净界智能马桶盖', cat: 'C03', sup: 'S04' },
  { model: 'ZN-2004', name: '商旅商用智能马桶', cat: 'C04', sup: 'S03' },
  { model: 'ZN-2005', name: '童趣儿童智能马桶', cat: 'C05', sup: 'S01' },
  { model: 'ZN-2006', name: '壁尚壁挂式智能马桶', cat: 'C06', sup: 'S05' },
  { model: 'ZN-2007', name: '臻品一体式智能马桶', cat: 'C01', sup: 'S02' },
  { model: 'ZN-2008', name: '轻奢分体式智能马桶', cat: 'C02', sup: 'S03' },
  { model: 'ZN-2009', name: '畅洁智能马桶盖', cat: 'C03', sup: 'S04' },
  { model: 'ZN-2010', name: '公享商用智能马桶', cat: 'C04', sup: 'S01' },
  { model: 'ZN-2011', name: '萌宝儿童智能马桶', cat: 'C05', sup: 'S05' },
  { model: 'ZN-2012', name: '悬浮壁挂式智能马桶', cat: 'C06', sup: 'S02' },
]

const DEFECT_LEVELS = ['轻微', '一般', '严重']
const DISPOSITIONS = ['返工', '返修', '让步接收', '报废']
const TASK_TYPES = ['出厂', '过程', '型式']
const TASK_STATUS = ['待派工', '待检测', '检测中', '待审核', '已完成', '已终止']

function genValue(item: ItemDef, forceBad: boolean): number {
  let v: number
  if (item.lower != null && item.upper != null) {
    const mid = (item.lower + item.upper) / 2
    const span = item.upper - item.lower
    v = mid + randn() * span * 0.12
    if (forceBad) v += rnd() > 0.5 ? span * 0.25 : -span * 0.25
  } else if (item.lower != null) {
    v = item.lower + Math.abs(randn()) * item.lower * 0.25 + 0.5
    if (forceBad) v = item.lower - Math.abs(randn()) * item.lower * 0.2 - 0.5
  } else {
    v = item.upper! * (0.6 + Math.abs(randn()) * 0.15)
    if (forceBad) v = item.upper! * (1.1 + Math.abs(randn()) * 0.15)
  }
  return round2(v)
}

export async function seedIfEmpty(force = false) {
  const existing = await query('SELECT count(*) FROM products')
  if (!force && Number(existing[0].count) > 0) {
    console.log('Demo data already present, skipping seed.')
    return
  }
  await ensureSchema()
  await ensureAdminUsers()
  console.log('Seeding demo data...')

  // categories & suppliers
  for (const c of CATEGORIES) await query('INSERT INTO categories (code,name) VALUES ($1,$2)', [c.code, c.name])
  for (const s of SUPPLIERS) await query('INSERT INTO suppliers (code,name,contact) VALUES ($1,$2,$3)', [s.code, s.name, s.contact])

  // detection items
  const itemIds: number[] = []
  for (const it of ITEMS) {
    const r = await query(
      'INSERT INTO detection_items (code,name,unit,group_name) VALUES ($1,$2,$3,$4) RETURNING id',
      [it.code, it.name, it.unit, it.group]
    )
    itemIds.push(r[0].id)
  }

  // products + standards (bind all items)
  const productIds: number[] = []
  for (const p of PRODUCTS) {
    const c = await query('SELECT id FROM categories WHERE code=$1', [p.cat])
    const s = await query('SELECT id FROM suppliers WHERE code=$1', [p.sup])
    const r = await query(
      'INSERT INTO products (model,name,category_id,supplier_id,description) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [p.model, p.name, c[0].id, s[0].id, `${p.name}，集冲洗、座圈加热、烘干于一体，符合 GB/T 34549 标准。`]
    )
    const pid = r[0].id
    productIds.push(pid)
    for (let i = 0; i < ITEMS.length; i++) {
      const it = ITEMS[i]
      await query(
        'INSERT INTO standards (product_id,item_id,nominal,lower_bound,upper_bound,method) VALUES ($1,$2,$3,$4,$5,$6)',
        [pid, itemIds[i], it.nominal, it.lower, it.upper, `${it.name}按出厂检验规范测定`]
      )
    }
  }

  // inspectors (extra demo accounts)
  const inspectorIds: number[] = []
  const existingInspectors = await query("SELECT id FROM users WHERE role='inspector'")
  for (const u of existingInspectors) inspectorIds.push(u.id)
  for (let i = 1; i <= 4; i++) {
    const name = `检测员${i}`
    const uname = `insp${i}`
    const exists = await query('SELECT id FROM users WHERE username=$1', [uname])
    if (exists.length) { inspectorIds.push(exists[0].id); continue }
    const hash = await import('bcryptjs').then((b) => b.default.hash('insp123456', 10))
    const r = await query(
      'INSERT INTO users (username,password_hash,name,role,status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [uname, hash, name, 'inspector', 'active']
    )
    inspectorIds.push(r[0].id)
  }

  // batches (2-3 per product)
  const batchIds: number[] = []
  const batchesMeta: { id: number; product: number }[] = []
  for (let pi = 0; pi < productIds.length; pi++) {
    const count = 2 + Math.floor(rnd() * 2)
    for (let b = 0; b < count; b++) {
      const r = await query(
        'INSERT INTO batches (batch_no,product_id,quantity,produce_date) VALUES ($1,$2,$3,$4) RETURNING id',
        [`B${PRODUCTS[pi].model}-${String(b + 1).padStart(2, '0')}`, productIds[pi], 200 + Math.floor(rnd() * 800), randomDate(120)]
      )
      batchIds.push(r[0].id)
      batchesMeta.push({ id: r[0].id, product: productIds[pi] })
    }
  }

  // tasks
  let taskSeq = 1
  for (let i = 0; i < 42; i++) {
    const bm = pick(batchesMeta)
    const type = pick(TASK_TYPES)
    const status = pick(TASK_STATUS)
    const assignee = status === '待派工' ? null : pick(inspectorIds)
    await query(
      `INSERT INTO tasks (task_no,product_id,batch_id,type,status,assignee_id,plan_date,due_date,created_by,note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        `T${String(taskSeq++).padStart(4, '0')}`,
        bm.product,
        bm.id,
        type,
        status,
        assignee,
        randomDate(100),
        randomDate(60),
        1,
        `${type}检验任务`,
      ]
    )
  }

  // records (hundreds)
  const RECORD_COUNT = 360
  const ncRows: any[] = []
  for (let i = 0; i < RECORD_COUNT; i++) {
    const bm = pick(batchesMeta)
    const inspector = pick(inspectorIds)
    const detectedAt = randomDateTime(90)
    const rec = await query(
      `INSERT INTO records (record_no,task_id,product_id,batch_id,inspector_id,detected_at,status,result,env_note)
       VALUES ($1,NULL,$2,$3,$4,$5,$6,'pending',$7) RETURNING id`,
      [
        `R${String(i + 1).padStart(5, '0')}`,
        bm.product,
        bm.id,
        inspector,
        detectedAt,
        rnd() > 0.85 ? '待审核' : '已完成',
        '车间环境温度 23℃，湿度 55%',
      ]
    )
    const recordId = rec[0].id
    const makeBad = rnd() < 0.1 // ~10% records have a defect
    const badIdx = makeBad ? Math.floor(rnd() * ITEMS.length) : -1
    const judged: boolean[] = []
    for (let j = 0; j < ITEMS.length; j++) {
      const it = ITEMS[j]
      const value = genValue(it, j === badIdx)
      const jr = judgeMeasurement({ value, nominal: it.nominal, lowerBound: it.lower, upperBound: it.upper })
      const deviation = jr.deviation == null ? null : round2(jr.deviation)
      await query(
        'INSERT INTO results (record_id,item_id,value,qualified,deviation) VALUES ($1,$2,$3,$4,$5)',
        [recordId, itemIds[j], value, jr.qualified, deviation]
      )
      if (jr.qualified !== null) judged.push(jr.qualified)
      if (jr.qualified === false) {
        ncRows.push({
          record_id: recordId,
          item_id: itemIds[j],
          defect_level: pick(DEFECT_LEVELS),
          disposition: '待处理',
          status: '待处理',
        })
      }
    }
    const verdict = aggregateResult(judged)
    await query('UPDATE records SET result=$1 WHERE id=$2', [verdict, recordId])
  }

  // nonconforming rows (batch insert)
  for (const nc of ncRows) {
    await query(
      `INSERT INTO nonconforming (record_id,item_id,defect_level,disposition,status)
       VALUES ($1,$2,$3,$4,$5)`,
      [nc.record_id, nc.item_id, nc.defect_level, nc.disposition, nc.status]
    )
  }

  // announcements
  await query(
    "INSERT INTO announcements (title,content,pinned,created_by) VALUES ($1,$2,$3,$4)",
    ['质量月报发布通知', '本月出厂一次交验合格率已更新，请各产线关注不良项柏拉图。', true, 2]
  )
  await query(
    "INSERT INTO announcements (title,content,pinned,created_by) VALUES ($1,$2,$3,$4)",
    ['检测标准变更', '水温判定下限由 34℃ 调整为 35℃，即日起执行。', false, 2]
  )

  // operation logs (audit trail demo data)
  await seedOperationLogsIfEmpty(force)

  console.log(`Seed complete: ${PRODUCTS.length} products, ${batchesMeta.length} batches, ${RECORD_COUNT} records, ${ncRows.length} nonconforming.`)
}

/* --------------------------- operation logs --------------------------- */
const LOG_TOTAL = 180

const LOG_TEMPLATES: { action: string; weight: number; detail: () => string }[] = [
  { action: 'login', weight: 26, detail: () => '登录系统' },
  { action: 'record.create', weight: 22, detail: () => `录入检测记录 R${String(1 + Math.floor(rnd() * 360)).padStart(5, '0')}，判定：${rnd() < 0.1 ? '不合格' : '合格'}` },
  { action: 'record.review', weight: 14, detail: () => `审核检测记录 R${String(1 + Math.floor(rnd() * 360)).padStart(5, '0')}，结论：已完成` },
  { action: 'task.status', weight: 12, detail: () => `任务 T${String(1 + Math.floor(rnd() * 42)).padStart(4, '0')} 状态变更为「${pick(TASK_STATUS)}」` },
  { action: 'task.create', weight: 10, detail: () => `创建${pick(TASK_TYPES)}检测任务 T${String(1 + Math.floor(rnd() * 42)).padStart(4, '0')}` },
  { action: 'nc.dispose', weight: 8, detail: () => `不合格品 #${1 + Math.floor(rnd() * 20)} 处置：${pick(DISPOSITIONS)}，状态：${pick(['待处理', '审批中', '已闭环'])}` },
  { action: 'standard.update', weight: 4, detail: () => `调整检测标准：${pick(ITEMS).name} 判定阈值` },
  { action: 'announcement.create', weight: 2, detail: () => `发布公告：${pick(['质量月报发布通知', '检测标准变更', '产线整改要求'])}` },
  { action: 'user.update', weight: 2, detail: () => `修改用户 #${1 + Math.floor(rnd() * 8)}：status` },
]

/**
 * Fill the audit trail with historical entries for the demo.
 * Runs independently from the business seed so an existing database also gets logs.
 */
export async function seedOperationLogsIfEmpty(force = false) {
  const existing = await query('SELECT count(*) FROM operation_logs')
  if (!force && Number(existing[0].count) > 0) return 0

  const users = await query(`SELECT id FROM users WHERE role IN ('admin','qc_manager','inspector')`)
  const actorIds: number[] = users.map((u: any) => u.id)
  if (!actorIds.length) return 0

  const weightSum = LOG_TEMPLATES.reduce((s, t) => s + t.weight, 0)
  for (let i = 0; i < LOG_TOTAL; i++) {
    let r = rnd() * weightSum
    let tpl = LOG_TEMPLATES[0]
    for (const t of LOG_TEMPLATES) {
      r -= t.weight
      if (r <= 0) { tpl = t; break }
    }
    // account management actions belong to the administrator
    const userId = tpl.action.startsWith('user.') ? actorIds[0] : pick(actorIds)
    const at = new Date(Date.now() - Math.floor(rnd() * 30 * 86400000) - Math.floor(rnd() * 86400000))
    await query(
      'INSERT INTO operation_logs (user_id, action, detail, created_at) VALUES ($1,$2,$3,$4)',
      [userId, tpl.action, tpl.detail(), at.toISOString()]
    )
  }
  console.log(`Seeded ${LOG_TOTAL} operation log entries.`)
  return LOG_TOTAL
}

function randomDate(daysAgo: number): string {
  const d = new Date(Date.now() - Math.floor(rnd() * daysAgo) * 86400000)
  return d.toISOString().slice(0, 10)
}
function randomDateTime(daysAgo: number): string {
  const d = new Date(Date.now() - Math.floor(rnd() * daysAgo) * 86400000 - Math.floor(rnd() * 86400000))
  return d.toISOString()
}

// Run directly: pnpm db:seed
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force')
  seedIfEmpty(force)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err)
      process.exit(1)
    })
}
