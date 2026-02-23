import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Trash2, Plus, CheckCircle, XCircle, Users } from 'lucide-react'
import { calendarApi } from '../../api/calendars'
import { getPermissionLabel, PERMISSION_COLORS } from '../../utils/permissions'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
import type { CalendarConfig, SubCalendar, Permission } from '../../types'
import toast from 'react-hot-toast'

const LINK_PERMISSIONS: Permission[] = [
  'read_only_no_details',
  'read_only',
  'add_only',
  'modify_own',
  'modify',
]

interface Props {
  calendar: CalendarConfig
  subCalendars: SubCalendar[]
}

const selectClass =
  'w-full text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all'

const inputClass =
  'w-full text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all placeholder:text-stone-300'

export default function LinksTab({ calendar, subCalendars }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [newLabel, setNewLabel] = useState('')
  const [newPerm, setNewPerm] = useState<Permission>('read_only')
  const [newSubCal, setNewSubCal] = useState('')
  const [newGroupId, setNewGroupId] = useState('')

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links', calendar.id],
    queryFn: () => calendarApi.getLinks(calendar.id),
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', calendar.id],
    queryFn: () => calendarApi.getGroups(calendar.id),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      calendarApi.createLink(calendar.id, {
        label: newLabel || undefined,
        permission: newPerm,
        sub_calendar_id: newSubCal || undefined,
        group_id: newGroupId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links', calendar.id] })
      setNewLabel('')
      setNewPerm('read_only')
      setNewSubCal('')
      setNewGroupId('')
      toast.success(t('links.toast.created'))
    },
    onError: () => toast.error(t('links.toast.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ linkId, data }: { linkId: string; data: { active?: boolean; permission?: Permission; group_id?: string } }) =>
      calendarApi.updateLink(calendar.id, linkId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['links', calendar.id] }),
    onError: () => toast.error(t('links.toast.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => calendarApi.deleteLink(calendar.id, linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links', calendar.id] })
      toast.success(t('links.toast.deleted'))
    },
    onError: () => toast.error(t('links.toast.deleteError')),
  })

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/c/${calendar.slug}?token=${token}`
    navigator.clipboard.writeText(url)
    toast.success(t('links.copied'))
  }

  const handleDelete = (linkId: string) => {
    confirm(t('links.deleteTitle'), t('links.deleteMsg'), () => {
      deleteMutation.mutate(linkId)
    })
  }

  if (isLoading) return <div className="text-center py-8 text-stone-400 text-sm">{tc('loading')}</div>

  return (
    <div className="space-y-4 pt-2">
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
      {/* List */}
      {links.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-6">{t('links.empty')}</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-stone-100
                         hover:border-stone-200 hover:shadow-sm transition-all duration-150"
            >
              {/* Active toggle */}
              <button
                onClick={() => updateMutation.mutate({ linkId: link.id, data: { active: !link.active } })}
                title={link.active ? t('links.disable') : t('links.enable')}
                className="flex-shrink-0 transition-opacity hover:opacity-75"
              >
                {link.active ? (
                  <CheckCircle size={17} className="text-green-500" />
                ) : (
                  <XCircle size={17} className="text-stone-300" />
                )}
              </button>

              {/* Label + permission badge + group badge */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 truncate">
                  {link.label || <span className="text-stone-400 italic font-normal">{t('links.noLabel')}</span>}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {link.permission && (
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${PERMISSION_COLORS[link.permission]}`}>
                      {getPermissionLabel(link.permission, t)}
                    </span>
                  )}
                  {link.group_name && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
                      <Users size={11} />
                      {link.group_name}
                    </span>
                  )}
                  {!link.active && (
                    <span className="text-xs text-stone-400">{tc('disabled')}</span>
                  )}
                </div>
              </div>

              {/* Copy */}
              <button
                onClick={() => copyLink(link.token)}
                title={t('links.copyLink')}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <Copy size={15} />
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDelete(link.id)}
                title={tc('delete')}
                className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="bg-stone-50 rounded-xl border border-stone-100 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
          <Plus size={14} />
          {t('links.createTitle')}
        </h3>

        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={t('links.labelPlaceholder')}
          className={inputClass}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              {t('links.permission')}
            </label>
            <select
              value={newPerm}
              onChange={(e) => setNewPerm(e.target.value as Permission)}
              className={selectClass}
            >
              {LINK_PERMISSIONS.map((p) => (
                <option key={p} value={p}>{getPermissionLabel(p, t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              {t('links.subCalendar')}
            </label>
            <select
              value={newSubCal}
              onChange={(e) => setNewSubCal(e.target.value)}
              className={selectClass}
            >
              <option value="">{t('groups.allSubCals')}</option>
              {subCalendars.map((sc) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Group selector */}
        {groups.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              {t('links.autoGroup')}
            </label>
            <select
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              className={selectClass}
            >
              <option value="">{t('links.noGroup')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p className="text-xs text-stone-400 mt-1">{t('links.autoGroupHelp')}</p>
          </div>
        )}

        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="w-full py-2 text-sm bg-lamp-500 text-white rounded-lg hover:bg-lamp-600
                     font-semibold shadow-sm disabled:opacity-50 transition-all"
        >
          {createMutation.isPending ? tc('creating') : t('links.createBtn')}
        </button>
      </div>
    </div>
  )
}
