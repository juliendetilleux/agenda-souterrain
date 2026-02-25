import { create } from 'zustand'
import type { User } from '../types'

const storedUser = ((): User | null => {
  try {
    const raw = localStorage.getItem('auth-user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
})()

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: storedUser,
  isAuthenticated: !!storedUser,
  isLoading: !storedUser,
  setUser: (user) => {
    localStorage.setItem('auth-user', JSON.stringify(user))
    set({ user, isAuthenticated: true, isLoading: false })
  },
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => {
    localStorage.removeItem('auth-user')
    set({ user: null, isAuthenticated: false, isLoading: false })
  },
}))
