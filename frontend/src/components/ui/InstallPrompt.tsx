import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const { t } = useTranslation('common')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismissed') === '1')

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Hide if already installed
    const matchMedia = window.matchMedia?.('(display-mode: standalone)')
    if (matchMedia?.matches) setDismissed(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
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
