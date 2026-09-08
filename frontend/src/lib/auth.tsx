import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient } from './api-client'
import type { User } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem('auth_token'),
    user: null,
    loading: true,
  })

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    apiClient
      .get('/auth/me')
      .then((res) => setState({ token, user: res.data, loading: false }))
      .catch(() => {
        localStorage.removeItem('auth_token')
        setState({ token: null, user: null, loading: false })
      })
  }, [])

  const login = async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password })
    const { token, user } = res.data
    localStorage.setItem('auth_token', token)
    setState({ token, user, loading: false })
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    setState({ token: null, user: null, loading: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
