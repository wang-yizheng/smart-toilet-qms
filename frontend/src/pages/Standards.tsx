import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil, Plus } from 'lucide-react'
import { fmtNum } from '@/lib/format'
import type { Product, DetectionItem, Standard } from '@/types'

export default function Standards() {
  const qc = useQueryClient()
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => apiClient.get('/products').then((r) => r.data as Product[]) })
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: () => apiClient.get('/items').then((r) => r.data as DetectionItem[]) })
  const [pid, setPid] = useState<string>('')
  const effPid = pid || (products?.[0]?.id ? String(products[0].id) : '')
  const { data: standards } = useQuery({
    queryKey: ['std', effPid],
    enabled: !!effPid,
    queryFn: () => apiClient.get('/standards', { params: { productId: effPid } }).then((r) => r.data as Standard[]),
  })

  const [edit, setEdit] = useState<Standard | null>(null)
  const [ef, setEf] = useState({ nominal: '', lower_bound: '', upper_bound: '', method: '' })
  const [addOpen, setAddOpen] = useState(false)
  const [addItem, setAddItem] = useState('')
  const [af, setAf] = useState({ nominal: '', lower_bound: '', upper_bound: '', method: '' })

  const openEdit = (s: Standard) => {
    setEf({ nominal: s.nominal == null ? '' : String(s.nominal), lower_bound: s.lower_bound == null ? '' : String(s.lower_bound), upper_bound: s.upper_bound == null ? '' : String(s.upper_bound), method: s.method ?? '' })
    setEdit(s)
  }
  const editMut = useMutation({
    mutationFn: (b: any) => apiClient.patch(`/standards/${edit!.id}`, b),
    onSuccess: () => { toast.success('已更新'); setEdit(null); qc.invalidateQueries({ queryKey: ['std', effPid] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '更新失败'),
  })
  const addMut = useMutation({
    mutationFn: (b: any) => apiClient.post('/standards', b),
    onSuccess: () => { toast.success('已添加检测项'); setAddOpen(false); setAddItem(''); qc.invalidateQueries({ queryKey: ['std', effPid] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '添加失败'),
  })

  const bound = (v: string) => (v === '' ? null : Number(v))
  const missing = (items ?? []).filter((it) => !(standards ?? []).some((s) => s.item_id === it.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm">选择产品型号：</Label>
        <Select value={effPid} onValueChange={setPid}>
          <SelectTrigger className="w-56"><SelectValue placeholder="选择产品" /></SelectTrigger>
          <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.model} {p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => { setAf({ nominal: '', lower_bound: '', upper_bound: '', method: '' }); setAddOpen(true) }} disabled={!effPid}><Plus className="h-4 w-4 mr-1" />添加检测项</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>检测标准与判定阈值（{standards?.length ?? 0} 项）</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>分组</TableHead><TableHead>检测项</TableHead><TableHead>单位</TableHead><TableHead>标准值</TableHead><TableHead>下限</TableHead><TableHead>上限</TableHead><TableHead>判定方法</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {(standards ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.group_name}</TableCell>
                  <TableCell className="font-medium">{s.item_name}</TableCell>
                  <TableCell>{s.unit}</TableCell>
                  <TableCell>{fmtNum(s.nominal)}</TableCell>
                  <TableCell>{s.lower_bound == null ? '无下限' : fmtNum(s.lower_bound)}</TableCell>
                  <TableCell>{s.upper_bound == null ? '无上限' : fmtNum(s.upper_bound)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{s.method}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" />编辑</Button></TableCell>
                </TableRow>
              ))}
              {!standards?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">请选择产品型号查看检测标准</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑判定阈值 - {edit?.item_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>标准值</Label><Input type="number" step="any" value={ef.nominal} onChange={(e) => setEf({ ...ef, nominal: e.target.value })} /></div>
              <div className="space-y-1"><Label>下限（可空）</Label><Input type="number" step="any" value={ef.lower_bound} onChange={(e) => setEf({ ...ef, lower_bound: e.target.value })} placeholder="无下限" /></div>
              <div className="space-y-1"><Label>上限（可空）</Label><Input type="number" step="any" value={ef.upper_bound} onChange={(e) => setEf({ ...ef, upper_bound: e.target.value })} placeholder="无上限" /></div>
            </div>
            <div className="space-y-1"><Label>判定方法</Label><Input value={ef.method} onChange={(e) => setEf({ ...ef, method: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">合格判定：实测值 ≥ 下限 且 ≤ 上限（单边标准可留空一侧）。边界值含端点。</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>取消</Button><Button onClick={() => editMut.mutate({ nominal: bound(ef.nominal), lower_bound: bound(ef.lower_bound), upper_bound: bound(ef.upper_bound), method: af.method })} disabled={editMut.isPending}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加检测项到该产品</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>检测项</Label>
              <Select value={addItem} onValueChange={setAddItem}><SelectTrigger><SelectValue placeholder="从检测项库选择" /></SelectTrigger>
                <SelectContent>{missing.map((it) => <SelectItem key={it.id} value={String(it.id)}>{it.group_name} / {it.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>标准值</Label><Input type="number" step="any" value={af.nominal} onChange={(e) => setAf({ ...af, nominal: e.target.value })} /></div>
              <div className="space-y-1"><Label>下限</Label><Input type="number" step="any" value={af.lower_bound} onChange={(e) => setAf({ ...af, lower_bound: e.target.value })} placeholder="无下限" /></div>
              <div className="space-y-1"><Label>上限</Label><Input type="number" step="any" value={af.upper_bound} onChange={(e) => setAf({ ...af, upper_bound: e.target.value })} placeholder="无上限" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button><Button onClick={() => addMut.mutate({ product_id: Number(effPid), item_id: Number(addItem), nominal: bound(af.nominal), lower_bound: bound(af.lower_bound), upper_bound: bound(af.upper_bound), method: af.method || null })} disabled={addMut.isPending || !addItem}>添加</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
