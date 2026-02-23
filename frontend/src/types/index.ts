export interface User {
  id: string
  email: string
  name: string
  is_verified: boolean
  is_admin: boolean
  is_superadmin: boolean
  created_at: string
  is_banned: boolean
  ban_until: string | null
  ban_reason: string | null
}

export interface CalendarConfig {
  id: string
  slug: string
  title: string
  owner_id: string
  timezone: string
  language: string
  week_start: number
  date_format: string
  default_view: CalendarView
  visible_time_start: string
  visible_time_end: string
  default_event_duration: number
  show_weekends: boolean
  enable_email_notifications: boolean
  created_at: string
}

export interface SubCalendar {
  id: string
  calendar_id: string
  name: string
  color: string
  active: boolean
  position: number
  created_at: string
}

export interface Tag {
  id: string
  calendar_id: string
  name: string
  color: string
  position: number
  created_at: string
}

export interface CalendarEvent {
  id: string
  sub_calendar_id: string
  title: string
  start_dt: string
  end_dt: string
  all_day: boolean
  location: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  who: string | null
  creator_user_id: string | null
  signup_enabled: boolean
  signup_max: number | null
  rrule: string | null
  custom_fields: Record<string, unknown>
  tags: Tag[]
  translations: Record<string, { title: string; notes: string }> | null
  creation_dt: string
  update_dt: string
}

export interface EventSignup {
  id: string
  event_id: string
  name: string
  email: string
  note: string | null
  created_at: string
}

export interface EventComment {
  id: string
  event_id: string
  user_id: string
  user_name: string
  content: string
  translations: Record<string, { content: string }> | null
  created_at: string
}

export interface EventAttachment {
  id: string
  event_id: string
  user_id: string
  user_name: string
  original_filename: string
  stored_filename: string
  mime_type: string
  file_size: number
  url: string
  created_at: string
}

export interface AccessLink {
  id: string
  calendar_id: string
  token: string
  label: string | null
  active: boolean
  created_at: string
  permission: Permission | null
  group_id: string | null
  group_name: string | null
}

export interface CalendarAccess {
  id: string
  sub_calendar_id: string | null
  user_id: string | null
  group_id: string | null
  link_id: string | null
  permission: Permission
  user_email: string | null
  user_name: string | null
  group_name: string | null
  link_label: string | null
}

export interface Group {
  id: string
  calendar_id: string
  name: string
  created_at: string
}

export interface GroupMember {
  id: string
  email: string
  name: string
}

export interface MyPermission {
  permission: Permission
  is_owner: boolean
}

export interface CalendarAdminItem extends CalendarConfig {
  owner_email: string
  owner_name: string
}

export interface InviteResult {
  status: 'added' | 'pending'
  email: string
  permission: Permission
  email_sent: boolean
}

export interface PendingInvitation {
  id: string
  calendar_id: string
  email: string
  permission: Permission
  sub_calendar_id: string | null
  created_at: string
}

export interface GroupAccess {
  id: string
  permission: Permission
  sub_calendar_id: string | null
  sub_calendar_name: string | null
}

export interface ClaimLinkResult {
  group_id: string
  group_name: string
}

export interface GroupBrief {
  id: string
  name: string
}

export interface UserGroupMembership {
  user_id: string
  groups: GroupBrief[]
}

export type CalendarView =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek'
  | 'listMonth'
  | 'multiMonthYear'

export type Permission =
  | 'no_access'
  | 'read_only_no_details'
  | 'read_only'
  | 'add_only'
  | 'modify_own'
  | 'modify'
  | 'administrator'
