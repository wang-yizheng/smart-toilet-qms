import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { fmtDate, taskStatusVariant } from '@/lib/format'
import { useAuth } from '@/lib/auth'
import type { Task, Product, Batch, User } from '@/types'

const STATUSES = ['待派工', '待检测', '检测中', '待审核', '已完成', '已终止']
const TYPES = ['出厂', '过程', '型式']

export default function Tasks() {
  const qc = useAuth()
  const canManage = qc.user?.role === 'admin' || qc.user?.role === 'qc_manager'
  const qc2 = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Task | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: tasks } = useQuery({
    queryKey: ['tasks', statusFilter, typeFilter],
    queryFn: () =>
      apiClient
        .get('/tasks', { params: { status: statusFilter || undefined, type: typeFilter || undefined } })
        .then((r) => r.data as Task[]),
  })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => apiClient.get('/products').then((r) => r.data as Product[]) })
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: () => apiClient.get('/batches').then((r) => r.data as Batch[]) })
  const { data: users } = useQuery({ queryKey: ['inspectors'], queryFn: () => apiClient.get('/users').then((r) => r.data as User[]), enabled: canManage })

  const createMut = useMutation({
    mutationFn: (body: any) => apiClient.post('/tasks', body),
    onSuccess: () => { toast.success('任务已创建'); setOpen(false); qc2.invalidateQueries({ queryKey: ['tasks'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '创建失败'),
  })
  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiClient.patch(`/tasks/${id}`, body),
    onSuccess: () => { toast.success('已更新'); setEdit(null); qc2.invalidateQueries({ queryKey: ['tasks'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '更新失败'),
  })

  const [form, setForm] = useState({ product_id: '', batch_id: '', type: '出厂', assignee_id: '', plan_date: '', due_date: '', note: '' })
  const resetForm = () => setForm({ product_id: '', batch_id: '', type: '出厂', assignee_id: '', plan_date: '', due_date: '', note: '' })

  const submitCreate = () => {
    if (!form.product_id) return toast.error('请选择产品型号')
    createMut.mutate({
      product_id: Number(form.product_id),
      batch_id: form.batch_id ? Number(form.batch_id) : undefined,
      type: form.type,
      assignee_id: form.assignee_id ? Number(form.assignee_id) : undefined,
      plan_date: form.plan_date || undefined,
      due_date: form.due_date || undefined,
      note: form.note || undefined,
    })
  }

  const inspectors = (users ?? []).filter((u) => u.role === 'inspector')
  const filteredBatches = (batches ?? []).filter((b) => !form.product_id || b.product_id === Number(form.product_id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent><SelectItem value="">全部状态</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部类型" /></SelectTrigger>
          <SelectContent><SelectItem value="">全部类型</SelectItem>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        {canManage && (
          <Button className="ml-auto" onClick={() => { resetForm(); setOpen(true) }}><Plus className="h-4 w-4 mr-1" />新建任务</Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>检测任务列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务单号</TableHead><TableHead>产品型号</TableHead><TableHead>批次</TableHead><TableHead>类型</TableHead>
                <TableHead>状态</TableHead><TableHead>负责人</TableHead><TableHead>截止日期</TableHead><TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tasks ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.task_no}</TableCell>
                  <TableCell>{t.product_model}</TableCell>
                  <TableCell>{t.batch_no ?? '-'}</TableCell>
                  <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                  <TableCell><Badge variant={taskStatusVariant(t.status)}>{t.status}</Badge></TableCell>
                  <TableCell>{t.assignee_name ?? '未派工'}</TableCell>
                  <TableCell>{fmtDate(t.due_date)}</TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => setEdit(t)}><Pencil className="h-4 w-4" /> 状态</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!tasks?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">暂无数据</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建检测任务</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>产品型号</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v, batch_id: '' })}>
                <SelectTrigger><SelectValue placeholder="选择产品" /></SelectTrigger>
                <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.model} {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>生产批次</Label>
              <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                <SelectTrigger><SelectValue placeholder="选择批次（可空）" /></SelectTrigger>
                <SelectContent><SelectItem value="">不绑定批次</SelectItem>{filteredBatches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.batch_no}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>类型</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>负责人</Label>
                <Select value={form.assignee_id} onValueChange={(v) => setForm({ ...form, assignee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="选择检测员（可空）" /></SelectTrigger>
                  <SelectContent><SelectItem value="">暂不派工</SelectItem>{inspectors.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>计划日期</Label><Input type="date" value={form.plan_date} onChange={(e) => setForm({ ...form, plan_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>截止日期</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>备注</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="任务说明" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={submitCreate} disabled={createMut.isPending}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit status dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>更新任务状态</DialogTitle><DialogDescription>任务单号：{edit?.task_no}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>状态</Label>
              <Select value={edit?.status ?? ''} onValueChange={(v) => setEdit({ ...(edit as Task), status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(edit?.status === '待检测' || edit?.status === '检测中') && (
              <div className="space-y-1">
                <Label>派工给</Label>
                <Select
                  value={String(edit?.assignee_id ?? '')}
                  onValueChange={(v) => setEdit({ ...(edit as Task), assignee_id: v ? Number(v) : null })}
                >
                  <SelectTrigger><SelectValue placeholder="选择检测员" /></SelectTrigger>
                  <SelectContent>{inspectors.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>取消</Button>
            <Button onClick={() => edit && patchMut.mutate({ id: edit.id, body: { status: edit.status, assignee_id: edit.assignee_id } })} disabled={patchMut.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
