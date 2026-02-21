import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const tokens = await authApi.login(email, password)
      setAuth(tokens.access_token, tokens.refresh_token, {
        id: '', email, name: email, is_verified: true,
        is_admin: false, is_superadmin: false, created_at: '',
      })
      const me = await authApi.getMe()
      setAuth(tokens.access_token, tokens.refresh_token, me)
      navigate('/')
    } catch {
      toast.error(t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — cave dark, branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-cave flex-col justify-between p-14 flex-shrink-0">
        <div>
          <p className="text-lamp-500 text-xs font-bold uppercase tracking-[0.25em] mb-8">
            ↓ {tc('brand')}
          </p>
          <h1 className="text-5xl font-bold text-cave-text-active leading-[1.15] tracking-tight whitespace-pre-line">
            {t('login.heroTitle')}
          </h1>
          <p className="mt-8 text-cave-text text-sm leading-relaxed max-w-xs">
            {t('login.heroDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-lamp-500" />
          <p className="text-cave-text text-xs">{tc('copyright')}</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#f8f7f4] p-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8 text-center">
            <p className="text-lamp-600 text-xs font-bold uppercase tracking-[0.2em] mb-2">↓ {tc('brand')}</p>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('login.heroMobileTitle')}</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{t('login.title')}</h2>
              <LanguageSwitcher />
            </div>
            <p className="text-stone-400 text-sm mb-8">{t('login.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  {t('login.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('login.emailPlaceholder')}
                  className="block w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm
                             text-stone-900 placeholder:text-stone-300
                             focus:border-lamp-500 focus:outline-none focus:ring-2 focus:ring-lamp-500/20
                             transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  {t('login.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm
                             text-stone-900 placeholder:text-stone-300
                             focus:border-lamp-500 focus:outline-none focus:ring-2 focus:ring-lamp-500/20
                             transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold
                           text-white bg-lamp-500 hover:bg-lamp-600 shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-lamp-500/40
                           disabled:opacity-50 transition-all mt-2"
              >
                {loading ? t('login.submitting') : t('login.submit')}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-400">
              {t('login.noAccount')}{' '}
              <Link to="/register" className="text-lamp-600 hover:text-lamp-700 font-medium transition-colors">
                {t('login.register')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
