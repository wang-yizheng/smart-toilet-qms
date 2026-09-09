import { Router, Request, Response, NextFunction } from 'express'
import ExcelJS from 'exceljs'
import { query } from '../config/db'
import { authenticate } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'
import { writeLog } from '../lib/logger'

export const reportsRouter = Router()
reportsRouter.use(authenticate)

interface BatchReport {
  batch: any
  summary: { total: number; pass: number; fail: number; passRate: number }
  records: any[]
  nonconforming: any[]
  conclusion: string
  generatedAt: string
}

const RESULT_LABEL: Record<string, string> = { pass: '合格', fail: '不合格', pending: '待判定' }

/** Build the outgoing-inspection report for a batch. */
async function buildBatchReport(batchId: number): Promise<BatchReport> {
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

  const nonconforming = await query(
    `SELECT n.*, i.name AS item_name, i.unit, r.record_no
     FROM nonconforming n JOIN records r ON n.record_id = r.id
     LEFT JOIN detection_items i ON n.item_id = i.id
     WHERE r.batch_id = $1`,
    [batchId]
  )

  return {
    batch: batch[0],
    summary: { total, pass, fail, passRate: total ? Math.round((pass / total) * 1000) / 10 : 0 },
    records,
    nonconforming,
    conclusion: fail === 0 ? '合格，准予出厂' : `不合格 ${fail} 条，需处置后复检`,
    generatedAt: new Date().toISOString(),
  }
}

// Report data (used by the on-screen preview)
reportsRouter.get('/batch/:batchId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await buildBatchReport(Number(req.params.batchId)))
  } catch (e) { next(e) }
})

/** Export the batch report as a spreadsheet file. */
reportsRouter.get('/batch/:batchId/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = Number(req.params.batchId)
    const report = await buildBatchReport(batchId)
    const b = report.batch

    // measurement detail for every record of this batch
    const detail = await query(
      `SELECT r.record_no, i.name AS item_name, i.unit, res.value, res.qualified, res.deviation,
              s.nominal, s.lower_bound, s.upper_bound
       FROM results res
       JOIN records r ON res.record_id = r.id
       JOIN detection_items i ON res.item_id = i.id
       LEFT JOIN standards s ON s.product_id = r.product_id AND s.item_id = i.id
       WHERE r.batch_id = $1
       ORDER BY r.record_no, i.group_name, i.code`,
      [batchId]
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = '智能马桶检测管理系统'
    wb.created = new Date()

    const addSheet = (name: string, columns: { header: string; key: string; width: number }[], rows: any[]) => {
      const ws = wb.addWorksheet(name)
      ws.columns = columns
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDDEBF7' },
      }
      rows.forEach((r) => ws.addRow(r))
      return ws
    }

    // 1) overview
    const ws = wb.addWorksheet('报告概况')
    ws.columns = [{ key: 'k', width: 22 }, { key: 'v', width: 46 }]
    const overview: [string, any][] = [
      ['批次号', b.batch_no],
      ['产品型号', b.model],
      ['产品名称', b.product_name],
      ['产品分类', b.category_name ?? '-'],
      ['供应商', b.supplier_name ?? '-'],
      ['批次数量', b.quantity],
      ['生产日期', b.produce_date ? String(b.produce_date).slice(0, 10) : '-'],
      ['检测记录数', report.summary.total],
      ['合格数', report.summary.pass],
      ['不合格数', report.summary.fail],
      ['一次交验合格率', `${report.summary.passRate}%`],
      ['检验结论', report.conclusion],
      ['报告生成时间', report.generatedAt.replace('T', ' ').slice(0, 19)],
    ]
    overview.forEach(([k, v]) => ws.addRow({ k, v: String(v ?? '-') }))
    ws.getColumn('k').font = { bold: true }

    // 2) records
    addSheet(
      '检测记录',
      [
        { header: '记录编号', key: 'record_no', width: 18 },
        { header: '检测时间', key: 'detected_at', width: 22 },
        { header: '检测员', key: 'inspector_name', width: 14 },
        { header: '判定结果', key: 'result', width: 12 },
        { header: '状态', key: 'status', width: 12 },
      ],
      report.records.map((r: any) => ({
        record_no: r.record_no,
        detected_at: String(r.detected_at).replace('T', ' ').slice(0, 19),
        inspector_name: r.inspector_name ?? '-',
        result: RESULT_LABEL[r.result] ?? r.result,
        status: r.status,
      }))
    )

    // 3) measurement detail
    addSheet(
      '检测明细',
      [
        { header: '记录编号', key: 'record_no', width: 18 },
        { header: '检测项目', key: 'item_name', width: 18 },
        { header: '单位', key: 'unit', width: 10 },
        { header: '实测值', key: 'value', width: 12 },
        { header: '标准值', key: 'nominal', width: 12 },
        { header: '下限', key: 'lower_bound', width: 12 },
        { header: '上限', key: 'upper_bound', width: 12 },
        { header: '偏差', key: 'deviation', width: 12 },
        { header: '判定', key: 'qualified', width: 10 },
      ],
      detail.map((d: any) => ({
        record_no: d.record_no,
        item_name: d.item_name,
        unit: d.unit ?? '',
        value: d.value,
        nominal: d.nominal,
        lower_bound: d.lower_bound,
        upper_bound: d.upper_bound,
        deviation: d.deviation,
        qualified: d.qualified === null ? '未判定' : d.qualified ? '合格' : '不合格',
      }))
    )

    // 4) nonconforming
    addSheet(
      '不合格项',
      [
        { header: '记录编号', key: 'record_no', width: 18 },
        { header: '不合格项目', key: 'item_name', width: 18 },
        { header: '等级', key: 'defect_level', width: 10 },
        { header: '现象', key: 'phenomenon', width: 30 },
        { header: '原因', key: 'cause', width: 30 },
        { header: '责任部门', key: 'responsibility_dept', width: 16 },
        { header: '处置方式', key: 'disposition', width: 14 },
        { header: '状态', key: 'status', width: 12 },
      ],
      report.nonconforming.map((n: any) => ({
        record_no: n.record_no,
        item_name: n.item_name ?? '-',
        defect_level: n.defect_level,
        phenomenon: n.phenomenon ?? '',
        cause: n.cause ?? '',
        responsibility_dept: n.responsibility_dept ?? '',
        disposition: n.disposition,
        status: n.status,
      }))
    )

    const buf = await wb.xlsx.writeBuffer()
    await writeLog(req.user!.userId, 'report.export', `导出批次 ${b.batch_no} 出厂检验报告`)
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-${encodeURIComponent(b.batch_no)}.xlsx"`
    )
    res.send(Buffer.from(buf))
  } catch (e) { next(e) }
})
