import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, ChevronDown, ChevronRight, UserMinus, X } from 'lucide-react'
import { calendarApi } from '../../api/calendars'
import { getPermissionLabel, PERMISSION_COLORS } from '../../utils/permissions'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
import type { CalendarConfig, SubCalendar, Permission, Group } from '../../types'
import toast from 'react-hot-toast'

const GROUP_PERMISSIONS: Permission[] = [
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
  'text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all'

const inputClass =
  'flex-1 text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all placeholder:text-stone-300'

function GroupRow({ calendar, group, subCalendars }: { calendar: CalendarConfig; group: Group; subCalendars: SubCalendar[] }) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [expanded, setExpanded] = useState(false)
  const [memberEmail, setMemberEmail] = useState('')
  const [groupPerm, setGroupPerm] = useState<Permission>('read_only')
  const [groupSubCal, setGroupSubCal] = useState('')

  const { data: members = [] } = useQuery({
    queryKey: ['group-members', calendar.id, group.id],
    queryFn: () => calendarApi.getGroupMembers(calendar.id, group.id),
    enabled: expanded,
  })

  const { data: groupAccess = [] } = useQuery({
    queryKey: ['group-access', calendar.id, group.id],
    queryFn: () => calendarApi.getGroupAccess(calendar.id, group.id),
    enabled: expanded,
  })

  const addMemberMutation = useMutation({
    mutationFn: () => calendarApi.addGroupMember(calendar.id, group.id, memberEmail),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', calendar.id, group.id] })
      qc.invalidateQueries({ queryKey: ['group-memberships', calendar.id] })
      setMemberEmail('')
      toast.success(t('groups.toast.memberAdded'))
    },
    onError: () => toast.error(t('groups.toast.userNotFound')),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => calendarApi.removeGroupMember(calendar.id, group.id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', calendar.id, group.id] })
      qc.invalidateQueries({ queryKey: ['group-memberships', calendar.id] })
    },
    onError: () => toast.error(t('groups.toast.deleteError')),
  })

  const setAccessMutation = useMutation({
    mutationFn: () =>
      calendarApi.setGroupAccess(calendar.id, group.id, {
        permission: groupPerm,
        sub_calendar_id: groupSubCal || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-access', calendar.id, group.id] })
      qc.invalidateQueries({ queryKey: ['access', calendar.id] })
      toast.success(t('groups.toast.permissionUpdated'))
    },
    onError: () => toast.error(t('groups.toast.updateError')),
  })

  const deleteAccessMutation = useMutation({
    mutationFn: (accessId: string) => calendarApi.deleteGroupAccess(calendar.id, group.id, accessId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-access', calendar.id, group.id] })
      qc.invalidateQueries({ queryKey: ['access', calendar.id] })
      toast.success(t('groups.toast.permissionRemoved'))
    },
    onError: () => toast.error(t('groups.toast.deleteError')),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: () => calendarApi.deleteGroup(calendar.id, group.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', calendar.id] })
      toast.success(t('groups.toast.deleted'))
    },
    onError: () => toast.error(t('groups.toast.groupDeleteError')),
  })

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
    <div className="bg-white rounded-xl border border-stone-100 overflow-hidden hover:border-stone-200 transition-all duration-150">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded
            ? <ChevronDown size={15} className="text-stone-400 flex-shrink-0" />
            : <ChevronRight size={15} className="text-stone-400 flex-shrink-0" />
          }
          <span className="text-sm font-semibold text-stone-800">{group.name}</span>
          {groupAccess.length > 0 && (
            <span className="text-xs text-stone-400 ml-1">
              ({groupAccess.length} {t('groups.permCount')})
            </span>
          )}
        </button>

        <button
          onClick={() => {
            confirm(t('groups.deleteTitle'), t('groups.deleteMsg', { name: group.name }), () => {
              deleteGroupMutation.mutate()
            })
          }}
          className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Expanded panel */}
      <div
        className={`transition-all duration-200 overflow-hidden ${
          expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-stone-100 bg-stone-50 px-4 py-4 space-y-4">
          {/* Members list */}
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{t('groups.members')}</p>
            {members.length === 0 ? (
              <p className="text-xs text-stone-400 italic">{t('groups.noMembers')}</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-2 border border-stone-100">
                    <span className="flex-1 font-medium text-stone-700 text-xs">{m.name || m.email}</span>
                    <span className="text-xs text-stone-400">{m.email}</span>
                    <button
                      onClick={() => removeMemberMutation.mutate(m.id)}
                      className="p-0.5 rounded hover:text-red-500 text-stone-300 transition-colors"
                    >
                      <UserMinus size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add member */}
            <div className="flex gap-2">
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder={t('groups.memberEmailPlaceholder')}
                className={inputClass}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), memberEmail && addMemberMutation.mutate())}
              />
              <button
                onClick={() => memberEmail && addMemberMutation.mutate()}
                disabled={addMemberMutation.isPending}
                className="px-3 py-2 text-sm bg-lamp-500 text-white rounded-lg hover:bg-lamp-600 disabled:opacity-50 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Permissions list */}
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{t('groups.permissions')}</p>
            {groupAccess.length === 0 ? (
              <p className="text-xs text-stone-400 italic mb-2">{t('groups.noPermissions')}</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {groupAccess.map((ga) => (
                  <div key={ga.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-stone-100">
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${PERMISSION_COLORS[ga.permission]}`}>
                      {getPermissionLabel(ga.permission, t)}
                    </span>
                    <span className="flex-1 text-xs text-stone-600">
                      {ga.sub_calendar_name || t('groups.allSubCals')}
                    </span>
                    <button
                      onClick={() => deleteAccessMutation.mutate(ga.id)}
                      className="p-0.5 rounded hover:text-red-500 text-stone-300 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add permission */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div>
                <label className="block text-xs text-stone-400 mb-1">{t('groups.level')}</label>
                <select
                  value={groupPerm}
                  onChange={(e) => setGroupPerm(e.target.value as Permission)}
                  className={selectClass}
                >
                  {GROUP_PERMISSIONS.map((p) => (
                    <option key={p} value={p}>{getPermissionLabel(p, t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">{t('groups.subCal')}</label>
                <select
                  value={groupSubCal}
                  onChange={(e) => setGroupSubCal(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t('groups.allSubCals')}</option>
                  {subCalendars.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setAccessMutation.mutate()}
                disabled={setAccessMutation.isPending}
                className="px-3 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 disabled:opacity-50 transition-colors font-medium"
              >
                {t('groups.addPermission')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default function GroupsTab({ calendar, subCalendars }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups', calendar.id],
    queryFn: () => calendarApi.getGroups(calendar.id),
  })

  const createGroupMutation = useMutation({
    mutationFn: () => calendarApi.createGroup(calendar.id, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', calendar.id] })
      setNewName('')
      toast.success(t('groups.toast.created'))
    },
    onError: () => toast.error(t('groups.toast.createError')),
  })

  if (isLoading) return <div className="text-center py-8 text-stone-400 text-sm">{tc('loading')}</div>

  return (
    <div className="space-y-4 pt-2">
      {/* Groups list */}
      {groups.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-6">{t('groups.empty')}</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <GroupRow key={g.id} calendar={calendar} group={g} subCalendars={subCalendars} />
          ))}
        </div>
      )}

      {/* Create group form */}
      <div className="bg-stone-50 rounded-xl border border-stone-100 p-4">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2 mb-3">
          <Plus size={14} />
          {t('groups.createTitle')}
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('groups.namePlaceholder')}
            className={inputClass}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), newName && createGroupMutation.mutate())}
          />
          <button
            onClick={() => newName && createGroupMutation.mutate()}
            disabled={createGroupMutation.isPending}
            className="px-4 py-2 text-sm bg-lamp-500 text-white rounded-lg hover:bg-lamp-600
                       font-semibold disabled:opacity-50 transition-all"
          >
            {createGroupMutation.isPending ? '...' : tc('create')}
          </button>
        </div>
      </div>
    </div>
  )
}
