import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ReactNode } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  FileBarChart,
  AlertTriangle,
  Package,
  SlidersHorizontal,
  FileText,
  Bell,
  Users,
  History,
  LogOut,
  Toilet,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { fmtDateTime } from '@/lib/format'
import { useAuth } from '@/lib/auth'
import { ROLE_LABELS, type Notification } from '@/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  roles: string[]
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: '质量仪表盘', icon: <LayoutDashboard className="h-4 w-4" />, roles: ['admin', 'qc_manager', 'inspector', 'producer'] },
  { to: '/tasks', label: '检测任务', icon: <ClipboardList className="h-4 w-4" />, roles: ['admin', 'qc_manager', 'inspector', 'producer'] },
  { to: '/records', label: '检测记录', icon: <FileBarChart className="h-4 w-4" />, roles: ['admin', 'qc_manager', 'inspector', 'producer'] },
  { to: '/nonconforming', label: '不合格品', icon: <AlertTriangle className="h-4 w-4" />, roles: ['admin', 'qc_manager', 'inspector', 'producer'] },
  { to: '/products', label: '产品与基础数据', icon: <Package className="h-4 w-4" />, roles: ['admin', 'qc_manager'] },
  { to: '/standards', label: '检测标准', icon: <SlidersHorizontal className="h-4 w-4" />, roles: ['admin', 'qc_manager'] },
  { to: '/reports', label: '报表与追溯', icon: <FileText className="h-4 w-4" />, roles: ['admin', 'qc_manager', 'inspector', 'producer'] },
  { to: '/announcements', label: '公告通知', icon: <Bell className="h-4 w-4" />, roles: ['admin', 'qc_manager', 'inspector', 'producer'] },
  { to: '/users', label: '用户管理', icon: <Users className="h-4 w-4" />, roles: ['admin'] },
  { to: '/logs', label: '操作日志', icon: <History className="h-4 w-4" />, roles: ['admin', 'qc_manager'] },
]

const TITLES: Record<string, string> = {
  '/dashboard': '质量仪表盘',
  '/tasks': '检测任务管理',
  '/records': '检测记录管理',
  '/nonconforming': '不合格品管理',
  '/products': '产品与基础数据',
  '/standards': '检测标准管理',
  '/reports': '报表与质量追溯',
  '/announcements': '公告通知',
  '/users': '用户管理',
  '/logs': '操作日志',
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = NAV.filter((i) => user && i.roles.includes(user.role))

  const qc = useQueryClient()
  const { data: notif } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiClient.get('/notifications').then((r) => r.data as { items: Notification[]; unread: number }),
    refetchInterval: 60_000,
  })
  const readMut = useMutation({
    mutationFn: (id: number) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const readAllMut = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const unread = notif?.unread ?? 0

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Toilet className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">智能马桶</div>
            <div className="text-xs text-muted-foreground">检测管理系统</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              {it.icon}
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border text-xs text-muted-foreground">
          毕业设计演示系统 v1.0
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-card border-b flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold">{TITLES[location.pathname] ?? '智能马桶检测管理系统'}</h1>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm font-medium">消息通知</span>
                  {unread > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => readAllMut.mutate()}>
                      全部已读
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {(notif?.items ?? []).length ? (
                  (notif!.items).map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex flex-col items-start gap-1 py-2"
                      onClick={() => !n.is_read && readMut.mutate(n.id)}
                    >
                      <div className="flex w-full items-center gap-2">
                        {!n.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
                        <span className="truncate text-sm font-medium">{n.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{n.type_label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{n.content}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDateTime(n.created_at)}</span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无消息</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user?.name?.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left leading-tight">
                  <div className="text-sm font-medium">{user?.name}</div>
                  <div className="text-xs text-muted-foreground">{user && ROLE_LABELS[user.role]}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { logout(); navigate('/login') }}>
                <LogOut className="h-4 w-4 mr-2" /> 退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        <Separator />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
