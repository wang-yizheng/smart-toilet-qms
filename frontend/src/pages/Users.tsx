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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, KeyRound } from 'lucide-react'
import { ROLE_LABELS, type User } from '@/types'

const ROLES = ['admin', 'qc_manager', 'inspector', 'producer']

export default function Users() {
  const qc = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['users-admin'], queryFn: () => apiClient.get('/users').then((r) => r.data as User[]) })
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ username: '', name: '', role: 'inspector', password: '' })
  const [reset, setReset] = useState<{ id: number; password: string } | null>(null)

  const createMut = useMutation({
    mutationFn: (b: any) => apiClient.post('/users', b),
    onSuccess: () => { toast.success('用户已创建'); setOpen(false); setF({ username: '', name: '', role: 'inspector', password: '' }); qc.invalidateQueries({ queryKey: ['users-admin'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '创建失败'),
  })
  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiClient.patch(`/users/${id}`, body),
    onSuccess: () => { toast.success('已更新'); qc.invalidateQueries({ queryKey: ['users-admin'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '更新失败'),
  })
  const resetMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => apiClient.post(`/users/${id}/reset-password`, { password }),
    onSuccess: () => { toast.success('密码已重置'); setReset(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || '重置失败'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">管理系统账号、角色与启用状态</p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />新建用户</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>用户列表（{users?.length ?? 0}）</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>用户名</TableHead><TableHead>姓名</TableHead><TableHead>角色</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell><Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
                  <TableCell><Badge variant={u.status === 'active' ? 'success' : 'secondary'}>{u.status === 'active' ? '启用' : '禁用'}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setReset({ id: u.id, password: '' })}><KeyRound className="h-4 w-4" />重置密码</Button>
                    <Button variant="ghost" size="sm" onClick={() => patchMut.mutate({ id: u.id, body: { status: u.status === 'active' ? 'disabled' : 'active' } })}>
                      {u.status === 'active' ? '禁用' : '启用'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建用户</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>用户名</Label><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
              <div className="space-y-1"><Label>姓名</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>角色</Label>
                <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>初始密码</Label><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={() => createMut.mutate(f)} disabled={createMut.isPending}>创建</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>重置密码</DialogTitle></DialogHeader>
          <div className="space-y-1"><Label>新密码（至少 6 位）</Label><Input value={reset?.password ?? ''} onChange={(e) => setReset({ ...(reset as any), password: e.target.value })} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setReset(null)}>取消</Button><Button onClick={() => reset && resetMut.mutate(reset)} disabled={resetMut.isPending}>确认重置</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
