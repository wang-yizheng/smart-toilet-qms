import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pin } from 'lucide-react'
import { fmtDateTime } from '@/lib/format'
import { useAuth } from '@/lib/auth'
import { ROLE_LABELS, type Announcement } from '@/types'

export default function Announcements() {
  const me = useAuth()
  const canManage = me.user?.role === 'admin' || me.user?.role === 'qc_manager'
  const qc = useQueryClient()
  const { data: list } = useQuery({ queryKey: ['ann'], queryFn: () => apiClient.get('/announcements').then((r) => r.data as Announcement[]) })
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', content: '', pinned: false })

  const mut = useMutation({
    mutationFn: (b: any) => apiClient.post('/announcements', b),
    onSuccess: () => { toast.success('已发布'); setOpen(false); setF({ title: '', content: '', pinned: false }); qc.invalidateQueries({ queryKey: ['ann'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || '发布失败'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground">质量公告、标准变更与整改要求</h2>
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />发布公告</Button>}
      </div>

      <div className="grid gap-3">
        {(list ?? []).map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {a.pinned && <Badge variant="warning" className="gap-1"><Pin className="h-3 w-3" />置顶</Badge>}
                <span className="font-semibold">{a.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{a.author_name} · {fmtDateTime(a.created_at)}</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
            </CardContent>
          </Card>
        ))}
        {!list?.length && <Card><CardContent className="text-center text-muted-foreground py-8">暂无公告</CardContent></Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>发布公告</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>标题</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div className="space-y-1"><Label>内容</Label><Textarea value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={f.pinned} onCheckedChange={(v) => setF({ ...f, pinned: v })} /><Label>置顶公告</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={() => mut.mutate(f)} disabled={mut.isPending}>发布</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
