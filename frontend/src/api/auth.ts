import api from './client'
import type { User } from '../types'

export const authApi = {
  register: (email: string, name: string, password: string) =>
    api.post<User>('/auth/register', { email, name, password }).then((r) => r.data),

  login: (email: string, password: string, rememberMe = false) =>
    api.post<User>('/auth/login', { email, password, remember_me: rememberMe }).then((r) => r.data),

  logout: () => api.post('/auth/logout').then((r) => r.data),

  getMe: () => api.get<User>('/auth/me').then((r) => r.data),

  verifyEmail: (token: string) =>
    api.post<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`).then((r) => r.data),

  resendVerification: () =>
    api.post<{ message: string }>('/auth/resend-verification').then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }).then((r) => r.data),
}
