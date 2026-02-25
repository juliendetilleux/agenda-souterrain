import api from './client'
import type {
  CalendarConfig, SubCalendar, CalendarEvent, EventSignup,
  AccessLink, CalendarAccess, Group, GroupMember, MyPermission, Permission, Tag,
  EventComment, EventAttachment, InviteResult, PendingInvitation,
  GroupAccess, ClaimLinkResult, UserGroupMembership, AddGroupMemberResult,
} from '../types'

export const calendarApi = {
  getBySlug: (slug: string) =>
    api.get<CalendarConfig>(`/calendars/slug/${slug}`).then((r) => r.data),

  getMine: () =>
    api.get<CalendarConfig[]>('/calendars/mine').then((r) => r.data),

  getAccessible: () =>
    api.get<CalendarConfig[]>('/calendars/accessible').then((r) => r.data),

  create: (data: Partial<CalendarConfig>) =>
    api.post<CalendarConfig>('/calendars', data).then((r) => r.data),

  update: (id: string, data: Partial<CalendarConfig>) =>
    api.put<CalendarConfig>(`/calendars/${id}`, data).then((r) => r.data),

  getSubCalendars: (calId: string) =>
    api.get<SubCalendar[]>(`/calendars/${calId}/subcalendars`).then((r) => r.data),

  createSubCalendar: (calId: string, data: Partial<SubCalendar>) =>
    api.post<SubCalendar>(`/calendars/${calId}/subcalendars`, data).then((r) => r.data),

  updateSubCalendar: (calId: string, scId: string, data: Partial<SubCalendar>) =>
    api
      .put<SubCalendar>(`/calendars/${calId}/subcalendars/${scId}`, data)
      .then((r) => r.data),

  deleteSubCalendar: (calId: string, scId: string) =>
    api.delete(`/calendars/${calId}/subcalendars/${scId}`),

  getEvents: (
    calId: string,
    params?: { start_dt?: string; end_dt?: string; subcalendar_ids?: string[] }
  ) =>
    api
      .get<CalendarEvent[]>(`/calendars/${calId}/events`, { params })
      .then((r) => r.data),

  createEvent: (calId: string, data: Partial<CalendarEvent>) =>
    api.post<CalendarEvent>(`/calendars/${calId}/events`, data).then((r) => r.data),

  updateEvent: (calId: string, eventId: string, data: Partial<CalendarEvent>) =>
    api
      .put<CalendarEvent>(`/calendars/${calId}/events/${eventId}`, data)
      .then((r) => r.data),

  deleteEvent: (calId: string, eventId: string) =>
    api.delete(`/calendars/${calId}/events/${eventId}`),

  searchEvents: (calId: string, q: string) =>
    api
      .get<CalendarEvent[]>(`/calendars/${calId}/events/search`, { params: { q } })
      .then((r) => r.data),

  getSignups: (calId: string, eventId: string) =>
    api
      .get<EventSignup[]>(`/calendars/${calId}/events/${eventId}/signups`)
      .then((r) => r.data),

  createSignup: (
    calId: string,
    eventId: string,
    data: { name: string; email: string; note?: string }
  ) =>
    api
      .post<EventSignup>(`/calendars/${calId}/events/${eventId}/signups`, data)
      .then((r) => r.data),

  // ─── Permission ───────────────────────────────────────────────────────────
  getMyPermission: (calId: string) =>
    api.get<MyPermission>(`/calendars/${calId}/my-permission`).then((r) => r.data),

  // ─── Access links ─────────────────────────────────────────────────────────
  getLinks: (calId: string) =>
    api.get<AccessLink[]>(`/calendars/${calId}/links`).then((r) => r.data),

  createLink: (calId: string, data: { label?: string; permission: Permission; sub_calendar_id?: string; group_id?: string }) =>
    api.post<AccessLink>(`/calendars/${calId}/links`, data).then((r) => r.data),

  updateLink: (calId: string, linkId: string, data: { label?: string; active?: boolean; permission?: Permission; group_id?: string }) =>
    api.put<AccessLink>(`/calendars/${calId}/links/${linkId}`, data).then((r) => r.data),

  deleteLink: (calId: string, linkId: string) =>
    api.delete(`/calendars/${calId}/links/${linkId}`),

  // ─── User access ──────────────────────────────────────────────────────────
  getAccessList: (calId: string) =>
    api.get<CalendarAccess[]>(`/calendars/${calId}/access`).then((r) => r.data),

  inviteUser: (calId: string, data: { email: string; permission: Permission; sub_calendar_id?: string }) =>
    api.post<InviteResult>(`/calendars/${calId}/invite`, data).then((r) => r.data),

  getPendingInvitations: (calId: string) =>
    api.get<PendingInvitation[]>(`/calendars/${calId}/pending-invitations`).then((r) => r.data),

  deletePendingInvitation: (calId: string, invitationId: string) =>
    api.delete(`/calendars/${calId}/pending-invitations/${invitationId}`),

  updateAccess: (calId: string, accessId: string, permission: Permission) =>
    api.put<CalendarAccess>(`/calendars/${calId}/access/${accessId}`, { permission }).then((r) => r.data),

  deleteAccess: (calId: string, accessId: string) =>
    api.delete(`/calendars/${calId}/access/${accessId}`),

  // ─── Groups ───────────────────────────────────────────────────────────────
  getGroups: (calId: string) =>
    api.get<Group[]>(`/calendars/${calId}/groups`).then((r) => r.data),

  createGroup: (calId: string, name: string) =>
    api.post<Group>(`/calendars/${calId}/groups`, { name }).then((r) => r.data),

  deleteGroup: (calId: string, groupId: string) =>
    api.delete(`/calendars/${calId}/groups/${groupId}`),

  getGroupMembers: (calId: string, groupId: string) =>
    api.get<GroupMember[]>(`/calendars/${calId}/groups/${groupId}/members`).then((r) => r.data),

  addGroupMember: (calId: string, groupId: string, email: string) =>
    api.post<AddGroupMemberResult>(`/calendars/${calId}/groups/${groupId}/members`, { email }).then((r) => r.data),

  removeGroupMember: (calId: string, groupId: string, userId: string) =>
    api.delete(`/calendars/${calId}/groups/${groupId}/members/${userId}`),

  setGroupAccess: (calId: string, groupId: string, data: { permission: Permission; sub_calendar_id?: string }) =>
    api.post(`/calendars/${calId}/groups/${groupId}/access`, data).then((r) => r.data),

  getGroupAccess: (calId: string, groupId: string) =>
    api.get<GroupAccess[]>(`/calendars/${calId}/groups/${groupId}/access`).then((r) => r.data),

  deleteGroupAccess: (calId: string, groupId: string, accessId: string) =>
    api.delete(`/calendars/${calId}/groups/${groupId}/access/${accessId}`),

  // ─── Claim link ─────────────────────────────────────────────────────────
  claimLink: (calId: string, token: string) =>
    api.post<ClaimLinkResult>(`/calendars/${calId}/claim-link`, null, { params: { token } }).then((r) => r.data),

  // ─── Group memberships ──────────────────────────────────────────────────
  getGroupMemberships: (calId: string) =>
    api.get<UserGroupMembership[]>(`/calendars/${calId}/group-memberships`).then((r) => r.data),

  // ─── Tags ───────────────────────────────────────────────────────────────
  getTags: (calId: string) =>
    api.get<Tag[]>(`/calendars/${calId}/tags`).then((r) => r.data),

  createTag: (calId: string, data: { name: string; color?: string; position?: number }) =>
    api.post<Tag>(`/calendars/${calId}/tags`, data).then((r) => r.data),

  updateTag: (calId: string, tagId: string, data: { name?: string; color?: string; position?: number }) =>
    api.put<Tag>(`/calendars/${calId}/tags/${tagId}`, data).then((r) => r.data),

  deleteTag: (calId: string, tagId: string) =>
    api.delete(`/calendars/${calId}/tags/${tagId}`),

  // ─── Translation ────────────────────────────────────────────────────────
  translateEvent: (calId: string, eventId: string, targetLang: string, sourceLang = 'fr') =>
    api
      .post<{ title: string; notes: string }>(
        `/calendars/${calId}/events/${eventId}/translate`,
        null,
        { params: { target_lang: targetLang, source_lang: sourceLang } }
      )
      .then((r) => r.data),

  // ─── Comments ──────────────────────────────────────────────────────────
  getComments: (calId: string, eventId: string) =>
    api
      .get<EventComment[]>(`/calendars/${calId}/events/${eventId}/comments`)
      .then((r) => r.data),

  createComment: (calId: string, eventId: string, content: string) =>
    api
      .post<EventComment>(`/calendars/${calId}/events/${eventId}/comments`, { content })
      .then((r) => r.data),

  deleteComment: (calId: string, eventId: string, commentId: string) =>
    api.delete(`/calendars/${calId}/events/${eventId}/comments/${commentId}`),

  translateComment: (
    calId: string, eventId: string, commentId: string,
    targetLang: string, sourceLang = 'fr'
  ) =>
    api
      .post<{ content: string }>(
        `/calendars/${calId}/events/${eventId}/comments/${commentId}/translate`,
        null,
        { params: { target_lang: targetLang, source_lang: sourceLang } }
      )
      .then((r) => r.data),

  // ─── Attachments ───────────────────────────────────────────────────────
  getAttachments: (calId: string, eventId: string) =>
    api
      .get<EventAttachment[]>(`/calendars/${calId}/events/${eventId}/attachments`)
      .then((r) => r.data),

  uploadAttachment: (calId: string, eventId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<EventAttachment>(
        `/calendars/${calId}/events/${eventId}/attachments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then((r) => r.data)
  },

  deleteAttachment: (calId: string, eventId: string, attachmentId: string) =>
    api.delete(`/calendars/${calId}/events/${eventId}/attachments/${attachmentId}`),

  // ─── Export iCal ─────────────────────────────────────────────────────────
  exportEventIcal: async (calId: string, eventId: string, filename: string) => {
    const res = await api.get(`/calendars/${calId}/events/${eventId}/ics`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  },
}
