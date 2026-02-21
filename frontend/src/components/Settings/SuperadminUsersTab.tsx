import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, ShieldOff } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { useAuthStore } from '../../store/authStore'
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

  if (isLoading) return <div className="text-center py-12 text-stone-400 text-sm">{tc('loading')}</div>

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 border-b border-stone-100">
          <tr>
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
              {t('superadminUsers.user')}
            </th>
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
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
              <td className="px-5 py-4 text-right">
                {!u.is_superadmin && u.id !== currentUser?.id && (
                  u.is_admin ? (
                    <button
                      onClick={() => demoteMutation.mutate(u.id)}
                      disabled={demoteMutation.isPending}
                      className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs
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
                      className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs
                                 text-lamp-700 border border-lamp-200 rounded-lg
                                 hover:bg-lamp-50 disabled:opacity-50 transition-all font-medium"
                    >
                      <Shield size={13} />
                      {t('superadminUsers.promote')}
                    </button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && (
        <p className="text-center text-stone-400 py-10 text-sm">{t('superadminUsers.empty')}</p>
      )}
    </div>
  )
}
