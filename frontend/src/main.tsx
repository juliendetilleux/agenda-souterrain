import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import App from './App'
import './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
  queryCache: new QueryCache({
    onError: (_error, query) => {
      // Toast uniquement pour les refetch en arrière-plan (des données étaient déjà chargées)
      if (query.state.data !== undefined) {
        toast.error('Erreur de synchronisation')
      }
    },
  }),
})

// Clean up legacy token storage from localStorage (migrated to HTTP-only cookies)
localStorage.removeItem('auth-storage')

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
