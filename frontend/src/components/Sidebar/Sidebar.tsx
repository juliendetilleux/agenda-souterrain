import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
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
import { calendarApi } from '../../api/calendars'
import type { CalendarConfig, SubCalendar } from '../../types'
import toast from 'react-hot-toast'

interface Props {
  calendar: CalendarConfig
  subCalendars: SubCalendar[]
  onClose?: () => void
}

const COLORS = [
  '#e17055', '#00b894', '#fdcb6e',
  '#6c5ce7', '#fd79a8', '#00cec9', '#a29bfe', '#3788d8',
]

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

export default function Sidebar({ calendar, subCalendars, onClose }: Props) {
  const { t, i18n } = useTranslation('calendar')
  const { currentDate, setCurrentDate, visibleSubCalendarIds, toggleSubCalendar, selectedTagFilters, toggleTagFilter, isOwner, effectivePermission } =
    useCalendarStore()
  const dateLocale = getDateLocale(i18n.language)
  const isCalendarAdmin = isOwner || effectivePermission === 'administrator'
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [miniDate, setMiniDate] = useState(new Date())
  const [newScName, setNewScName] = useState('')
  const [showNewSc, setShowNewSc] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const qc = useQueryClient()

  const createScMutation = useMutation({
    mutationFn: () =>
      calendarApi.createSubCalendar(calendar.id, { name: newScName, color: randomColor() }),
    onSuccess: () => {
      toast.success(t('sidebar.subCalendarCreated'))
      setNewScName('')
      setShowNewSc(false)
      qc.invalidateQueries({ queryKey: ['subcalendars', calendar.id] })
    },
    onError: () => toast.error(t('sidebar.error')),
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', calendar.id],
    queryFn: () => calendarApi.getTags(calendar.id),
  })

  const deleteScMutation = useMutation({
    mutationFn: (id: string) => calendarApi.deleteSubCalendar(calendar.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subcalendars', calendar.id] }),
    onError: () => toast.error(t('sidebar.deleteError')),
  })

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
    <>
    {confirmState && (
      <ConfirmModal
        title={confirmState.title}
        message={confirmState.message}
        danger
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    )}
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
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-cave-text">
            {t('sidebar.calendars')}
          </span>
          {isCalendarAdmin && (
            <button
              onClick={() => setShowNewSc(true)}
              className="p-1 rounded-md hover:bg-cave-800 text-cave-text hover:text-cave-text-active transition-colors"
              title={t('sidebar.addSubCalendar')}
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {showNewSc && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createScMutation.mutate()
            }}
            className="flex gap-1.5 mb-3"
          >
            <input
              autoFocus
              type="text"
              value={newScName}
              onChange={(e) => setNewScName(e.target.value)}
              placeholder={t('sidebar.namePlaceholder')}
              className="flex-1 text-xs bg-cave-800 border border-cave-700 rounded-lg px-2 py-1.5
                         text-cave-text-active placeholder:text-cave-text focus:outline-none
                         focus:border-lamp-500 focus:ring-1 focus:ring-lamp-500/30 transition-colors"
            />
            <button
              type="submit"
              disabled={!newScName.trim()}
              className="text-xs px-2 py-1.5 bg-lamp-500 text-white rounded-lg disabled:opacity-40 hover:bg-lamp-600 transition-colors font-medium"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setShowNewSc(false)}
              className="text-xs px-2 py-1.5 bg-cave-800 text-cave-text rounded-lg hover:bg-cave-700 transition-colors"
            >
              ✕
            </button>
          </form>
        )}

        <div className="space-y-0.5">
          {subCalendars.map((sc) => (
            <div key={sc.id} className="flex items-center gap-2.5 group px-2 py-1.5 rounded-lg hover:bg-cave-800 transition-colors">
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
              {isCalendarAdmin && (
                <button
                  onClick={() => {
                    confirm(t('sidebar.deleteSubCalendarTitle'), t('sidebar.deleteSubCalendarMsg', { name: sc.name }), () => deleteScMutation.mutate(sc.id))
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 text-cave-text transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
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

    </div>
    </>
  )
}
