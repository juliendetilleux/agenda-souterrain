import type { Permission } from '../types'

const ORDER: Permission[] = [
  'no_access',
  'read_only_no_details',
  'read_only',
  'add_only',
  'modify_own',
  'modify',
  'administrator',
]

const level = (p: Permission) => ORDER.indexOf(p)

export const canReadLimited = (p: Permission) => level(p) >= level('read_only_no_details')
export const canRead = (p: Permission) => level(p) >= level('read_only')
export const canAdd = (p: Permission) => level(p) >= level('add_only')
export const canModifyOwn = (p: Permission) => level(p) >= level('modify_own')
export const canModify = (p: Permission) => level(p) >= level('modify')
export const isAdmin = (p: Permission) => p === 'administrator'

/** Fallback labels (FR) — used by tests and non-i18n contexts */
export const PERMISSION_LABELS: Record<Permission, string> = {
  no_access: 'Aucun accès',
  read_only_no_details: 'Lecture (sans détails)',
  read_only: 'Lecture seule',
  add_only: 'Ajout uniquement',
  modify_own: 'Modifier mes événements',
  modify: 'Modifier tout',
  administrator: 'Administrateur',
}

/** Internationalized permission label — pass `t` from useTranslation('settings') */
export function getPermissionLabel(p: Permission, t: (key: string) => string): string {
  const translated = t(`permissions.${p}`)
  return translated !== `permissions.${p}` ? translated : PERMISSION_LABELS[p]
}

export const PERMISSION_COLORS: Record<Permission, string> = {
  no_access: 'bg-gray-100 text-gray-500',
  read_only_no_details: 'bg-yellow-100 text-yellow-700',
  read_only: 'bg-blue-100 text-blue-700',
  add_only: 'bg-green-100 text-green-700',
  modify_own: 'bg-purple-100 text-purple-700',
  modify: 'bg-orange-100 text-orange-700',
  administrator: 'bg-red-100 text-red-700',
}
