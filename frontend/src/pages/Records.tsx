import { useRef, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Eye, CheckCircle2, XCircle, Download, Upload, ImagePlus } from 'lucide-react'
import { fmtDateTime, fmtNum, resultLabel, resultVariant, toNum } from '@/lib/format'
import { useAuth } from '@/lib/auth'
import type { RecordRow, Product, Batch, User, Standard, ResultRow, RecordPhoto } from '@/types'

export default function Records() {
  const me = useAuth()
  const canManage = me.user?.role === 'admin' || me.user?.role === 'qc_manager'
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<number | null>(null)
  const [filters, setFilters] = useState({ product_id: '', result: '', inspector_id: '' })

  const { data: records } = useQuery({
    queryKey: ['records', filters],
    queryFn: () =>
      apiClient
        .get('/records', {
          params: {
            productId: filters.product_id || undefined,
            result: filters.result || undefined,
            inspectorId: filters.inspector_id || undefined,
          },
        })
        .then((r) => r.data as RecordRow[]),
  })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => apiClient.get('/products').then((r) => r.data as Product[]) })
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: () => apiClient.get('/batches').then((r) => r.data as Batch[]) })
  const { data: users } = useQuery({ queryKey: ['inspectors'], queryFn: () => apiClient.get('/users').then((r) => r.data as User[]), enabled: canManage })

  const [form, setForm] = useState({ product_id: '', batch_id: '', inspector_id: String(me.user?.id ?? ''), detected_at: '', env_note: '' })
  const [values, setValues] = useState<Record<number, string>>({})
  const { data: standards } = useQuery({
    queryKey: ['std-for', form.product_id],
    enabled: !!form.product_id,
    queryFn: () => apiClient.get('/standards', { params: { productId: form.product_id } }).then((r) => r.data as Standard[]),
  })

  const createMut = useMutation({
    mutationFn: (body: any) => apiClient.post('/records', body),
    onSuccess: (res) => {
      toast.success(`记录已保存，判定结果：${resultLabel(res.data.result)}`)
      setOpen(false); setValues({}); qc.invalidateQueries({ queryKey: ['records'] }); qc.invalidateQueries({ queryKey: ['overview'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || '保存失败'),
  })
  const reviewMut = useMutation({
    mutationFn: (id: number) => apiClient.patch(`/records/${id}/review`, {}),
    onSuccess: () => { toast.success('已审核'); qc.invalidateQueries({ queryKey: ['records'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '操作失败'),
  })

  // ---- spreadsheet import ----
  const fileRef = useRef<HTMLInputElement>(null)
  const importMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post('/records/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      const d = res.data
      toast.success(`导入完成：成功 ${d.created} 条${d.errors?.length ? `，跳过 ${d.errors.length} 行` : ''}`)
      if (d.errors?.length) toast.error(d.errors.slice(0, 3).join('；'))
      qc.invalidateQueries({ queryKey: ['records'] }); qc.invalidateQueries({ queryKey: ['overview'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || '导入失败'),
  })
  const downloadTemplate = async () => {
    try {
      const res = await apiClient.get('/records/import/template', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = '检测记录导入模板.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('模板下载失败')
    }
  }

  // ---- on-site photos ----
  const photoRef = useRef<HTMLInputElement>(null)
  const photos = useQuery({
    queryKey: ['record-photos', detail],
    enabled: detail != null,
    queryFn: () => apiClient.get(`/records/${detail}/photos`).then((r) => r.data as RecordPhoto[]),
  })
  const uploadPhotoMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/records/${detail}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { toast.success('照片已上传'); qc.invalidateQueries({ queryKey: ['record-photos', detail] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '上传失败'),
  })
  const delPhotoMut = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/records/photo/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['record-photos', detail] }),
    onError: (e: any) => toast.error(e?.response?.data?.message || '删除失败'),
  })

  const submit = () => {
    if (!form.product_id) return toast.error('请选择产品型号')
    if (!standards?.length) return toast.error('该产品未配置检测标准')
    const results = standards.map((s) => ({ item_id: s.item_id, value: values[s.item_id] === '' || values[s.item_id] == null ? null : Number(values[s.item_id]) }))
    if (results.some((r) => r.value == null)) return toast.error('请填写所有检测项数值')
    createMut.mutate({
      product_id: Number(form.product_id),
      batch_id: form.batch_id ? Number(form.batch_id) : null,
      inspector_id: form.inspector_id ? Number(form.inspector_id) : me.user?.id,
      detected_at: form.detected_at || undefined,
      env_note: form.env_note || null,
      results,
    })
  }

  const detailData = useQuery({
    queryKey: ['record', detail],
    enabled: detail != null,
    queryFn: () => apiClient.get(`/records/${detail}`).then((r) => r.data as { record: RecordRow; results: ResultRow[] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.product_id} onValueChange={(v) => setFilters({ ...filters, product_id: v })}>
          <SelectTrigger className="w-44"><SelectValue placeholder="全部产品" /></SelectTrigger>
          <SelectContent><SelectItem value="">全部产品</SelectItem>{products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.model}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.result} onValueChange={(v) => setFilters({ ...filters, result: v })}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部判定" /></SelectTrigger>
          <SelectContent><SelectItem value="">全部判定</SelectItem><SelectItem value="pass">合格</SelectItem><SelectItem value="fail">不合格</SelectItem><SelectItem value="pending">待判定</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setFilters({ product_id: '', result: '', inspector_id: '' })}>重置</Button>
        <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" />导入模板</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
          <Upload className="h-4 w-4 mr-1" />{importMut.isPending ? '导入中…' : '表格导入'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = '' }}
        />
        <Button className="ml-auto" onClick={() => { setForm({ product_id: '', batch_id: '', inspector_id: String(me.user?.id ?? ''), detected_at: '', env_note: '' }); setValues({}); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />录入检测数据
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>检测记录（{records?.length ?? 0} 条）</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>记录单号</TableHead><TableHead>产品型号</TableHead><TableHead>批次</TableHead><TableHead>检测时间</TableHead>
                <TableHead>检测员</TableHead><TableHead>不合格项</TableHead><TableHead>判定</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(records ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.record_no}</TableCell>
                  <TableCell>{r.product_model}</TableCell>
                  <TableCell>{r.batch_no ?? '-'}</TableCell>
                  <TableCell>{fmtDateTime(r.detected_at)}</TableCell>
                  <TableCell>{r.inspector_name}</TableCell>
                  <TableCell>{r.fail_items ? <Badge variant="destructive">{r.fail_items}</Badge> : 0}</TableCell>
                  <TableCell><Badge variant={resultVariant(r.result)}>{resultLabel(r.result)}</Badge></TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(r.id)}><Eye className="h-4 w-4" />查看</Button>
                    {canManage && r.status === '待审核' && (
                      <Button variant="ghost" size="sm" onClick={() => reviewMut.mutate(r.id)}><CheckCircle2 className="h-4 w-4 text-success" />审核</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!records?.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">暂无数据</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>录入检测数据</DialogTitle><DialogDescription>系统将依据产品检测标准自动完成合格/不合格判定</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>产品型号</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v, batch_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="选择产品" /></SelectTrigger>
                  <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.model} {p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>生产批次</Label>
                <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="选择批次（可空）" /></SelectTrigger>
                  <SelectContent><SelectItem value="">不绑定批次</SelectItem>{(batches ?? []).filter((b) => !form.product_id || b.product_id === Number(form.product_id)).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.batch_no}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>检测员</Label>
                <Select value={form.inspector_id} onValueChange={(v) => setForm({ ...form, inspector_id: v })}>
                  <SelectTrigger><SelectValue placeholder="选择检测员" /></SelectTrigger>
                  <SelectContent>{(users ?? []).filter((u) => u.role === 'inspector').map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}<SelectItem value={String(me.user?.id ?? '')}>{me.user?.name}（本人）</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>检测时间</Label><Input type="datetime-local" value={form.detected_at} onChange={(e) => setForm({ ...form, detected_at: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>环境备注</Label><Textarea value={form.env_note} onChange={(e) => setForm({ ...form, env_note: e.target.value })} placeholder="如：车间温度23℃，湿度55%" /></div>

            <div className="border rounded-md max-h-64 overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>检测项目</TableHead><TableHead>标准值</TableHead><TableHead>下限</TableHead><TableHead>上限</TableHead><TableHead className="w-32">实测值</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(standards ?? []).map((s) => (
                    <TableRow key={s.item_id}>
                      <TableCell>{s.item_name} <span className="text-muted-foreground text-xs">({s.unit})</span></TableCell>
                      <TableCell>{fmtNum(s.nominal)}</TableCell>
                      <TableCell>{s.lower_bound == null ? '—' : fmtNum(s.lower_bound)}</TableCell>
                      <TableCell>{s.upper_bound == null ? '—' : fmtNum(s.upper_bound)}</TableCell>
                      <TableCell><Input type="number" step="any" value={values[s.item_id] ?? ''} onChange={(e) => setValues({ ...values, [s.item_id]: e.target.value })} placeholder="输入" /></TableCell>
                    </TableRow>
                  ))}
                  {!standards?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">请先选择产品型号</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={submit} disabled={createMut.isPending}>保存并判定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detail != null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>检测记录详情</DialogTitle>
            <DialogDescription>{detailData.data?.record.record_no} · 判定：{detailData.data && resultLabel(detailData.data.record.result)} · {detailData.data?.record.product_model}</DialogDescription>
          </DialogHeader>
          {detailData.data && (
            <div className="border rounded-md max-h-80 overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>检测项目</TableHead><TableHead>标准</TableHead><TableHead>实测</TableHead><TableHead>偏差</TableHead><TableHead>判定</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detailData.data.results.map((r) => (
                    <TableRow key={r.id} className={r.qualified === false ? 'bg-destructive/5' : ''}>
                      <TableCell>{r.item_name} <span className="text-muted-foreground text-xs">({r.unit})</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.lower_bound == null ? '' : `${fmtNum(r.lower_bound)} ≤ `}{fmtNum(r.nominal)}{r.upper_bound == null ? '' : ` ≤ ${fmtNum(r.upper_bound)}`}
                      </TableCell>
                      <TableCell className="font-medium">{fmtNum(r.value)}</TableCell>
                      <TableCell>{r.deviation == null ? '-' : (r.deviation > 0 ? '+' : '') + fmtNum(r.deviation)}</TableCell>
                      <TableCell>
                        {r.qualified === true ? <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />合格</Badge>
                          : r.qualified === false ? <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />不合格</Badge>
                          : <Badge variant="secondary">未判定</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {detailData.data && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>现场照片（{photos.data?.length ?? 0}）</Label>
                <Button variant="outline" size="sm" onClick={() => photoRef.current?.click()} disabled={uploadPhotoMut.isPending}>
                  <ImagePlus className="h-4 w-4 mr-1" />上传照片
                </Button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhotoMut.mutate(f); e.target.value = '' }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(photos.data ?? []).map((p) => (
                  <div key={p.id} className="group relative">
                    <a href={p.file_path} target="_blank" rel="noreferrer">
                      <img src={p.file_path} alt={p.file_name ?? '现场照片'} className="h-20 w-20 rounded border object-cover" />
                    </a>
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white group-hover:flex"
                      onClick={() => delPhotoMut.mutate(p.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!(photos.data ?? []).length && <p className="text-xs text-muted-foreground">暂无现场照片，可上传检测现场图片留档</p>}
              </div>
            </div>
          )}

          <DialogFooter><Button onClick={() => setDetail(null)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
