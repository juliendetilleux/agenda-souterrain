import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t: tc } = useTranslation('common')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onCancel()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-stone-900 mb-2">{title}</h3>
        <p className="text-sm text-stone-500 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800
                       rounded-xl hover:bg-stone-100 transition-colors"
          >
            {cancelLabel || tc('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-lamp-500 hover:bg-lamp-600'
            }`}
          >
            {confirmLabel || tc('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
