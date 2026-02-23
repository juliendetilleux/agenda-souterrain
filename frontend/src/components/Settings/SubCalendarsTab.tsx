import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { calendarApi } from '../../api/calendars'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
import type { CalendarConfig, SubCalendar } from '../../types'
import toast from 'react-hot-toast'

const COLORS = [
  '#e17055', '#00b894', '#fdcb6e', '#6c5ce7',
  '#fd79a8', '#00cec9', '#a29bfe', '#3788d8',
  '#e84393', '#55efc4', '#fab1a0', '#74b9ff',
]

interface Props {
  calendar: CalendarConfig
}

const inputClass =
  'w-full text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all placeholder:text-stone-300'

export default function SubCalendarsTab({ calendar }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const { data: subCalendars = [], isLoading } = useQuery({
    queryKey: ['subcalendars', calendar.id],
    queryFn: () => calendarApi.getSubCalendars(calendar.id),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      calendarApi.createSubCalendar(calendar.id, { name: newName, color: newColor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcalendars', calendar.id] })
      setNewName('')
      toast.success(t('subcalendars.toast.created'))
    },
    onError: () => toast.error(t('subcalendars.toast.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      calendarApi.updateSubCalendar(calendar.id, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcalendars', calendar.id] })
      setEditingId(null)
      toast.success(t('subcalendars.toast.updated'))
    },
    onError: () => toast.error(t('subcalendars.toast.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.deleteSubCalendar(calendar.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcalendars', calendar.id] })
      toast.success(t('subcalendars.toast.deleted'))
    },
    onError: () => toast.error(t('subcalendars.toast.deleteError')),
  })

  const startEdit = (sc: SubCalendar) => {
    setEditingId(sc.id)
    setEditName(sc.name)
    setEditColor(sc.color)
  }

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return
    updateMutation.mutate({ id: editingId, data: { name: editName.trim(), color: editColor } })
  }

  if (isLoading) {
    return <p className="text-sm text-stone-400 py-8 text-center">{tc('loading')}</p>
  }

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

      <div className="space-y-4">
        {/* List */}
        {subCalendars.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">{t('subcalendars.empty')}</p>
        ) : (
          <div className="space-y-1">
            {subCalendars.map((sc) => (
              <div
                key={sc.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 group transition-colors"
              >
                {editingId === sc.id ? (
                  <>
                    <div className="flex gap-1 flex-shrink-0">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={`w-5 h-5 rounded-full transition-all ${
                            editColor === c ? 'ring-2 ring-offset-1 ring-stone-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim()}
                      className="p-1 rounded hover:bg-green-50 text-green-500 disabled:opacity-40"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded hover:bg-stone-100 text-stone-400"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sc.color }}
                    />
                    <span className="text-sm text-stone-700 flex-1 font-medium">{sc.name}</span>
                    <button
                      onClick={() => startEdit(sc)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-100 text-stone-400 transition-all"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() =>
                        confirm(
                          t('subcalendars.deleteTitle'),
                          t('subcalendars.deleteMsg', { name: sc.name }),
                          () => deleteMutation.mutate(sc.id)
                        )
                      }
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create form */}
        <div className="bg-stone-50 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            {t('subcalendars.newSubCalendar')}
          </h4>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full transition-all ${
                  newColor === c ? 'ring-2 ring-offset-1 ring-stone-400 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (newName.trim()) createMutation.mutate()
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('subcalendars.namePlaceholder')}
              className={`${inputClass} flex-1`}
            />
            <button
              type="submit"
              disabled={!newName.trim() || createMutation.isPending}
              className="px-4 py-2 text-sm bg-lamp-500 text-white rounded-lg hover:bg-lamp-600
                         font-semibold disabled:opacity-50 transition-all"
            >
              {tc('create')}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
