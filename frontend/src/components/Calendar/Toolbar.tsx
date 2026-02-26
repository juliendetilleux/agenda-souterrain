import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Plus, LogOut, Settings, X, Menu } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../../utils/locales'
import { useCalendarStore } from '../../store/calendarStore'
import { useAuthStore } from '../../store/authStore'
import { calendarApi } from '../../api/calendars'
import { canAdd, isAdmin } from '../../utils/permissions'
import LanguageSwitcher from '../ui/LanguageSwitcher'
import type { CalendarConfig, CalendarView, CalendarEvent } from '../../types'
import { getTranslatedTitle } from '../../hooks/useAutoTranslate'

interface Props {
  calendar: CalendarConfig
  onNewEvent?: () => void
  onMenuClick?: () => void
}

const VIEW_KEYS: { key: CalendarView; tKey: string }[] = [
  { key: 'dayGridMonth', tKey: 'views.month' },
  { key: 'timeGridWeek', tKey: 'views.week' },
  { key: 'timeGridDay', tKey: 'views.day' },
  { key: 'listWeek', tKey: 'views.agenda' },
  { key: 'multiMonthYear', tKey: 'views.year' },
]

export default function Toolbar({ calendar, onNewEvent, onMenuClick }: Props) {
  const { t, i18n } = useTranslation('calendar')
  const { slug } = useParams<{ slug: string }>()
  const { currentView, currentDate, setCurrentView, setCurrentDate, effectivePermission, isOwner } = useCalendarStore()
  const { isAuthenticated, logout, user } = useAuthStore()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchResults, setSearchResults] = useState<CalendarEvent[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const goToday = () => setCurrentDate(new Date())

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const step = (dir: 1 | -1) => {
    const d = new Date(currentDate)
    if (currentView === 'dayGridMonth' || currentView === 'multiMonthYear') {
      d.setMonth(d.getMonth() + dir)
    } else if (currentView === 'timeGridWeek' || currentView === 'listWeek') {
      d.setDate(d.getDate() + 7 * dir)
    } else {
      d.setDate(d.getDate() + dir)
    }
    setCurrentDate(d)
  }

  const dateLocale = getDateLocale(i18n.language)

  const formatTitle = () => {
    if (currentView === 'timeGridDay') return format(currentDate, 'd MMMM yyyy', { locale: dateLocale })
    if (currentView === 'multiMonthYear') return format(currentDate, 'yyyy')
    return format(currentDate, 'MMMM yyyy', { locale: dateLocale })
  }

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await calendarApi.searchEvents(calendar.id, searchQuery)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery, calendar.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleResultClick = (event: CalendarEvent) => {
    setCurrentDate(new Date(event.start_dt))
    setCurrentView('timeGridDay')
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div className="flex flex-col border-b border-stone-200 bg-white flex-shrink-0">
      {/* Row 1: navigation + actions */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 gap-2">
        {/* Left: hamburger (mobile) + navigation */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <button
            onClick={onMenuClick}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors md:hidden flex-shrink-0"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
          <button
            onClick={goToday}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-stone-600 transition-colors flex-shrink-0"
          >
            {t('today')}
          </button>
          <button
            onClick={() => step(-1)}
            title={t('previous')}
            aria-label={t('previous')}
            className="p-1 sm:p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => step(1)}
            title={t('next')}
            aria-label={t('next')}
            className="p-1 sm:p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors flex-shrink-0"
          >
            <ChevronRight size={18} />
          </button>
          <span className="hidden sm:inline text-base font-semibold text-stone-800 capitalize tracking-tight truncate">
            {formatTitle()}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <div ref={searchRef} className="relative">
            {showSearch ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm w-36 sm:w-48 focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all"
                />
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                title={t('search')}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <Search size={18} />
              </button>
            )}
            {/* Search results dropdown */}
            {showSearch && (searchResults.length > 0 || searching) && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-stone-200 z-50 overflow-hidden">
                {searching ? (
                  <div className="px-4 py-3 text-xs text-stone-400">{t('searching')}</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => handleResultClick(event)}
                        className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-stone-800 truncate">{getTranslatedTitle(event, i18n.language.slice(0, 2), calendar.language || 'fr')}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {format(new Date(event.start_dt), 'd MMM yyyy HH:mm', { locale: dateLocale })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {canAdd(effectivePermission) && (
            <button
              onClick={onNewEvent}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-lamp-500 text-white text-sm rounded-lg hover:bg-lamp-600 font-medium shadow-sm transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{t('event')}</span>
            </button>
          )}
          {(isAdmin(effectivePermission) || isOwner || user?.is_superadmin) && (
            <button
              onClick={() => navigate(`/c/${slug}/settings`)}
              title={t('settings')}
              aria-label={t('settings')}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <Settings size={18} />
            </button>
          )}
          <LanguageSwitcher />
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              title={t('logout')}
              aria-label={t('logout')}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Row 1b: date on its own line (mobile only) */}
      <div className="sm:hidden px-3 pb-1">
        <span className="text-base font-bold text-stone-800 capitalize tracking-tight">
          {formatTitle()}
        </span>
      </div>

      {/* Row 2: view switcher */}
      <div className="flex items-center px-2 sm:px-4 pb-2 overflow-x-auto scrollbar-hide">
        <div className="flex items-center bg-stone-100 rounded-xl p-0.5 gap-0.5 mx-auto">
          {VIEW_KEYS.map((v) => (
            <button
              key={v.key}
              onClick={() => setCurrentView(v.key)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-lg transition-all duration-150 whitespace-nowrap ${
                currentView === v.key
                  ? 'bg-white shadow-sm text-lamp-600 font-semibold'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {t(v.tKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
