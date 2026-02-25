import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isToday,
  isSameDay,
} from 'date-fns'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../../utils/locales'
import { useCalendarStore } from '../../store/calendarStore'
import { usePwaStore } from '../../store/pwaStore'
import { calendarApi } from '../../api/calendars'
import type { CalendarConfig, SubCalendar } from '../../types'

interface Props {
  calendar: CalendarConfig
  subCalendars: SubCalendar[]
  onClose?: () => void
}

export default function Sidebar({ calendar, subCalendars, onClose }: Props) {
  const { t, i18n } = useTranslation('calendar')
  const { currentDate, setCurrentDate, visibleSubCalendarIds, toggleSubCalendar, selectedTagFilters, toggleTagFilter } =
    useCalendarStore()
  const dateLocale = getDateLocale(i18n.language)
  const [miniDate, setMiniDate] = useState(new Date())
  const [collapsed, setCollapsed] = useState(false)

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', calendar.id],
    queryFn: () => calendarApi.getTags(calendar.id),
  })

  const { deferredPrompt, dismissed, setDeferredPrompt, setDismissed } = usePwaStore()
  const canInstall = !!deferredPrompt && !dismissed

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  // Mini calendar grid
  const start = startOfMonth(miniDate)
  const end = endOfMonth(miniDate)
  const days = eachDayOfInterval({ start, end })
  const weekStart = calendar.week_start ?? 1 // 0=Sunday, 1=Monday
  const rawDay = getDay(start) // 0=Sunday
  const startPadding = weekStart === 0
    ? rawDay
    : rawDay === 0 ? 6 : rawDay - 1

  const dayLetters: string[] = weekStart === 0
    ? t('dayLettersSun', { returnObjects: true }) as string[]
    : t('dayLettersMon', { returnObjects: true }) as string[]

  if (collapsed) {
    return (
      <div className="w-10 h-full bg-cave border-r border-cave-700 flex flex-col items-center pt-3 flex-shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg hover:bg-cave-800 text-cave-text transition-colors"
          title={t('sidebar.expand')}
        >
          <PanelLeftOpen size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="w-60 h-full bg-cave border-r border-cave-700 flex flex-col overflow-y-auto flex-shrink-0">
      {/* Collapse / Close buttons */}
      <div className="flex items-center justify-between px-2 pt-2">
        {onClose ? (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-cave-800 text-cave-text transition-colors"
            title={t('sidebar.closeSidebar')}
          >
            <X size={16} />
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-cave-800 text-cave-text transition-colors hidden md:block"
          title={t('sidebar.collapse')}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Mini calendar */}
      <div className="px-3 pb-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMiniDate(subMonths(miniDate, 1))}
            className="p-1 rounded-md hover:bg-cave-800 text-cave-text transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold capitalize text-cave-text-active tracking-wide">
            {format(miniDate, 'MMM yyyy', { locale: dateLocale })}
          </span>
          <button
            onClick={() => setMiniDate(addMonths(miniDate, 1))}
            className="p-1 rounded-md hover:bg-cave-800 text-cave-text transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 text-center mb-1">
          {dayLetters.map((d, i) => (
            <div key={i} className="text-[10px] font-semibold text-cave-text uppercase tracking-widest py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 text-center gap-y-0.5">
          {Array(startPadding)
            .fill(null)
            .map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
          {days.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => {
                setCurrentDate(day)
                setMiniDate(day)
              }}
              className={[
                'text-xs h-6 w-6 rounded-full mx-auto flex items-center justify-center transition-all duration-150',
                isToday(day)
                  ? 'bg-lamp-500 text-white font-bold shadow-sm'
                  : isSameDay(day, currentDate)
                  ? 'bg-lamp-500/20 text-lamp-400 font-semibold'
                  : isSameMonth(day, miniDate)
                  ? 'hover:bg-cave-800 text-cave-text'
                  : 'text-cave-700',
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-cave-700 mx-3" />

      {/* Sub-calendars */}
      <div className="px-3 py-4 flex-1">
        <div className="mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-cave-text">
            {t('sidebar.calendars')}
          </span>
        </div>

        <div className="space-y-0.5">
          {subCalendars.map((sc) => (
            <div key={sc.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cave-800 transition-colors">
              <input
                type="checkbox"
                checked={visibleSubCalendarIds.includes(sc.id)}
                onChange={() => toggleSubCalendar(sc.id)}
                className="rounded flex-shrink-0 w-3.5 h-3.5 cursor-pointer"
                style={{ accentColor: sc.color }}
              />
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: sc.color }}
              />
              <span className="text-sm text-cave-text-active flex-1 truncate font-medium">
                {sc.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tags filter */}
      {tags.length > 0 && (
        <>
          <div className="border-t border-cave-700 mx-3" />
          <div className="px-3 py-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cave-text mb-3 block">
              {t('sidebar.tags')}
            </span>
            <div className="space-y-0.5">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cave-800 transition-colors cursor-pointer"
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTagFilters.includes(tag.id)}
                    onChange={() => toggleTagFilter(tag.id)}
                    className="rounded flex-shrink-0 w-3.5 h-3.5 cursor-pointer"
                    style={{ accentColor: tag.color }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-cave-text-active flex-1 truncate font-medium">
                    {tag.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Install PWA button */}
      {canInstall && (
        <>
          <div className="border-t border-cave-700 mx-3" />
          <div className="px-3 py-3">
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-cave-text hover:text-cave-text-active hover:bg-cave-800 rounded-lg transition-colors"
            >
              <Download size={14} />
              {t('sidebar.installApp')}
            </button>
          </div>
        </>
      )}

    </div>
  )
}
