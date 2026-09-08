import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { fmtDate } from '@/lib/format'
import type { Product, Category, Supplier, Batch } from '@/types'

export default function Products() {
  const qc = useQueryClient()
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => apiClient.get('/products').then((r) => r.data as Product[]) })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => apiClient.get('/categories').then((r) => r.data as Category[]) })
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => apiClient.get('/suppliers').then((r) => r.data as Supplier[]) })
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: () => apiClient.get('/batches').then((r) => r.data as Batch[]) })

  const invalidate = () => ['products', 'categories', 'suppliers', 'batches'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))

  // ---- Products ----
  const [pOpen, setPOpen] = useState(false)
  const [pEdit, setPEdit] = useState<Product | null>(null)
  const [pf, setPf] = useState({ model: '', name: '', category_id: '', supplier_id: '', description: '' })
  const pMut = useMutation({
    mutationFn: (b: any) => (pEdit ? apiClient.patch(`/products/${pEdit.id}`, b) : apiClient.post('/products', b)),
    onSuccess: () => { toast.success('已保存'); setPOpen(false); invalidate() },
    onError: (e: any) => toast.error(e?.response?.data?.message || '保存失败'),
  })
  const pDel = useMutation({ mutationFn: (id: number) => apiClient.delete(`/products/${id}`), onSuccess: () => { toast.success('已删除'); invalidate() }, onError: (e: any) => toast.error(e?.response?.data?.message || '删除失败') })

  // ---- Categories ----
  const [cOpen, setCOpen] = useState(false)
  const [cf, setCf] = useState({ code: '', name: '' })
  const cMut = useMutation({ mutationFn: (b: any) => apiClient.post('/categories', b), onSuccess: () => { toast.success('已保存'); setCOpen(false); invalidate() }, onError: (e: any) => toast.error(e?.response?.data?.message || '保存失败') })
  const cDel = useMutation({ mutationFn: (id: number) => apiClient.delete(`/categories/${id}`), onSuccess: () => { toast.success('已删除'); invalidate() } })

  // ---- Suppliers ----
  const [sOpen, setSOpen] = useState(false)
  const [sf, setSf] = useState({ code: '', name: '', contact: '' })
  const sMut = useMutation({ mutationFn: (b: any) => apiClient.post('/suppliers', b), onSuccess: () => { toast.success('已保存'); setSOpen(false); invalidate() }, onError: (e: any) => toast.error(e?.response?.data?.message || '保存失败') })
  const sDel = useMutation({ mutationFn: (id: number) => apiClient.delete(`/suppliers/${id}`), onSuccess: () => { toast.success('已删除'); invalidate() } })

  // ---- Batches ----
  const [bOpen, setBOpen] = useState(false)
  const [bf, setBf] = useState({ batch_no: '', product_id: '', quantity: '', produce_date: '' })
  const bMut = useMutation({ mutationFn: (b: any) => apiClient.post('/batches', b), onSuccess: () => { toast.success('已保存'); setBOpen(false); invalidate() }, onError: (e: any) => toast.error(e?.response?.data?.message || '保存失败') })
  const bDel = useMutation({ mutationFn: (id: number) => apiClient.delete(`/batches/${id}`), onSuccess: () => { toast.success('已删除'); invalidate() } })

  const catName = (id?: number | null) => categories?.find((c) => c.id === id)?.name ?? '-'
  const supName = (id?: number | null) => suppliers?.find((s) => s.id === id)?.name ?? '-'
  const prodModel = (id?: number | null) => products?.find((p) => p.id === id)?.model ?? '-'

  return (
    <Tabs defaultValue="products">
      <TabsList>
        <TabsTrigger value="products">产品型号</TabsTrigger>
        <TabsTrigger value="categories">产品分类</TabsTrigger>
        <TabsTrigger value="suppliers">供应商</TabsTrigger>
        <TabsTrigger value="batches">生产批次</TabsTrigger>
      </TabsList>

      <TabsContent value="products">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>产品型号（{products?.length ?? 0}）</CardTitle>
            <Button onClick={() => { setPEdit(null); setPf({ model: '', name: '', category_id: '', supplier_id: '', description: '' }); setPOpen(true) }}><Plus className="h-4 w-4 mr-1" />新增</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>型号</TableHead><TableHead>名称</TableHead><TableHead>分类</TableHead><TableHead>供应商</TableHead><TableHead>描述</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>
                {(products ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.model}</TableCell><TableCell>{p.name}</TableCell>
                    <TableCell>{p.category_name ?? catName(p.category_id)}</TableCell><TableCell>{p.supplier_name ?? supName(p.supplier_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.description}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => { setPEdit(p); setPf({ model: p.model, name: p.name, category_id: p.category_id ? String(p.category_id) : '', supplier_id: p.supplier_id ? String(p.supplier_id) : '', description: p.description ?? '' }); setPOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => pDel.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Dialog open={pOpen} onOpenChange={setPOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{pEdit ? '编辑产品' : '新增产品'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>型号 *</Label><Input value={pf.model} onChange={(e) => setPf({ ...pf, model: e.target.value })} /></div>
                <div className="space-y-1"><Label>名称 *</Label><Input value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>分类</Label>
                  <Select value={pf.category_id} onValueChange={(v) => setPf({ ...pf, category_id: v })}><SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                    <SelectContent>{categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1"><Label>供应商</Label>
                  <Select value={pf.supplier_id} onValueChange={(v) => setPf({ ...pf, supplier_id: v })}><SelectTrigger><SelectValue placeholder="选择供应商" /></SelectTrigger>
                    <SelectContent>{suppliers?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>描述</Label><Textarea value={pf.description} onChange={(e) => setPf({ ...pf, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setPOpen(false)}>取消</Button><Button onClick={() => pMut.mutate({ model: pf.model, name: pf.name, category_id: pf.category_id ? Number(pf.category_id) : null, supplier_id: pf.supplier_id ? Number(pf.supplier_id) : null, description: pf.description })} disabled={pMut.isPending}>保存</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="categories">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>产品分类</CardTitle><Button onClick={() => { setCf({ code: '', name: '' }); setCOpen(true) }}><Plus className="h-4 w-4 mr-1" />新增</Button></CardHeader>
          <CardContent>
            <Table><TableHeader><TableRow><TableHead>编码</TableHead><TableHead>名称</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>{(categories ?? []).map((c) => (<TableRow key={c.id}><TableCell>{c.code}</TableCell><TableCell>{c.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => cDel.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Dialog open={cOpen} onOpenChange={setCOpen}><DialogContent>
          <DialogHeader><DialogTitle>新增分类</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>编码</Label><Input value={cf.code} onChange={(e) => setCf({ ...cf, code: e.target.value })} /></div><div className="space-y-1"><Label>名称</Label><Input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setCOpen(false)}>取消</Button><Button onClick={() => cMut.mutate(cf)} disabled={cMut.isPending}>保存</Button></DialogFooter>
        </DialogContent></Dialog>
      </TabsContent>

      <TabsContent value="suppliers">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>供应商</CardTitle><Button onClick={() => { setSf({ code: '', name: '', contact: '' }); setSOpen(true) }}><Plus className="h-4 w-4 mr-1" />新增</Button></CardHeader>
          <CardContent>
            <Table><TableHeader><TableRow><TableHead>编码</TableHead><TableHead>名称</TableHead><TableHead>联系人</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>{(suppliers ?? []).map((s) => (<TableRow key={s.id}><TableCell>{s.code}</TableCell><TableCell>{s.name}</TableCell><TableCell>{s.contact ?? '-'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => sDel.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Dialog open={sOpen} onOpenChange={setSOpen}><DialogContent>
          <DialogHeader><DialogTitle>新增供应商</DialogTitle></DialogHeader>
          <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>编码</Label><Input value={sf.code} onChange={(e) => setSf({ ...sf, code: e.target.value })} /></div><div className="space-y-1"><Label>名称</Label><Input value={sf.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} /></div></div><div className="space-y-1"><Label>联系人</Label><Input value={sf.contact} onChange={(e) => setSf({ ...sf, contact: e.target.value })} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setSOpen(false)}>取消</Button><Button onClick={() => sMut.mutate(sf)} disabled={sMut.isPending}>保存</Button></DialogFooter>
        </DialogContent></Dialog>
      </TabsContent>

      <TabsContent value="batches">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>生产批次</CardTitle><Button onClick={() => { setBf({ batch_no: '', product_id: '', quantity: '', produce_date: '' }); setBOpen(true) }}><Plus className="h-4 w-4 mr-1" />新增</Button></CardHeader>
          <CardContent>
            <Table><TableHeader><TableRow><TableHead>批次号</TableHead><TableHead>产品</TableHead><TableHead>数量</TableHead><TableHead>生产日期</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>{(batches ?? []).map((b) => (<TableRow key={b.id}><TableCell className="font-medium">{b.batch_no}</TableCell><TableCell>{prodModel(b.product_id)}</TableCell><TableCell>{b.quantity}</TableCell><TableCell>{fmtDate(b.produce_date)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => bDel.mutate(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Dialog open={bOpen} onOpenChange={setBOpen}><DialogContent>
          <DialogHeader><DialogTitle>新增批次</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>批次号</Label><Input value={bf.batch_no} onChange={(e) => setBf({ ...bf, batch_no: e.target.value })} /></div>
            <div className="space-y-1"><Label>产品</Label>
              <Select value={bf.product_id} onValueChange={(v) => setBf({ ...bf, product_id: v })}><SelectTrigger><SelectValue placeholder="选择产品" /></SelectTrigger>
                <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.model} {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>数量</Label><Input type="number" value={bf.quantity} onChange={(e) => setBf({ ...bf, quantity: e.target.value })} /></div><div className="space-y-1"><Label>生产日期</Label><Input type="date" value={bf.produce_date} onChange={(e) => setBf({ ...bf, produce_date: e.target.value })} /></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBOpen(false)}>取消</Button><Button onClick={() => bMut.mutate({ batch_no: bf.batch_no, product_id: Number(bf.product_id), quantity: Number(bf.quantity), produce_date: bf.produce_date || null })} disabled={bMut.isPending}>保存</Button></DialogFooter>
        </DialogContent></Dialog>
      </TabsContent>
    </Tabs>
  )
}
