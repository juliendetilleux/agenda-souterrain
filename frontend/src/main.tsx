import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

// Clean up legacy token storage from localStorage (migrated to HTTP-only cookies)
localStorage.removeItem('auth-storage')

// Register service worker for PWA installability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
