import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, Clock, X } from 'lucide-react'
import { calendarApi } from '../../api/calendars'
import { getPermissionLabel, PERMISSION_COLORS } from '../../utils/permissions'
import type { CalendarConfig, SubCalendar, Permission, CalendarAccess, PendingInvitation } from '../../types'
import toast from 'react-hot-toast'

const INVITE_PERMISSIONS: Permission[] = [
  'read_only_no_details',
  'read_only',
  'add_only',
  'modify_own',
  'modify',
  'administrator',
]

interface Props {
  calendar: CalendarConfig
  subCalendars: SubCalendar[]
}

// 8 distinct color pairs for avatars — chosen deterministically from email hash
const AVATAR_COLORS = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
]

function avatarColor(str: string): string {
  let hash = 0
  for (const c of str) hash = ((hash * 31) + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name: string | null, email: string | null): string {
  const s = name || email || '?'
  return s.slice(0, 2).toUpperCase()
}

const selectClass =
  'w-full text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all'

const inputClass =
  'w-full text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all placeholder:text-stone-300'

export default function UsersTab({ calendar, subCalendars }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [perm, setPerm] = useState<Permission>('read_only')
  const [subCal, setSubCal] = useState('')
  const [addGroupUserId, setAddGroupUserId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState('')

  const { data: accesses = [], isLoading } = useQuery({
    queryKey: ['access', calendar.id],
    queryFn: () => calendarApi.getAccessList(calendar.id),
  })

  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['pending-invitations', calendar.id],
    queryFn: () => calendarApi.getPendingInvitations(calendar.id),
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', calendar.id],
    queryFn: () => calendarApi.getGroups(calendar.id),
  })

  const { data: memberships = [] } = useQuery({
    queryKey: ['group-memberships', calendar.id],
    queryFn: () => calendarApi.getGroupMemberships(calendar.id),
  })

  const userAccesses: CalendarAccess[] = accesses.filter(
    (a) => a.user_id !== null && a.group_id === null && a.link_id === null
  )

  // Build a map: user_id → list of {id, name}
  const userGroupsMap = new Map<string, { id: string; name: string }[]>()
  for (const m of memberships) {
    userGroupsMap.set(m.user_id, m.groups)
  }

  const inviteMutation = useMutation({
    mutationFn: () =>
      calendarApi.inviteUser(calendar.id, {
        email,
        permission: perm,
        sub_calendar_id: subCal || undefined,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['access', calendar.id] })
      qc.invalidateQueries({ queryKey: ['pending-invitations', calendar.id] })
      qc.invalidateQueries({ queryKey: ['my-permission', calendar.id] })
      setEmail('')
      setPerm('read_only')
      setSubCal('')
      if (result.status === 'pending') {
        toast.success(t('users.toast.invitationSent'))
      } else {
        toast.success(t('users.toast.invited'))
      }
    },
    onError: () => toast.error(t('users.toast.inviteError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ accessId, permission }: { accessId: string; permission: Permission }) =>
      calendarApi.updateAccess(calendar.id, accessId, permission),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access', calendar.id] })
      qc.invalidateQueries({ queryKey: ['my-permission', calendar.id] })
    },
    onError: () => toast.error(t('users.toast.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (accessId: string) => calendarApi.deleteAccess(calendar.id, accessId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access', calendar.id] })
      qc.invalidateQueries({ queryKey: ['my-permission', calendar.id] })
      toast.success(t('users.toast.revoked'))
    },
    onError: () => toast.error(t('users.toast.revokeError')),
  })

  const deletePendingMutation = useMutation({
    mutationFn: (invitationId: string) => calendarApi.deletePendingInvitation(calendar.id, invitationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-invitations', calendar.id] })
      toast.success(t('users.toast.revoked'))
    },
    onError: () => toast.error(t('users.toast.revokeError')),
  })

  const addToGroupMutation = useMutation({
    mutationFn: ({ groupId, userEmail }: { groupId: string; userEmail: string }) =>
      calendarApi.addGroupMember(calendar.id, groupId, userEmail),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-memberships', calendar.id] })
      qc.invalidateQueries({ queryKey: ['group-members'] })
      setAddGroupUserId(null)
      setSelectedGroupId('')
      toast.success(t('users.toast.addedToGroup'))
    },
    onError: () => toast.error(t('users.toast.addToGroupError')),
  })

  const removeFromGroupMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      calendarApi.removeGroupMember(calendar.id, groupId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-memberships', calendar.id] })
      qc.invalidateQueries({ queryKey: ['group-members'] })
    },
    onError: () => toast.error(t('users.toast.removeFromGroupError')),
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    inviteMutation.mutate()
  }

  if (isLoading) return <div className="text-center py-8 text-stone-400 text-sm">{tc('loading')}</div>

  return (
    <div className="space-y-4 pt-2">
      {/* User list */}
      {userAccesses.length === 0 && pendingInvitations.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-6">{t('users.empty')}</p>
      ) : (
        <div className="space-y-2">
          {userAccesses.map((a) => {
            const key = a.user_email || a.user_name || ''
            const userGroups = a.user_id ? (userGroupsMap.get(a.user_id) || []) : []
            const isAddingGroup = addGroupUserId === a.user_id

            return (
              <div
                key={a.id}
                className="px-4 py-3 bg-white rounded-xl border border-stone-100
                           hover:border-stone-200 hover:shadow-sm transition-all duration-150"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar — color based on email hash */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(key)}`}>
                    {initials(a.user_name, a.user_email)}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800 truncate">
                      {a.user_name || a.user_email}
                    </p>
                    {a.user_name && (
                      <p className="text-xs text-stone-400 truncate">{a.user_email}</p>
                    )}
                    {a.sub_calendar_id && (
                      <p className="text-xs text-stone-400">
                        {subCalendars.find(s => s.id === a.sub_calendar_id)?.name ?? '?'}
                      </p>
                    )}
                  </div>

                  {/* Permission select — colored */}
                  <select
                    value={a.permission}
                    onChange={(e) =>
                      updateMutation.mutate({ accessId: a.id, permission: e.target.value as Permission })
                    }
                    className={`text-xs px-2 py-1 rounded-lg font-semibold border-0 cursor-pointer
                      focus:outline-none focus:ring-2 focus:ring-lamp-500/20 ${PERMISSION_COLORS[a.permission]}`}
                  >
                    {INVITE_PERMISSIONS.map((p) => (
                      <option key={p} value={p} className="bg-white text-stone-800">
                        {getPermissionLabel(p, t)}
                      </option>
                    ))}
                  </select>

                  {/* Revoke */}
                  <button
                    onClick={() => deleteMutation.mutate(a.id)}
                    title={t('users.revokeTooltip')}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Group badges row */}
                {(userGroups.length > 0 || groups.length > 0) && (
                  <div className="flex items-center gap-1.5 mt-2 ml-11 flex-wrap">
                    {userGroups.map((g) => (
                      <span
                        key={g.id}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium"
                      >
                        {g.name}
                        <button
                          onClick={() => a.user_id && removeFromGroupMutation.mutate({ groupId: g.id, userId: a.user_id })}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {isAddingGroup ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                          className="text-xs rounded-lg border border-stone-200 px-2 py-0.5 bg-white"
                          autoFocus
                        >
                          <option value="">{t('users.selectGroup')}</option>
                          {groups
                            .filter((g) => !userGroups.some((ug) => ug.id === g.id))
                            .map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                        <button
                          onClick={() => {
                            if (selectedGroupId && a.user_email) {
                              addToGroupMutation.mutate({ groupId: selectedGroupId, userEmail: a.user_email })
                            }
                          }}
                          disabled={!selectedGroupId || addToGroupMutation.isPending}
                          className="text-xs px-2 py-0.5 bg-indigo-500 text-white rounded-lg disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => { setAddGroupUserId(null); setSelectedGroupId('') }}
                          className="text-xs text-stone-400 hover:text-stone-600"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      groups.filter((g) => !userGroups.some((ug) => ug.id === g.id)).length > 0 && (
                        <button
                          onClick={() => { setAddGroupUserId(a.user_id); setSelectedGroupId('') }}
                          className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                        >
                          <Plus size={11} />
                          {t('users.addToGroup')}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Pending invitations */}
          {pendingInvitations.map((inv: PendingInvitation) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 px-4 py-3 bg-amber-50/50 rounded-xl border border-amber-100
                         transition-all duration-150"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-amber-100 text-amber-600`}>
                <Clock size={14} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 truncate">{inv.email}</p>
                <p className="text-xs text-amber-600 font-medium">{t('users.pending')}</p>
              </div>

              <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${PERMISSION_COLORS[inv.permission]}`}>
                {getPermissionLabel(inv.permission, t)}
              </span>

              <button
                onClick={() => deletePendingMutation.mutate(inv.id)}
                title={t('users.revokeTooltip')}
                className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <div className="bg-stone-50 rounded-xl border border-stone-100 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
          <Plus size={14} />
          {t('users.inviteTitle')}
        </h3>

        <form onSubmit={handleInvite} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t('users.emailPlaceholder')}
            className={inputClass}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                {t('users.permission')}
              </label>
              <select
                value={perm}
                onChange={(e) => setPerm(e.target.value as Permission)}
                className={selectClass}
              >
                {INVITE_PERMISSIONS.map((p) => (
                  <option key={p} value={p}>{getPermissionLabel(p, t)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                {t('users.subCalendar')}
              </label>
              <select
                value={subCal}
                onChange={(e) => setSubCal(e.target.value)}
                className={selectClass}
              >
                <option value="">{t('groups.allSubCals')}</option>
                {subCalendars.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="w-full py-2 text-sm bg-lamp-500 text-white rounded-lg hover:bg-lamp-600
                       font-semibold shadow-sm disabled:opacity-50 transition-all"
          >
            {inviteMutation.isPending ? tc('inviting') : tc('invite')}
          </button>
        </form>
      </div>
    </div>
  )
}
