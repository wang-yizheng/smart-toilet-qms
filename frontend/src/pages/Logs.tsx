import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { History, ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtDateTime } from '@/lib/format'
import { ACTION_LABELS, type OperationLog } from '@/types'

const PAGE_SIZE = 20

interface ActionCount {
  action: string
  count: number
  label: string
}
interface LogStats {
  total: number
  today: number
  last7: number
  byAction: ActionCount[]
  trend: { day: string; cnt: number }[]
}

function actionVariant(action: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
  if (action === 'login') return 'secondary'
  if (action.startsWith('record.')) return 'default'
  if (action.startsWith('nc.')) return 'destructive'
  if (action.startsWith('user.') || action === 'standard.update') return 'warning'
  return 'secondary'
}

export default function Logs() {
  const [action, setAction] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [offset, setOffset] = useState(0)

  const params: Record<string, string | number> = { limit: PAGE_SIZE, offset }
  if (action !== 'all') params.action = action
  if (keyword.trim()) params.keyword = keyword.trim()
  if (from) params.from = from
  if (to) params.to = to

  const { data, isLoading } = useQuery({
    queryKey: ['logs', params],
    queryFn: () =>
      apiClient.get('/logs', { params }).then((r) => r.data as { items: OperationLog[]; total: number }),
  })
  const { data: actions } = useQuery({
    queryKey: ['log-actions'],
    queryFn: () => apiClient.get('/logs/actions').then((r) => r.data as ActionCount[]),
  })
  const { data: stats } = useQuery({
    queryKey: ['log-stats'],
    queryFn: () => apiClient.get('/logs/stats').then((r) => r.data as LogStats),
  })

  const reset = () => { setAction('all'); setKeyword(''); setFrom(''); setTo(''); setOffset(0) }
  const total = data?.total ?? 0
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + PAGE_SIZE, total)
  const topActions = (stats?.byAction ?? []).slice(0, 8)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">记录登录、任务、检测、处置等关键操作，满足质量追溯与审计要求</p>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">今日操作</div>
            <div className="text-2xl font-semibold mt-1">{stats?.today ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">近 7 天操作</div>
            <div className="text-2xl font-semibold mt-1">{stats?.last7 ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">累计操作记录</div>
            <div className="text-2xl font-semibold mt-1">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {topActions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>操作类型分布（Top {topActions.length}）</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topActions} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} 次`, '操作次数']} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />操作日志
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label>操作类型</Label>
              <Select value={action} onValueChange={(v) => { setAction(v); setOffset(0) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {(actions ?? []).map((a) => (
                    <SelectItem key={a.action} value={a.action}>{a.label}（{a.count}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>关键字</Label>
              <Input placeholder="操作人 / 内容" value={keyword} onChange={(e) => { setKeyword(e.target.value); setOffset(0) }} />
            </div>
            <div className="space-y-1">
              <Label>开始日期</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0) }} />
            </div>
            <div className="space-y-1">
              <Label>结束日期</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0) }} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={reset}>重置筛选</Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">操作时间</TableHead>
                <TableHead className="w-32">操作人</TableHead>
                <TableHead className="w-36">操作类型</TableHead>
                <TableHead>操作内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDateTime(l.created_at)}</TableCell>
                  <TableCell>{l.user_name ?? '系统'}</TableCell>
                  <TableCell><Badge variant={actionVariant(l.action)}>{ACTION_LABELS[l.action] ?? l.action}</Badge></TableCell>
                  <TableCell className="text-sm">{l.detail ?? '-'}</TableCell>
                </TableRow>
              ))}
              {!isLoading && !data?.items?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">暂无日志</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条{total > 0 && `，当前 ${start}-${end}`}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                <ChevronLeft className="h-4 w-4" />上一页
              </Button>
              <Button variant="outline" size="sm" disabled={end >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                下一页<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
