import api from './client'
import type { User, CalendarAdminItem } from '../types'

export const adminApi = {
  getUsers: () => api.get<User[]>('/admin/users').then((r) => r.data),

  promote: (userId: string) =>
    api.put<User>(`/admin/users/${userId}/promote`).then((r) => r.data),

  demote: (userId: string) =>
    api.put<User>(`/admin/users/${userId}/demote`).then((r) => r.data),

  getCalendars: () =>
    api.get<CalendarAdminItem[]>('/admin/calendars').then((r) => r.data),

  deleteCalendar: (id: string) => api.delete(`/admin/calendars/${id}`),
}
