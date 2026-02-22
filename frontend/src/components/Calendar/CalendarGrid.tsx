import { useRef, useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import multiMonthPlugin from '@fullcalendar/multimonth'
import rrulePlugin from '@fullcalendar/rrule'
import { useTranslation } from 'react-i18next'
import { getFcLocale } from '../../utils/locales'
import type { EventClickArg, DateSelectArg, EventDropArg, EventContentArg } from '@fullcalendar/core'
import type { EventResizeDoneArg, DateClickArg } from '@fullcalendar/interaction'
import { format } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../../api/calendars'
import { useCalendarStore } from '../../store/calendarStore'
import { canModifyOwn } from '../../utils/permissions'
import { formatDtstart, computeDuration } from '../../utils/dateHelpers'
import type { CalendarConfig, SubCalendar, CalendarEvent } from '../../types'
import EventModal from '../Event/EventModal'
import { useAutoTranslate, getTranslatedTitle } from '../../hooks/useAutoTranslate'

interface Props {
  calendar: CalendarConfig
  subCalendars: SubCalendar[]
  openNewEvent?: boolean
  onNewEventOpened?: () => void
}

export default function CalendarGrid({ calendar, subCalendars, openNewEvent, onNewEventOpened }: Props) {
  const { i18n } = useTranslation()
  const calRef = useRef<FullCalendar>(null)
  const qc = useQueryClient()
  const { currentView, currentDate, visibleSubCalendarIds, selectedTagFilters, effectivePermission } = useCalendarStore()
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [newEventDates, setNewEventDates] = useState<{
    start: Date
    end: Date
    allDay: boolean
  } | null>(null)

  // Open new event modal when triggered from toolbar
  useEffect(() => {
    if (openNewEvent) {
      const now = new Date()
      const end = new Date(now)
      end.setHours(end.getHours() + 1)
      setNewEventDates({ start: now, end, allDay: false })
      onNewEventOpened?.()
    }
  }, [openNewEvent, onNewEventOpened])

  const { data: events = [] } = useQuery({
    queryKey: ['events', calendar.id, currentDate.toISOString().slice(0, 7)],
    queryFn: () => {
      const start = new Date(currentDate)
      start.setMonth(start.getMonth() - 1)
      const end = new Date(currentDate)
      end.setMonth(end.getMonth() + 2)
      return calendarApi.getEvents(calendar.id, {
        start_dt: start.toISOString(),
        end_dt: end.toISOString(),
      })
    },
    enabled: !!calendar.id,
  })

  // Trigger background translations for events in current language
  useAutoTranslate(calendar.id, events, calendar.language || 'fr')

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CalendarEvent> }) =>
      calendarApi.updateEvent(calendar.id, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', calendar.id] }),
  })

  // Sync FullCalendar with store state
  useEffect(() => {
    const api = calRef.current?.getApi()
    if (api) {
      api.changeView(currentView)
      api.gotoDate(currentDate)
    }
  }, [currentView, currentDate])

  const subCalMap = Object.fromEntries(subCalendars.map((sc) => [sc.id, sc]))

  const fcEvents = events
    .filter((e) => visibleSubCalendarIds.includes(e.sub_calendar_id))
    .filter((e) => {
      if (selectedTagFilters.length === 0) return true
      return e.tags?.some((t) => selectedTagFilters.includes(t.id))
    })
    .map((e) => {
      const base = {
        id: e.id,
        title: getTranslatedTitle(e, i18n.language.slice(0, 2), calendar.language || 'fr'),
        allDay: e.all_day,
        backgroundColor: subCalMap[e.sub_calendar_id]?.color ?? '#3788d8',
        borderColor: 'transparent',
        extendedProps: { event: e },
      }

      if (e.rrule) {
        return {
          ...base,
          rrule: `DTSTART:${formatDtstart(e.start_dt, e.all_day)}\nRRULE:${e.rrule}`,
          duration: computeDuration(e.start_dt, e.end_dt),
          editable: false,
        }
      }

      return {
        ...base,
        start: e.start_dt,
        end: e.end_dt,
      }
    })

  const handleEventClick = (arg: EventClickArg) => {
    setSelectedEvent(arg.event.extendedProps.event as CalendarEvent)
  }

  const handleDateSelect = (arg: DateSelectArg) => {
    setNewEventDates({ start: arg.start, end: arg.end, allDay: arg.allDay })
  }

  const handleDateClick = (arg: DateClickArg) => {
    if (!canModifyOwn(effectivePermission)) return
    const start = arg.date
    const end = new Date(start)
    if (arg.allDay) {
      end.setDate(end.getDate() + 1)
    } else {
      end.setHours(end.getHours() + 1)
    }
    setNewEventDates({ start, end, allDay: arg.allDay })
  }

  const toNaive = (date: Date | null): string | undefined => {
    if (!date) return undefined
    return format(date, "yyyy-MM-dd'T'HH:mm:ss")
  }

  const handleEventDrop = (arg: EventDropArg) => {
    const event = arg.event.extendedProps.event as CalendarEvent
    updateMutation.mutate(
      {
        id: event.id,
        data: {
          start_dt: toNaive(arg.event.start),
          end_dt: toNaive(arg.event.end) ?? toNaive(arg.event.start),
          all_day: arg.event.allDay,
        },
      },
      { onError: () => arg.revert() }
    )
  }

  const handleEventResize = (arg: EventResizeDoneArg) => {
    const event = arg.event.extendedProps.event as CalendarEvent
    updateMutation.mutate(
      {
        id: event.id,
        data: {
          start_dt: toNaive(arg.event.start),
          end_dt: toNaive(arg.event.end) ?? toNaive(arg.event.start),
        },
      },
      { onError: () => arg.revert() }
    )
  }

  const closeModal = () => {
    setSelectedEvent(null)
    setNewEventDates(null)
  }

  const handleSaved = () => {
    closeModal()
    qc.invalidateQueries({ queryKey: ['events', calendar.id] })
  }

  const renderEventContent = (arg: EventContentArg) => {
    const ev = arg.event.extendedProps.event as CalendarEvent | undefined
    const tags = ev?.tags ?? []
    return (
      <div className="flex items-center gap-1 overflow-hidden w-full">
        {arg.timeText && (
          <span className="fc-event-time font-medium flex-shrink-0">{arg.timeText}</span>
        )}
        <span className="fc-event-title truncate">{arg.event.title}</span>
        {tags.length > 0 && (
          <span className="flex gap-0.5 flex-shrink-0 ml-auto">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: t.color }}
                title={t.name}
              />
            ))}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-3">
      <FullCalendar
        key={effectivePermission}
        ref={calRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin, rrulePlugin]}
        initialView={currentView}
        locale={getFcLocale(i18n.language)}
        headerToolbar={false}
        events={fcEvents}
        selectable={canModifyOwn(effectivePermission)}
        editable={canModifyOwn(effectivePermission)}
        select={handleDateSelect}
        dateClick={handleDateClick}
        eventContent={renderEventContent}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        height="100%"
        firstDay={calendar.week_start}
        slotMinTime={calendar.visible_time_start + ':00'}
        slotMaxTime={calendar.visible_time_end === '24:00' ? '24:00:00' : calendar.visible_time_end + ':00'}
        weekends={calendar.show_weekends}
        nowIndicator
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
      />

      {(selectedEvent || newEventDates) && (
        <EventModal
          calendar={calendar}
          subCalendars={subCalendars}
          event={selectedEvent}
          defaultDates={newEventDates}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
