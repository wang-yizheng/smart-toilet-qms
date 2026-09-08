import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { fmtDate, ncStatusVariant } from '@/lib/format'
import type { Nonconforming } from '@/types'

const LEVELS = ['轻微', '一般', '严重']
const DISPOSITIONS = ['待处理', '返工', '返修', '让步接收', '报废']
const STATUSES = ['待处理', '审批中', '已闭环']

export default function Nonconforming() {
  const qc = useQueryClient()
  const [edit, setEdit] = useState<Nonconforming | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: list } = useQuery({
    queryKey: ['nc', statusFilter],
    queryFn: () => apiClient.get('/nonconforming', { params: { status: statusFilter || undefined } }).then((r) => r.data as Nonconforming[]),
  })

  const mut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiClient.patch(`/nonconforming/${id}`, body),
    onSuccess: () => { toast.success('已保存'); setEdit(null); qc.invalidateQueries({ queryKey: ['nc'] }); qc.invalidateQueries({ queryKey: ['overview'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '保存失败'),
  })

  const [f, setF] = useState({ defect_level: '', phenomenon: '', cause: '', responsibility_dept: '', disposition: '', status: '', recheck_result: '' })
  const openEdit = (n: Nonconforming) => {
    setF({ defect_level: n.defect_level, phenomenon: n.phenomenon ?? '', cause: n.cause ?? '', responsibility_dept: n.responsibility_dept ?? '', disposition: n.disposition, status: n.status, recheck_result: n.recheck_result ?? '' })
    setEdit(n)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent><SelectItem value="">全部状态</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant="secondary">共 {list?.length ?? 0} 条</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>不合格品处置</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>产品型号</TableHead><TableHead>批次</TableHead><TableHead>检测项</TableHead><TableHead>等级</TableHead>
              <TableHead>处置方式</TableHead><TableHead>责任部门</TableHead><TableHead>状态</TableHead><TableHead>复检</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {(list ?? []).map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.product_model}</TableCell>
                  <TableCell>{n.batch_no ?? '-'}</TableCell>
                  <TableCell>{n.item_name}</TableCell>
                  <TableCell><Badge variant={n.defect_level === '严重' ? 'destructive' : n.defect_level === '一般' ? 'warning' : 'secondary'}>{n.defect_level}</Badge></TableCell>
                  <TableCell>{n.disposition}</TableCell>
                  <TableCell>{n.responsibility_dept ?? '-'}</TableCell>
                  <TableCell><Badge variant={ncStatusVariant(n.status)}>{n.status}</Badge></TableCell>
                  <TableCell>{n.recheck_result ? (n.recheck_result === 'pass' ? <Badge variant="success">合格</Badge> : <Badge variant="destructive">不合格</Badge>) : '-'}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" />处置</Button></TableCell>
                </TableRow>
              ))}
              {!list?.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">暂无不合格品</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>不合格品处置</DialogTitle><DialogDescription>记录单号：{edit?.record_no} · 检测项：{edit?.item_name}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>不良等级</Label>
                <Select value={f.defect_level} onValueChange={(v) => setF({ ...f, defect_level: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>处置方式</Label>
                <Select value={f.disposition} onValueChange={(v) => setF({ ...f, disposition: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DISPOSITIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>不良现象</Label><Input value={f.phenomenon} onChange={(e) => setF({ ...f, phenomenon: e.target.value })} /></div>
            <div className="space-y-1"><Label>原因分析</Label><Textarea value={f.cause} onChange={(e) => setF({ ...f, cause: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>责任部门</Label><Input value={f.responsibility_dept} onChange={(e) => setF({ ...f, responsibility_dept: e.target.value })} placeholder="如：装配车间" /></div>
              <div className="space-y-1"><Label>处置状态</Label>
                <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>复检结果</Label>
              <Select value={f.recheck_result} onValueChange={(v) => setF({ ...f, recheck_result: v })}><SelectTrigger><SelectValue placeholder="未复检" /></SelectTrigger>
                <SelectContent><SelectItem value="">未复检</SelectItem><SelectItem value="pass">合格</SelectItem><SelectItem value="fail">不合格</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>取消</Button>
            <Button onClick={() => edit && mut.mutate({ id: edit.id, body: f })} disabled={mut.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
