import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'
import { useCalendarStore } from '../store/calendarStore'

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15_000,
})

api.interceptors.request.use((config) => {
  // CSRF token for mutable methods
  if (config.method && !['get', 'head', 'options'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = getCsrfToken()
  }

  // Access link authentication (unchanged)
  const accessToken = useCalendarStore.getState().accessToken
  if (accessToken) {
    config.params = { ...config.params, token: accessToken }
  }
  return config
})

let isRefreshing = false
let refreshQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = []

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config
    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    // Don't try to refresh for auth endpoints (login, register, etc.)
    if (originalRequest.url?.startsWith('/auth/')) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: () => resolve(api.request(originalRequest)),
          reject,
        })
      })
    }

    isRefreshing = true
    try {
      const refreshResponse = await axios.post(
        `${import.meta.env.VITE_API_URL || '/v1'}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      if (refreshResponse.data) {
        useAuthStore.getState().setUser(refreshResponse.data)
      }
      refreshQueue.forEach((p) => p.resolve())
      refreshQueue = []
      return api.request(originalRequest)
    } catch (refreshError) {
      refreshQueue.forEach((p) => p.reject(refreshError))
      refreshQueue = []
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
