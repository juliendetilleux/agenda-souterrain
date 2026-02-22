import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Plus, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { calendarApi } from '../api/calendars'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function HomePage() {
  const { t } = useTranslation('home')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const isSuperadmin = Boolean(user?.is_superadmin)

  const { data: calendars = [], isLoading } = useQuery({
    queryKey: ['accessible-calendars'],
    queryFn: calendarApi.getAccessible,
  })

  // Auto-redirect if user has access to exactly 1 calendar and can't create new ones
  useEffect(() => {
    if (!isLoading && calendars.length === 1 && !isSuperadmin) {
      navigate(`/c/${calendars[0].slug}`, { replace: true })
    }
  }, [isLoading, calendars, isSuperadmin, navigate])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header — cave dark */}
      <div className="bg-cave border-b border-cave-700 px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-lamp-500" />
          <span className="text-cave-text-active text-sm font-semibold tracking-tight">
            ↓ {tc('brand')}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-cave-text text-xs font-medium hidden sm:block">
            {user?.name || user?.email}
          </span>
          <LanguageSwitcher variant="dark" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cave-text
                       hover:text-cave-text-active rounded-lg hover:bg-cave-800 transition-colors"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">{tc('logout')}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">{t('myCalendars')}</h1>
            <p className="text-stone-400 text-sm mt-0.5">
              {isLoading
                ? tc('loading')
                : calendars.length > 0
                ? t('calendarCount', { count: calendars.length })
                : t('noCalendars')}
            </p>
          </div>
          {isSuperadmin && (
            <button
              onClick={() => navigate('/new')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                         text-white bg-lamp-500 hover:bg-lamp-600 shadow-sm transition-all flex-shrink-0"
            >
              <Plus size={15} />
              {t('createCalendar')}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-stone-300 text-sm">{tc('loading')}</div>
        ) : calendars.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-100">
            <CalendarDays size={36} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-400 text-sm font-medium">{t('noCalendars')}</p>
            <p className="text-stone-300 text-xs mt-1.5 max-w-xs mx-auto">
              {t('noCalendarsDetail')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {calendars.map((cal) => (
              <button
                key={cal.id}
                onClick={() => navigate(`/c/${cal.slug}`)}
                className="group text-left bg-white rounded-2xl border border-stone-100 p-5
                           hover:border-lamp-300 hover:shadow-md transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-800 truncate group-hover:text-lamp-600 transition-colors">
                      {cal.title}
                    </p>
                    <p className="text-xs text-stone-400 font-mono mt-0.5 truncate">/c/{cal.slug}</p>
                  </div>
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-stone-50 group-hover:bg-lamp-50
                                  flex items-center justify-center transition-colors">
                    <CalendarDays size={16} className="text-stone-300 group-hover:text-lamp-500 transition-colors" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
