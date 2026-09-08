import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/lib/auth'
import { AppLayout } from '@/components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Records from './pages/Records'
import Nonconforming from './pages/Nonconforming'
import Products from './pages/Products'
import Standards from './pages/Standards'
import Reports from './pages/Reports'
import Announcements from './pages/Announcements'
import Users from './pages/Users'
import Logs from './pages/Logs'
import NotFound from './pages/NotFound'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 1 },
  },
})

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <AppLayout />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/records" element={<Records />} />
                <Route path="/nonconforming" element={<Nonconforming />} />
                <Route path="/products" element={<Products />} />
                <Route path="/standards" element={<Standards />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/users" element={<Users />} />
                <Route path="/logs" element={<Logs />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
