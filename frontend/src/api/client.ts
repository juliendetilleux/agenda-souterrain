import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'
import { useCalendarStore } from '../store/calendarStore'

const api = axios.create({
  baseURL: '/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  const accessToken = useCalendarStore.getState().accessToken

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else if (accessToken) {
    // Access link authentication: send token as query param
    config.params = { ...config.params, token: accessToken }
  }
  return config
})

// Refresh token mutex to prevent concurrent refresh calls
let isRefreshing = false
let refreshQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  refreshQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  refreshQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && originalRequest) {
      const { refreshToken, logout } = useAuthStore.getState()
      if (!refreshToken) {
        logout()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(api.request(originalRequest))
            },
            reject,
          })
        })
      }

      isRefreshing = true
      try {
        const res = await axios.post('/v1/auth/refresh', { refresh_token: refreshToken })
        const { access_token, refresh_token } = res.data
        const user = useAuthStore.getState().user!
        useAuthStore.getState().setAuth(access_token, refresh_token, user)
        processQueue(null, access_token)
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api.request(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        logout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
