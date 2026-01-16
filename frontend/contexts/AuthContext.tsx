'use client'

import { createContext, useContext, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

interface AuthContextType {
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { token, setAuth, clearAuth } = useAuthStore()

  const checkAuth = async () => {
    if (!token) return

    try {
      const response = await api.get('/auth/me')
      // Token is valid, user is already set in store
    } catch (error) {
      // Token is invalid, clear auth
      clearAuth()
    }
  }

  useEffect(() => {
    if (token) {
      checkAuth()
    }
  }, [token])

  return (
    <AuthContext.Provider value={{ checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
