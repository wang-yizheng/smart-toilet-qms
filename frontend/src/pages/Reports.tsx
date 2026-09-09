import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Printer, FileText, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtDateTime, resultLabel, resultVariant } from '@/lib/format'
import type { Batch } from '@/types'

interface Report {
  batch: any
  summary: { total: number; pass: number; fail: number; passRate: number }
  records: any[]
  nonconforming: any[]
  conclusion: string
  generatedAt: string
}

export default function Reports() {
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: () => apiClient.get('/batches').then((r) => r.data as Batch[]) })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => apiClient.get('/products').then((r) => r.data as any[]) })
  const [bid, setBid] = useState<string>('')
  const effBid = bid || (batches?.[0]?.id ? String(batches[0].id) : '')
  const { data: report, isLoading } = useQuery({
    queryKey: ['report', effBid],
    enabled: !!effBid,
    queryFn: () => apiClient.get(`/reports/batch/${effBid}`).then((r) => r.data as Report),
  })

  const modelOf = (id?: number) => products?.find((p) => p.id === id)?.model ?? ''

  const [exporting, setExporting] = useState(false)
  const exportExcel = async () => {
    if (!effBid) return
    setExporting(true)
    try {
      const res = await apiClient.get(`/reports/batch/${effBid}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `出厂检验报告-${report?.batch?.batch_no ?? effBid}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('报告已导出')
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm">选择生产批次：</Label>
        <Select value={effBid} onValueChange={setBid}>
          <SelectTrigger className="w-72"><SelectValue placeholder="选择批次" /></SelectTrigger>
          <SelectContent>{batches?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.batch_no}（{modelOf(b.product_id)}）</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" className="ml-auto" onClick={exportExcel} disabled={!report || exporting}>
          <FileSpreadsheet className="h-4 w-4 mr-1" />{exporting ? '导出中…' : '导出 Excel'}
        </Button>
        <Button variant="outline" onClick={() => window.print()} disabled={!report}><Printer className="h-4 w-4 mr-1" />打印</Button>
      </div>

      {isLoading && <div className="text-muted-foreground">加载中…</div>}
      {report && (
        <div className="space-y-4 print:space-y-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />出厂检验报告</CardTitle>
                <span className="text-xs text-muted-foreground">生成时间：{fmtDateTime(report.generatedAt)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-muted-foreground">批次号</div><div className="font-medium">{report.batch.batch_no}</div></div>
                <div><div className="text-muted-foreground">产品型号</div><div className="font-medium">{report.batch.model} {report.batch.name}</div></div>
                <div><div className="text-muted-foreground">生产数量</div><div className="font-medium">{report.batch.quantity}</div></div>
                <div><div className="text-muted-foreground">生产日期</div><div className="font-medium">{fmtDate(report.batch.produce_date)}</div></div>
                <div><div className="text-muted-foreground">供应商</div><div className="font-medium">{report.batch.supplier_name}</div></div>
                <div><div className="text-muted-foreground">产品分类</div><div className="font-medium">{report.batch.category_name}</div></div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                <Badge variant="secondary">检测总数 {report.summary.total}</Badge>
                <Badge variant="success">合格 {report.summary.pass}</Badge>
                <Badge variant="destructive">不合格 {report.summary.fail}</Badge>
                <Badge variant={report.summary.passRate >= 95 ? 'success' : 'warning'}>一次交验合格率 {report.summary.passRate}%</Badge>
                <span className="ml-auto font-semibold">检验结论：<span className={report.summary.fail === 0 ? 'text-success' : 'text-destructive'}>{report.conclusion}</span></span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>检测记录明细（{report.records.length}）</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>记录单号</TableHead><TableHead>检测时间</TableHead><TableHead>检测员</TableHead><TableHead>判定</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.records.map((r) => (
                    <TableRow key={r.id}><TableCell className="font-medium">{r.record_no}</TableCell><TableCell>{fmtDateTime(r.detected_at)}</TableCell><TableCell>{r.inspector_name}</TableCell><TableCell><Badge variant={resultVariant(r.result)}>{resultLabel(r.result)}</Badge></TableCell><TableCell>{r.status}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {report.nonconforming.length > 0 && (
            <Card>
              <CardHeader><CardTitle>不合格项明细（{report.nonconforming.length}）</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>检测项</TableHead><TableHead>等级</TableHead><TableHead>处置</TableHead><TableHead>状态</TableHead><TableHead>责任部门</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {report.nonconforming.map((n) => (
                      <TableRow key={n.id}><TableCell>{n.item_name}</TableCell><TableCell>{n.defect_level}</TableCell><TableCell>{n.disposition}</TableCell><TableCell>{n.status}</TableCell><TableCell>{n.responsibility_dept ?? '-'}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className}>{children}</span>
}
