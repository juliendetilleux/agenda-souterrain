import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { calendarApi } from '../api/calendars'
import { useCalendarStore } from '../store/calendarStore'
import Sidebar from '../components/Sidebar/Sidebar'
import CalendarGrid from '../components/Calendar/CalendarGrid'
import Toolbar from '../components/Calendar/Toolbar'

export default function CalendarPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const { initSubCalendars, setAccessToken, setPermission, isOwner, effectivePermission, sidebarOpen, setSidebarOpen, toggleSidebar } = useCalendarStore()
  const [openNewEvent, setOpenNewEvent] = useState(false)

  // Resolve ?token= from URL (access link authentication)
  useEffect(() => {
    const token = searchParams.get('token')
    setAccessToken(token)
  }, [searchParams, setAccessToken])

  const { data: calendar, isLoading: calLoading } = useQuery({
    queryKey: ['calendar', slug],
    queryFn: () => calendarApi.getBySlug(slug!),
    enabled: !!slug,
  })

  const { data: subCalendars = [] } = useQuery({
    queryKey: ['subcalendars', calendar?.id],
    queryFn: () => calendarApi.getSubCalendars(calendar!.id),
    enabled: !!calendar?.id,
  })

  // Load effective permission for this caller
  const { data: myPerm } = useQuery({
    queryKey: ['my-permission', calendar?.id],
    queryFn: () => calendarApi.getMyPermission(calendar!.id),
    enabled: !!calendar?.id,
  })

  useEffect(() => {
    if (myPerm) {
      setPermission(myPerm.permission, myPerm.is_owner)
    }
  }, [myPerm, setPermission])

  useEffect(() => {
    if (subCalendars.length > 0) {
      initSubCalendars(subCalendars)
    }
  }, [subCalendars, initSubCalendars])

  if (calLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!calendar) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">{t('notFound')}</p>
          <p className="text-gray-500 text-sm mt-1">{t('notFoundDetail', { slug })}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64">
            <Sidebar calendar={calendar} subCalendars={subCalendars} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar calendar={calendar} subCalendars={subCalendars} />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <Toolbar
          calendar={calendar}
          onNewEvent={() => setOpenNewEvent(true)}
          onMenuClick={toggleSidebar}
        />
        <CalendarGrid
          calendar={calendar}
          subCalendars={subCalendars}
          openNewEvent={openNewEvent}
          onNewEventOpened={() => setOpenNewEvent(false)}
        />
      </div>
    </div>
  )
}
