import { Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { setPreference } from '../../utils/storage'
import { usePwaStore } from '../../store/pwaStore'

export default function InstallPrompt() {
  const { t } = useTranslation('common')
  const { deferredPrompt, dismissed, setDeferredPrompt, setDismissed } = usePwaStore()

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
    setDismissed(true)
    setPreference('pwa-dismissed', '1')
  }

  const handleDismiss = () => {
    setDismissed(true)
    setPreference('pwa-dismissed', '1')
  }

  if (!deferredPrompt || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="bg-cave text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        <Download size={20} className="text-lamp-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{t('installApp')}</p>
          <p className="text-xs text-cave-text truncate">{t('installAppDesc')}</p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-lamp-500 text-white text-xs font-semibold rounded-lg hover:bg-lamp-600 transition-colors flex-shrink-0"
        >
          {t('install')}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-cave-text hover:text-white transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
