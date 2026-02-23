import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCookieConsentStore } from '../../store/cookieConsentStore'

export default function CookieConsent() {
  const { t } = useTranslation('privacy')
  const { consent, acceptAll, rejectOptional, setConsent } = useCookieConsentStore()
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState(true)
  const [analytics, setAnalytics] = useState(false)

  if (consent !== null) return null

  const handleSave = () => {
    setConsent({ necessary: true, preferences, analytics })
  }

  if (showSettings) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-stone-900 mb-1">{t('settings.title')}</h3>
          <p className="text-sm text-stone-500 mb-5">{t('settings.description')}</p>

          <div className="space-y-4">
            {/* Necessary - always on */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">{t('settings.necessary')}</p>
                <p className="text-xs text-stone-400">{t('settings.necessaryDesc')}</p>
              </div>
              <div className="w-10 h-5 rounded-full bg-lamp-500 opacity-50 cursor-not-allowed relative">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white" />
              </div>
            </div>

            {/* Preferences */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">{t('settings.preferences')}</p>
                <p className="text-xs text-stone-400">{t('settings.preferencesDesc')}</p>
              </div>
              <button
                onClick={() => setPreferences(!preferences)}
                className={`w-10 h-5 rounded-full relative transition-colors ${preferences ? 'bg-lamp-500' : 'bg-stone-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${preferences ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Analytics */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">{t('settings.analytics')}</p>
                <p className="text-xs text-stone-400">{t('settings.analyticsDesc')}</p>
              </div>
              <button
                onClick={() => setAnalytics(!analytics)}
                className={`w-10 h-5 rounded-full relative transition-colors ${analytics ? 'bg-lamp-500' : 'bg-stone-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${analytics ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-lamp-500 hover:bg-lamp-600 transition-colors"
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-stone-900 border-t border-stone-700 px-4 py-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-stone-300 flex-1">
          {t('banner.text')}{' '}
          <Link to="/privacy" className="text-lamp-400 hover:text-lamp-300 underline">
            {t('banner.learnMore')}
          </Link>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={rejectOptional}
            className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors"
          >
            {t('banner.necessaryOnly')}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1.5 text-xs border border-stone-600 text-stone-300 hover:border-stone-400 rounded-lg transition-colors"
          >
            {t('banner.configure')}
          </button>
          <button
            onClick={acceptAll}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-lamp-500 hover:bg-lamp-600 rounded-lg transition-colors"
          >
            {t('banner.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  )
}
