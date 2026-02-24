import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from './store/authStore'
import { authApi } from './api/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import CalendarPage from './pages/CalendarPage'
import CreateCalendarPage from './pages/CreateCalendarPage'
import SettingsPage from './pages/SettingsPage'
import HomePage from './pages/HomePage'
import PrivacyPage from './pages/PrivacyPage'
import InstallPrompt from './components/ui/InstallPrompt'
import ErrorBoundary from './components/ui/ErrorBoundary'
import VerificationBanner from './components/ui/VerificationBanner'

function App() {
  const { isAuthenticated, isLoading, user, setUser, logout } = useAuthStore()
  const isSuperadmin = Boolean(isAuthenticated && user?.is_superadmin)

  // Check authentication status on app load via cookie
  useEffect(() => {
    authApi.getMe()
      .then((freshUser) => setUser(freshUser))
      .catch(() => logout())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Proactive token refresh: keeps access_token alive before it expires (15 min)
  const refreshing = useRef(false)
  useEffect(() => {
    if (!isAuthenticated) return

    const silentRefresh = async () => {
      if (refreshing.current) return
      refreshing.current = true
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || '/v1'}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        if (response.data) {
          useAuthStore.getState().setUser(response.data)
        }
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      } finally {
        refreshing.current = false
      }
    }

    // Refresh every 13 minutes (2 min before the 15-min access_token expiry)
    const interval = setInterval(silentRefresh, 13 * 60 * 1000)

    // Also refresh when the tab becomes visible again (timer may have been throttled)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') silentRefresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-lamp-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {isAuthenticated && user && !user.is_verified && <VerificationBanner />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/c/:slug" element={<CalendarPage />} />
        <Route path="/c/:slug/settings" element={<SettingsPage />} />
        <Route
          path="/new"
          element={isSuperadmin ? <CreateCalendarPage /> : <Navigate to={isAuthenticated ? '/' : '/login'} replace />}
        />
        <Route
          path="/"
          element={isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPrompt />
    </ErrorBoundary>
  )
}

export default App
