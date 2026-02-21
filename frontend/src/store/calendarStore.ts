import { create } from 'zustand'
import type { SubCalendar, CalendarView, Permission } from '../types'

interface CalendarState {
  visibleSubCalendarIds: string[]
  currentView: CalendarView
  currentDate: Date
  // Access link token (from ?token= URL param)
  accessToken: string | null
  // Effective permission of the current caller
  effectivePermission: Permission
  isOwner: boolean
  // Tag filtering
  selectedTagFilters: string[]
  // Sidebar (mobile drawer)
  sidebarOpen: boolean
  setVisibleSubCalendars: (ids: string[]) => void
  toggleSubCalendar: (id: string) => void
  setCurrentView: (view: CalendarView) => void
  setCurrentDate: (date: Date) => void
  initSubCalendars: (subCals: SubCalendar[]) => void
  setAccessToken: (token: string | null) => void
  setPermission: (permission: Permission, isOwner: boolean) => void
  toggleTagFilter: (tagId: string) => void
  clearTagFilters: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  visibleSubCalendarIds: [],
  currentView: 'dayGridMonth',
  currentDate: new Date(),
  accessToken: null,
  effectivePermission: 'no_access',
  isOwner: false,
  selectedTagFilters: [],
  sidebarOpen: false,
  initSubCalendars: (subCals) =>
    set({ visibleSubCalendarIds: subCals.map((sc) => sc.id) }),
  setVisibleSubCalendars: (ids) => set({ visibleSubCalendarIds: ids }),
  toggleSubCalendar: (id) => {
    const current = get().visibleSubCalendarIds
    const next = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id]
    set({ visibleSubCalendarIds: next })
  },
  setCurrentView: (view) => set({ currentView: view }),
  setCurrentDate: (date) => set({ currentDate: date }),
  setAccessToken: (token) => set({ accessToken: token }),
  setPermission: (permission, isOwner) => set({ effectivePermission: permission, isOwner }),
  toggleTagFilter: (tagId) => {
    const current = get().selectedTagFilters
    const next = current.includes(tagId)
      ? current.filter((i) => i !== tagId)
      : [...current, tagId]
    set({ selectedTagFilters: next })
  },
  clearTagFilters: () => set({ selectedTagFilters: [] }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
