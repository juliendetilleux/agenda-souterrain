import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../../api/calendars'
import type { CalendarConfig, CalendarView } from '../../types'
import toast from 'react-hot-toast'

interface Props {
  calendar: CalendarConfig
}

const TIMEZONES = [
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'UTC',
]

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'fr', label: 'Fran\u00e7ais' },
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'de', label: 'Deutsch' },
]

const WEEK_START_VALUES: { value: number; key: string }[] = [
  { value: 1, key: 'general.monday' },
  { value: 0, key: 'general.sunday' },
]

const VIEW_VALUES: { value: string; key: string }[] = [
  { value: 'month', key: 'views.month' },
  { value: 'week', key: 'views.week' },
  { value: 'day', key: 'views.day' },
  { value: 'list', key: 'views.agenda' },
  { value: 'year', key: 'views.year' },
]

export default function GeneralTab({ calendar }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { t: tCal } = useTranslation('calendar')
  const qc = useQueryClient()
  const [title, setTitle] = useState(calendar.title)
  const [timezone, setTimezone] = useState(calendar.timezone)
  const [language, setLanguage] = useState(calendar.language)
  const [weekStart, setWeekStart] = useState(calendar.week_start)
  const [defaultView, setDefaultView] = useState<string>(calendar.default_view)
  const [visibleTimeStart, setVisibleTimeStart] = useState(calendar.visible_time_start)
  const [visibleTimeEnd, setVisibleTimeEnd] = useState(calendar.visible_time_end)
  const [defaultEventDuration, setDefaultEventDuration] = useState(calendar.default_event_duration)
  const [showWeekends, setShowWeekends] = useState(calendar.show_weekends)

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CalendarConfig>) => calendarApi.update(calendar.id, data),
    onSuccess: () => {
      toast.success(t('general.saved'))
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: () => toast.error(t('general.saveError')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      title,
      timezone,
      language,
      week_start: weekStart,
      default_view: defaultView as CalendarView,
      visible_time_start: visibleTimeStart,
      visible_time_end: visibleTimeEnd,
      default_event_duration: defaultEventDuration,
      show_weekends: showWeekends,
    })
  }

  const inputClass =
    'w-full text-sm rounded-lg border border-stone-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all bg-white'
  const labelClass = 'block text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1'

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className={labelClass}>{t('general.calendarTitle')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* Timezone + Language */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('general.timezone')}</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('general.language')}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Week start + Default view */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('general.weekStart')}</label>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(Number(e.target.value))}
                className={inputClass}
              >
                {WEEK_START_VALUES.map((w) => (
                  <option key={w.value} value={w.value}>{t(w.key)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('general.defaultView')}</label>
              <select value={defaultView} onChange={(e) => setDefaultView(e.target.value)} className={inputClass}>
                {VIEW_VALUES.map((v) => (
                  <option key={v.value} value={v.value}>{tCal(v.key)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('general.visibleTimeStart')}</label>
              <input
                type="time"
                value={visibleTimeStart}
                onChange={(e) => setVisibleTimeStart(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('general.visibleTimeEnd')}</label>
              <input
                type="time"
                value={visibleTimeEnd === '24:00' ? '23:59' : visibleTimeEnd}
                onChange={(e) => setVisibleTimeEnd(e.target.value === '23:59' ? '24:00' : e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Default event duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('general.defaultDuration')}</label>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={defaultEventDuration}
                onChange={(e) => setDefaultEventDuration(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWeekends}
                  onChange={(e) => setShowWeekends(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: '#f59e0b' }}
                />
                <span className="text-sm text-stone-600">{t('general.showWeekends')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="border-t border-stone-100 px-5 py-4 flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-5 py-2 text-sm bg-lamp-500 text-white rounded-xl hover:bg-lamp-600
                       font-semibold shadow-sm disabled:opacity-50 transition-all"
          >
            {updateMutation.isPending ? tc('saving') : tc('save')}
          </button>
        </div>
      </div>
    </form>
  )
}
