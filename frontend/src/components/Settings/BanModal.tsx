import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { User } from '../../types'
import type { BanUserPayload } from '../../api/admin'

interface Props {
  user: User
  isPending: boolean
  onSubmit: (payload: BanUserPayload) => void
  onCancel: () => void
}

export default function BanModal({ user, isPending, onSubmit, onCancel }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const overlayRef = useRef<HTMLDivElement>(null)
  const [permanent, setPermanent] = useState(true)
  const [until, setUntil] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleSubmit = () => {
    const payload: BanUserPayload = {
      permanent,
      reason: reason.trim() || null,
    }
    if (!permanent) {
      if (!until) return
      payload.until = new Date(until).toISOString()
    }
    onSubmit(payload)
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 16)

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onCancel()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-stone-900 mb-1">
          {t('superadminUsers.banTitle')}
        </h3>
        <p className="text-sm text-stone-500 mb-5">
          {t('superadminUsers.banMsg', { name: user.name })}
        </p>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setPermanent(true)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              permanent
                ? 'bg-orange-50 border-orange-300 text-orange-700'
                : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
            }`}
          >
            {t('superadminUsers.permanent')}
          </button>
          <button
            type="button"
            onClick={() => setPermanent(false)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              !permanent
                ? 'bg-orange-50 border-orange-300 text-orange-700'
                : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
            }`}
          >
            {t('superadminUsers.temporary')}
          </button>
        </div>

        {!permanent && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {t('superadminUsers.banUntilLabel')}
            </label>
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              min={minDate}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
            />
          </div>
        )}

        <div className="mb-5">
          <label className="block text-xs font-medium text-stone-600 mb-1">
            {t('superadminUsers.banReasonLabel')}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('superadminUsers.banReasonPlaceholder')}
            maxLength={500}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800
                       rounded-xl hover:bg-stone-100 transition-colors"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || (!permanent && !until)}
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm
                       bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {t('superadminUsers.confirmBan')}
          </button>
        </div>
      </div>
    </div>
  )
}
