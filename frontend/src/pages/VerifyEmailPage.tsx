import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function VerifyEmailPage() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-cave flex-col justify-between p-14 flex-shrink-0">
        <div>
          <p className="text-lamp-500 text-xs font-bold uppercase tracking-[0.25em] mb-8">
            ↓ {tc('brand')}
          </p>
          <h1 className="text-5xl font-bold text-cave-text-active leading-[1.15] tracking-tight">
            {t('verification.heroTitle')}
          </h1>
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
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <div className="flex justify-end mb-4">
              <LanguageSwitcher />
            </div>

            {status === 'loading' && (
              <>
                <div className="w-10 h-10 border-3 border-lamp-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-stone-500 text-sm">{t('verification.verifying')}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-stone-900 mb-2">{t('verification.success')}</h2>
                <Link
                  to="/login"
                  className="inline-block mt-4 px-6 py-2.5 bg-lamp-500 text-white text-sm font-semibold rounded-xl hover:bg-lamp-600 transition-colors"
                >
                  {t('verification.goToLogin')}
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-stone-900 mb-2">{t('verification.error')}</h2>
                <Link
                  to="/login"
                  className="inline-block mt-4 px-6 py-2.5 bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl hover:bg-stone-300 transition-colors"
                >
                  {t('verification.goToLogin')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
