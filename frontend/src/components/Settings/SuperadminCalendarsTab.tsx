import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Trash2 } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
import type { CalendarAdminItem } from '../../types'
import toast from 'react-hot-toast'

export default function SuperadminCalendarsTab() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()

  const { data: calendars = [], isLoading } = useQuery({
    queryKey: ['admin-calendars'],
    queryFn: adminApi.getCalendars,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCalendar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-calendars'] })
      toast.success(t('superadminCalendars.toast.deleted'))
    },
    onError: () => toast.error(t('superadminCalendars.toast.deleteError')),
  })

  const handleDelete = (cal: CalendarAdminItem) => {
    confirm(t('superadminCalendars.deleteTitle'), t('superadminCalendars.deleteMsg', { title: cal.title }), () => {
      deleteMutation.mutate(cal.id)
    })
  }

  if (isLoading) return <div className="text-center py-12 text-stone-400 text-sm">{tc('loading')}</div>

  return (
    <>
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          danger
          confirmLabel={tc('delete')}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                {t('superadminCalendars.calendar')}
              </th>
              <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                {t('superadminCalendars.owner')}
              </th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {calendars.map((cal) => (
              <tr key={cal.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-5 py-4">
                  <p className="font-semibold text-stone-800">{cal.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">/c/{cal.slug}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm text-stone-700">{cal.owner_name}</p>
                  <p className="text-xs text-stone-400">{cal.owner_email}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => navigate(`/c/${cal.slug}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 text-stone-600 border border-stone-200 rounded-lg
                                 hover:bg-stone-100 transition-all font-medium"
                    >
                      <ExternalLink size={13} />
                      {tc('see')}
                    </button>
                    <button
                      onClick={() => handleDelete(cal)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 text-red-600 border border-red-200 rounded-lg
                                 hover:bg-red-50 disabled:opacity-50 transition-all font-medium"
                    >
                      <Trash2 size={13} />
                      {tc('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {calendars.length === 0 && (
          <p className="text-center text-stone-400 py-10 text-sm">{t('superadminCalendars.empty')}</p>
        )}
      </div>
    </>
  )
}
