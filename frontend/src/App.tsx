import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { usePwaStore } from './store/pwaStore'
import type { BeforeInstallPromptEvent } from './store/pwaStore'
import { authApi } from './api/auth'
import ErrorBoundary from './components/ui/ErrorBoundary'
import VerificationBanner from './components/ui/VerificationBanner'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const CreateCalendarPage = lazy(() => import('./pages/CreateCalendarPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const InstallPrompt = lazy(() => import('./components/ui/InstallPrompt'))

function App() {
  const queryClient = useQueryClient()
  const { isAuthenticated, isLoading, user, setUser, clearSession } = useAuthStore()
  const isSuperadmin = Boolean(isAuthenticated && user?.is_superadmin)

  // Check authentication status on app load via cookie
  useEffect(() => {
    authApi.getMe()
      .then((freshUser) => setUser(freshUser))
      .catch(() => {
        // The 401 interceptor handles token refresh automatically.
        // If refresh failed, it already called logout(). If it's just a
        // network error and we have a cached user, keep the session alive.
        if (!useAuthStore.getState().user) {
          clearSession()
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Capture beforeinstallprompt for PWA install button (shared via pwaStore)
  useEffect(() => {
    const { setDeferredPrompt, setIsStandalone } = usePwaStore.getState()
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    if (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true) {
      setIsStandalone(true)
    }
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Proactive token refresh: keeps access_token alive before it expires (15 min)
  const refreshing = useRef(false)
  useEffect(() => {
    if (!isAuthenticated) return

    const silentRefresh = async () => {
      if (refreshing.current) return
      refreshing.current = true
      try {
        // Use authApi.getMe() through the api client so the 401 interceptor
        // handles token refresh. This prevents a race condition where both
        // silentRefresh AND React Query refetches trigger separate /auth/refresh
        // calls with independent flags, causing double refresh → potential logout.
        const freshUser = await authApi.getMe()
        useAuthStore.getState().setUser(freshUser)
        queryClient.invalidateQueries({ queryKey: ['my-permission'] })
      } catch {
        // The interceptor already handles 401 → refresh → retry/logout.
        // If getMe() still fails after retry, the session is truly expired
        // and the interceptor has already called logout().
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

  const fallback = (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
      <div className="w-6 h-6 border-2 border-stone-300 border-t-lamp-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <ErrorBoundary>
      {isAuthenticated && user && !user.is_verified && <VerificationBanner />}
      <Suspense fallback={fallback}>
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
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
