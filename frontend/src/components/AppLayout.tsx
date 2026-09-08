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
  LogOut,
  Toilet,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ROLE_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = NAV.filter((i) => user && i.roles.includes(user.role))

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
        </header>
        <Separator />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
