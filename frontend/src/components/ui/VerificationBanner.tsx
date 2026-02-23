import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import toast from 'react-hot-toast'

export default function VerificationBanner() {
  const { t } = useTranslation('auth')
  const [sending, setSending] = useState(false)

  const handleResend = async () => {
    setSending(true)
    try {
      await authApi.resendVerification()
      toast.success(t('verificationBanner.resent'))
    } catch {
      toast.error(t('verificationBanner.error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-3 text-sm flex-shrink-0">
      <span className="text-amber-800">{t('verificationBanner.message')}</span>
      <button
        onClick={handleResend}
        disabled={sending}
        className="px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {sending ? t('verificationBanner.resending') : t('verificationBanner.resend')}
      </button>
    </div>
  )
}
