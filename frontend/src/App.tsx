import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { authApi } from './api/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CalendarPage from './pages/CalendarPage'
import CreateCalendarPage from './pages/CreateCalendarPage'
import SettingsPage from './pages/SettingsPage'
import HomePage from './pages/HomePage'

function App() {
  const { token, user, setUser } = useAuthStore()
  const isSuperadmin = Boolean(token && user?.is_superadmin)

  // Refresh user data on app load to keep is_superadmin fresh
  useEffect(() => {
    if (!token) return
    authApi.getMe()
      .then((freshUser) => setUser(freshUser))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/c/:slug" element={<CalendarPage />} />
      <Route path="/c/:slug/settings" element={<SettingsPage />} />
      <Route
        path="/new"
        element={isSuperadmin ? <CreateCalendarPage /> : <Navigate to={token ? '/' : '/login'} replace />}
      />
      <Route
        path="/"
        element={token ? <HomePage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
