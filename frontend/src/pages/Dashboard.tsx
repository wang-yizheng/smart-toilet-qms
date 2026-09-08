import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, ClipboardList, AlertTriangle, TrendingUp } from 'lucide-react'
import { toNum, fmtNum } from '@/lib/format'
import type { Product, DetectionItem } from '@/types'

function StatCard({ title, value, sub, icon, tone }: { title: string; value: string; sub?: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => apiClient.get('/stats/overview').then((r) => r.data),
  })
  const { data: trend } = useQuery({
    queryKey: ['trend'],
    queryFn: () => apiClient.get('/stats/pass-rate-trend?days=30').then((r) => r.data),
  })
  const { data: pareto } = useQuery({
    queryKey: ['pareto'],
    queryFn: () => apiClient.get('/stats/defect-pareto').then((r) => r.data),
  })
  const { data: models } = useQuery({
    queryKey: ['models'],
    queryFn: () => apiClient.get('/stats/model-comparison').then((r) => r.data),
  })
  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => apiClient.get('/products').then((r) => r.data as Product[]),
  })
  const { data: items } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => apiClient.get('/items').then((r) => r.data as DetectionItem[]),
  })

  const [spcPid, setSpcPid] = useState<number | null>(null)
  const [spcIid, setSpcIid] = useState<number | null>(null)
  const pid = spcPid ?? (products?.[0]?.id ?? null)
  const iid = spcIid ?? (items?.[0]?.id ?? null)

  const { data: spc } = useQuery({
    queryKey: ['spc', pid, iid],
    enabled: !!pid && !!iid,
    queryFn: () => apiClient.get(`/stats/spc?productId=${pid}&itemId=${iid}`).then((r) => r.data),
  })

  const spcItem = useMemo(() => items?.find((i) => i.id === iid), [items, iid])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="累计检测记录" value={String(overview?.total ?? '-')} sub="近 90 天" icon={<ClipboardList className="h-6 w-6 text-primary" />} tone="bg-primary/10 text-primary" />
        <StatCard title="一次交验合格率" value={`${overview?.passRate ?? '-'}%`} sub={`合格 ${overview?.pass ?? 0} / 总计 ${overview?.total ?? 0}`} icon={<TrendingUp className="h-6 w-6 text-success" />} tone="bg-success/10 text-success" />
        <StatCard title="不合格记录" value={String(overview?.fail ?? '-')} icon={<XCircle className="h-6 w-6 text-destructive" />} tone="bg-destructive/10 text-destructive" />
        <StatCard title="待处理不合格品" value={String(overview?.openNc ?? '-')} sub={`进行中任务 ${overview?.openTasks ?? 0}`} icon={<AlertTriangle className="h-6 w-6 text-warning" />} tone="bg-warning/10 text-warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>合格率趋势（近 30 天）</CardTitle>
            <CardDescription>每日检测量与合格率</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend ?? []}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="total" name="检测量" fill="var(--color-chart-3)" barSize={14} />
                <Area yAxisId="right" dataKey="rate" name="合格率%" stroke="var(--color-success)" fill="url(#g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>不良项柏拉图</CardTitle>
            <CardDescription>不合格项分布与累计占比</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={pareto ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="item" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="不良次数" fill="var(--color-chart-1)" />
                <Line yAxisId="right" dataKey="cumulative" name="累计%" stroke="var(--color-chart-4)" strokeWidth={2} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>各型号合格率对比</CardTitle>
            <CardDescription>不同产品型号的一次交验合格率</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={models ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="model" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="rate" name="合格率%" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>SPC 控制图</CardTitle>
                <CardDescription>关键检测指标的过程能力分析（均值-极差控制图与 Cpk）</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Select value={String(pid)} onValueChange={(v) => setSpcPid(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue placeholder="产品型号" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.model}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(iid)} onValueChange={(v) => setSpcIid(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue placeholder="检测项目" /></SelectTrigger>
                <SelectContent>
                  {items?.map((it) => <SelectItem key={it.id} value={String(it.id)}>{it.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {spc ? (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary">样本 n={spc.stats.n}</Badge>
                  <Badge variant="secondary">均值 {fmtNum(spc.stats.mean)}</Badge>
                  <Badge variant="secondary">标准差 {fmtNum(spc.stats.stddev)}</Badge>
                  <Badge variant="outline">UCL {fmtNum(spc.stats.UCL)}</Badge>
                  <Badge variant="outline">LCL {fmtNum(spc.stats.LCL)}</Badge>
                  <Badge variant={spc.stats.cpk != null && spc.stats.cpk >= 1.33 ? 'success' : spc.stats.cpk != null ? 'warning' : 'secondary'}>
                    Cpk {spc.stats.cpk != null ? spc.stats.cpk : 'N/A'}
                  </Badge>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={spc.points}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip />
                    {spc.stats.USL != null && <ReferenceLine y={toNum(spc.stats.USL)} stroke="var(--color-destructive)" strokeDasharray="4 2" label="USL" />}
                    {spc.stats.LSL != null && <ReferenceLine y={toNum(spc.stats.LSL)} stroke="var(--color-destructive)" strokeDasharray="4 2" label="LSL" />}
                    <ReferenceLine y={toNum(spc.stats.UCL)} stroke="var(--color-warning)" strokeDasharray="6 2" label="UCL" />
                    <ReferenceLine y={toNum(spc.stats.LCL)} stroke="var(--color-warning)" strokeDasharray="6 2" label="LCL" />
                    <ReferenceLine y={toNum(spc.stats.mean)} stroke="var(--color-chart-3)" strokeDasharray="2 2" label="均值" />
                    <Line dataKey="value" name={`${spcItem?.name}(${spcItem?.unit})`} stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground">选择产品与检测项查看控制图</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
