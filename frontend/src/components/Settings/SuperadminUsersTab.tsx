import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, ShieldOff, Trash2, Ban, ShieldCheck } from 'lucide-react'
import { adminApi } from '../../api/admin'
import type { BanUserPayload } from '../../api/admin'
import { useAuthStore } from '../../store/authStore'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
import BanModal from './BanModal'
import type { User } from '../../types'
import toast from 'react-hot-toast'

function PermissionBadge({ user }: { user: User }) {
  const { t } = useTranslation('settings')
  if (user.is_superadmin) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700">
        <Shield size={11} /> {t('superadminUsers.superadmin')}
      </span>
    )
  }
  if (user.is_banned) {
    const banLabel = user.ban_until
      ? t('superadminUsers.bannedUntil', { date: new Date(user.ban_until).toLocaleDateString() })
      : t('superadminUsers.bannedPermanent')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-100 text-orange-700">
        <Ban size={11} /> {banLabel}
      </span>
    )
  }
  if (user.is_admin) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-lamp-100 text-lamp-700">
        <Shield size={11} /> {t('superadminUsers.admin')}
      </span>
    )
  }
  return (
    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-500">
      {t('superadminUsers.regularUser')}
    </span>
  )
}

export default function SuperadminUsersTab() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [banTarget, setBanTarget] = useState<User | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  })

  const promoteMutation = useMutation({
    mutationFn: (id: string) => adminApi.promote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('superadminUsers.toast.promoted'))
    },
    onError: () => toast.error(t('superadminUsers.toast.promoteError')),
  })

  const demoteMutation = useMutation({
    mutationFn: (id: string) => adminApi.demote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('superadminUsers.toast.demoted'))
    },
    onError: () => toast.error(t('superadminUsers.toast.demoteError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('superadminUsers.toast.deleted'))
    },
    onError: () => toast.error(t('superadminUsers.toast.deleteError')),
  })

  const banMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BanUserPayload }) =>
      adminApi.banUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('superadminUsers.toast.banned'))
      setBanTarget(null)
    },
    onError: () => toast.error(t('superadminUsers.toast.banError')),
  })

  const unbanMutation = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('superadminUsers.toast.unbanned'))
    },
    onError: () => toast.error(t('superadminUsers.toast.unbanError')),
  })

  const handleDelete = (user: User) => {
    confirm(
      t('superadminUsers.deleteTitle'),
      t('superadminUsers.deleteMsg', { name: user.name }),
      () => deleteMutation.mutate(user.id),
    )
  }

  const handleBanSubmit = (payload: BanUserPayload) => {
    if (banTarget) {
      banMutation.mutate({ id: banTarget.id, payload })
    }
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
      {banTarget && (
        <BanModal
          user={banTarget}
          isPending={banMutation.isPending}
          onSubmit={handleBanSubmit}
          onCancel={() => setBanTarget(null)}
        />
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        {/* Desktop: table */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  {t('superadminUsers.user')}
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  {t('superadminUsers.role')}
                </th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-stone-800">{u.name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{u.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <PermissionBadge user={u} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      {!u.is_superadmin && u.id !== currentUser?.id && (
                        <>
                          {u.is_admin ? (
                            <button
                              onClick={() => demoteMutation.mutate(u.id)}
                              disabled={demoteMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                         text-stone-600 border border-stone-200 rounded-lg
                                         hover:bg-stone-100 disabled:opacity-50 transition-all font-medium"
                            >
                              <ShieldOff size={13} />
                              {t('superadminUsers.revoke')}
                            </button>
                          ) : (
                            <button
                              onClick={() => promoteMutation.mutate(u.id)}
                              disabled={promoteMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                         text-lamp-700 border border-lamp-200 rounded-lg
                                         hover:bg-lamp-50 disabled:opacity-50 transition-all font-medium"
                            >
                              <Shield size={13} />
                              {t('superadminUsers.promote')}
                            </button>
                          )}

                          {u.is_banned ? (
                            <button
                              onClick={() => unbanMutation.mutate(u.id)}
                              disabled={unbanMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                         text-green-700 border border-green-200 rounded-lg
                                         hover:bg-green-50 disabled:opacity-50 transition-all font-medium"
                            >
                              <ShieldCheck size={13} />
                              {t('superadminUsers.unban')}
                            </button>
                          ) : (
                            <button
                              onClick={() => setBanTarget(u)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                         text-orange-700 border border-orange-200 rounded-lg
                                         hover:bg-orange-50 transition-all font-medium"
                            >
                              <Ban size={13} />
                              {t('superadminUsers.ban')}
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(u)}
                            disabled={deleteMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                       text-red-600 border border-red-200 rounded-lg
                                       hover:bg-red-50 disabled:opacity-50 transition-all font-medium"
                          >
                            <Trash2 size={13} />
                            {tc('delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="sm:hidden space-y-2 p-3">
          {users.map((u) => (
            <div key={u.id} className="bg-stone-50 rounded-xl p-3 space-y-2">
              <div>
                <p className="font-semibold text-stone-800 text-sm">{u.name}</p>
                <p className="text-xs text-stone-400">{u.email}</p>
              </div>
              <div>
                <PermissionBadge user={u} />
              </div>
              {!u.is_superadmin && u.id !== currentUser?.id && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {u.is_admin ? (
                    <button
                      onClick={() => demoteMutation.mutate(u.id)}
                      disabled={demoteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 text-stone-600 border border-stone-200 rounded-lg
                                 hover:bg-stone-100 disabled:opacity-50 transition-all font-medium"
                    >
                      <ShieldOff size={13} />
                      {t('superadminUsers.revoke')}
                    </button>
                  ) : (
                    <button
                      onClick={() => promoteMutation.mutate(u.id)}
                      disabled={promoteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 text-lamp-700 border border-lamp-200 rounded-lg
                                 hover:bg-lamp-50 disabled:opacity-50 transition-all font-medium"
                    >
                      <Shield size={13} />
                      {t('superadminUsers.promote')}
                    </button>
                  )}

                  {u.is_banned ? (
                    <button
                      onClick={() => unbanMutation.mutate(u.id)}
                      disabled={unbanMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 text-green-700 border border-green-200 rounded-lg
                                 hover:bg-green-50 disabled:opacity-50 transition-all font-medium"
                    >
                      <ShieldCheck size={13} />
                      {t('superadminUsers.unban')}
                    </button>
                  ) : (
                    <button
                      onClick={() => setBanTarget(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 text-orange-700 border border-orange-200 rounded-lg
                                 hover:bg-orange-50 transition-all font-medium"
                    >
                      <Ban size={13} />
                      {t('superadminUsers.ban')}
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                               text-red-600 border border-red-200 rounded-lg
                               hover:bg-red-50 disabled:opacity-50 transition-all font-medium"
                  >
                    <Trash2 size={13} />
                    {tc('delete')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <p className="text-center text-stone-400 py-10 text-sm">{t('superadminUsers.empty')}</p>
        )}
      </div>
    </>
  )
}
