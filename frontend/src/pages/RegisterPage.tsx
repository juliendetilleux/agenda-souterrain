import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const navigate = useNavigate()

  const validatePassword = (v: string) => {
    if (v.length < 8) return t('register.minChars')
    if (!/\d/.test(v)) return t('register.needDigit')
    return ''
  }

  const handlePasswordChange = (v: string) => {
    setPassword(v)
    setPasswordError(v ? validatePassword(v) : '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validatePassword(password)
    if (err) { setPasswordError(err); return }
    setLoading(true)
    try {
      await authApi.register(email, name, password)
      toast.success(t('register.successVerification'))
      navigate('/login')
    } catch {
      toast.error(t('register.error'))
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
            {t('register.heroTitle')}
          </h1>
          <p className="mt-8 text-cave-text text-sm leading-relaxed max-w-xs">
            {t('register.heroDescription')}
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
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('register.heroMobileTitle')}</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{t('register.title')}</h2>
              <LanguageSwitcher />
            </div>
            <p className="text-stone-400 text-sm mb-8">{t('register.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  {t('register.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t('register.namePlaceholder')}
                  className="block w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm
                             text-stone-900 placeholder:text-stone-300
                             focus:border-lamp-500 focus:outline-none focus:ring-2 focus:ring-lamp-500/20
                             transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  {t('register.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('register.emailPlaceholder')}
                  className="block w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm
                             text-stone-900 placeholder:text-stone-300
                             focus:border-lamp-500 focus:outline-none focus:ring-2 focus:ring-lamp-500/20
                             transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  {t('register.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  placeholder={t('register.passwordPlaceholder')}
                  className={`block w-full rounded-xl border px-3.5 py-2.5 text-sm
                             text-stone-900 placeholder:text-stone-300
                             focus:outline-none focus:ring-2 transition-all ${
                               passwordError
                                 ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20'
                                 : 'border-stone-200 focus:border-lamp-500 focus:ring-lamp-500/20'
                             }`}
                />
                {passwordError && (
                  <p className="mt-1 text-xs text-red-500">{passwordError}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !!passwordError}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold
                           text-white bg-lamp-500 hover:bg-lamp-600 shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-lamp-500/40
                           disabled:opacity-50 transition-all mt-2"
              >
                {loading ? t('register.submitting') : t('register.submit')}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-400">
              {t('register.hasAccount')}{' '}
              <Link to="/login" className="text-lamp-600 hover:text-lamp-700 font-medium transition-colors">
                {t('register.login')}
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-stone-400">
            <Link to="/privacy" className="hover:text-stone-600 transition-colors underline">
              {tc('privacy')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
