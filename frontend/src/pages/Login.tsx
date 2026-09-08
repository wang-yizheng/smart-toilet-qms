import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Toilet } from 'lucide-react'
import { toast } from 'sonner'

const DEMO = [
  { role: '系统管理员', username: 'admin', password: 'admin123' },
  { role: '质检主管', username: 'qc', password: 'qc123456' },
  { role: '检测员', username: 'inspector', password: 'insp123456' },
  { role: '生产人员', username: 'producer', password: 'prod123456' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
            <Toilet className="h-6 w-6" />
          </div>
          <span className="text-xl font-semibold">智能马桶检测管理系统</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold leading-snug">覆盖出厂 / 过程 / 型式试验的<br />全流程质量管控平台</h2>
          <p className="text-primary-foreground/80 max-w-md">
            检测标准配置、任务派工、数据采集与自动判定、不合格品闭环处置、质量统计分析与产品追溯，一站式管理。
          </p>
        </div>
        <div className="text-sm text-primary-foreground/60">毕业设计演示系统 · 基于 React + Express + PostgreSQL</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">账号登录</CardTitle>
            <CardDescription>请使用系统分配的账号登录</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '登录中...' : '登 录'}
              </Button>
            </form>
            <div className="mt-6 rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="font-medium text-muted-foreground mb-1">演示账号（点击填充）</div>
              {DEMO.map((d) => (
                <button
                  key={d.username}
                  type="button"
                  onClick={() => { setUsername(d.username); setPassword(d.password) }}
                  className="w-full flex justify-between hover:text-primary"
                >
                  <span>{d.role}</span>
                  <span className="text-muted-foreground">{d.username} / {d.password}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
