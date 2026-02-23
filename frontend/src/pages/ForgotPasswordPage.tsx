import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } catch {
      // Always show success to not reveal if email exists
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-cave flex-col justify-between p-14 flex-shrink-0">
        <div>
          <p className="text-lamp-500 text-xs font-bold uppercase tracking-[0.25em] mb-8">
            ↓ {tc('brand')}
          </p>
          <h1 className="text-5xl font-bold text-cave-text-active leading-[1.15] tracking-tight whitespace-pre-line">
            {t('forgotPassword.heroTitle')}
          </h1>
          <p className="mt-8 text-cave-text text-sm leading-relaxed max-w-xs">
            {t('forgotPassword.heroDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-lamp-500" />
          <p className="text-cave-text text-xs">{tc('copyright')}</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-[#f8f7f4] p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <p className="text-lamp-600 text-xs font-bold uppercase tracking-[0.2em] mb-2">↓ {tc('brand')}</p>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('forgotPassword.heroMobileTitle')}</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{t('forgotPassword.title')}</h2>
              <LanguageSwitcher />
            </div>
            <p className="text-stone-400 text-sm mb-8">{t('forgotPassword.subtitle')}</p>

            {sent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-stone-600 text-sm mb-6">{t('forgotPassword.success')}</p>
                <Link
                  to="/login"
                  className="text-lamp-600 hover:text-lamp-700 font-medium text-sm transition-colors"
                >
                  {t('forgotPassword.backToLogin')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                    {t('forgotPassword.email')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t('forgotPassword.emailPlaceholder')}
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
                  {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
                </button>
              </form>
            )}

            {!sent && (
              <p className="mt-6 text-center text-sm text-stone-400">
                <Link to="/login" className="text-lamp-600 hover:text-lamp-700 font-medium transition-colors">
                  {t('forgotPassword.backToLogin')}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
