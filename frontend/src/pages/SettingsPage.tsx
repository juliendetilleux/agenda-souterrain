import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Settings, Link2, UserPlus, UsersRound, Layers, Tag, ShieldCheck, CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { calendarApi } from '../api/calendars'
import { useAuthStore } from '../store/authStore'
import { useCalendarStore } from '../store/calendarStore'
import { isAdmin } from '../utils/permissions'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import GeneralTab from '../components/Settings/GeneralTab'
import LinksTab from '../components/Settings/LinksTab'
import UsersTab from '../components/Settings/UsersTab'
import GroupsTab from '../components/Settings/GroupsTab'
import SubCalendarsTab from '../components/Settings/SubCalendarsTab'
import TagsTab from '../components/Settings/TagsTab'
import SuperadminUsersTab from '../components/Settings/SuperadminUsersTab'
import SuperadminCalendarsTab from '../components/Settings/SuperadminCalendarsTab'

type TabKey = 'general' | 'links' | 'users' | 'groups' | 'subcalendars' | 'tags' | 'superadmin-users' | 'superadmin-calendars'

interface TabDef {
  key: TabKey
  label: string
  Icon: React.ElementType
}

export default function SettingsPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, user } = useAuthStore()
  const isSuperadmin = Boolean(isAuthenticated && user?.is_superadmin)

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

  const { setPermission, effectivePermission, isOwner } = useCalendarStore()

  const { data: myPerm, isLoading: permLoading } = useQuery({
    queryKey: ['my-permission', calendar?.id],
    queryFn: () => calendarApi.getMyPermission(calendar!.id),
    enabled: !!calendar?.id,
    placeholderData: () => {
      try {
        const raw = localStorage.getItem(`perm-${calendar?.id}`)
        return raw ? JSON.parse(raw) : undefined
      } catch { return undefined }
    },
  })

  useEffect(() => {
    if (myPerm && calendar?.id) {
      setPermission(myPerm.permission, myPerm.is_owner)
      localStorage.setItem(`perm-${calendar.id}`, JSON.stringify(myPerm))
    }
  }, [myPerm, setPermission, calendar?.id])

  const isCalendarAdmin = isOwner || isAdmin(effectivePermission) || isSuperadmin

  // Build visible tabs based on permissions
  const visibleTabs = useMemo(() => {
    const tabs: TabDef[] = []
    if (isOwner || isSuperadmin) {
      tabs.push({ key: 'general', label: t('tabs.general'), Icon: Settings })
    }
    if (isCalendarAdmin) {
      tabs.push(
        { key: 'links', label: t('tabs.links'), Icon: Link2 },
        { key: 'users', label: t('tabs.users'), Icon: UserPlus },
        { key: 'groups', label: t('tabs.groups'), Icon: UsersRound },
        { key: 'subcalendars', label: t('tabs.subcalendars'), Icon: Layers },
        { key: 'tags', label: t('tabs.tags'), Icon: Tag },
      )
    }
    if (isSuperadmin) {
      tabs.push(
        { key: 'superadmin-users', label: t('tabs.superadminUsers'), Icon: ShieldCheck },
        { key: 'superadmin-calendars', label: t('tabs.superadminCalendars'), Icon: CalendarDays },
      )
    }
    return tabs
  }, [isOwner, isCalendarAdmin, isSuperadmin, t])

  // Active tab from URL or first visible
  const urlTab = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  useEffect(() => {
    if (visibleTabs.length === 0) return
    const validKeys = visibleTabs.map((tb) => tb.key)
    if (urlTab && validKeys.includes(urlTab)) {
      setActiveTab(urlTab)
    } else if (!validKeys.includes(activeTab)) {
      // Only reset if current tab is no longer valid (e.g. permissions changed)
      setActiveTab(visibleTabs[0].key)
    }
  }, [visibleTabs, urlTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key)
    setSearchParams({ tab: key }, { replace: true })
  }

  if ((calLoading && !calendar) || (permLoading && !myPerm)) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8f7f4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lamp-500" />
      </div>
    )
  }

  if (!calendar) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8f7f4]">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">{t('notFound')}</p>
          <p className="text-gray-500 text-sm mt-1">{t('notFoundDetail', { slug })}</p>
        </div>
      </div>
    )
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8f7f4]">
        <div className="text-center">
          <p className="text-stone-500 text-lg font-medium">{t('accessDenied')}</p>
          <p className="text-stone-400 text-sm mt-1">{t('accessDeniedDetail')}</p>
          <button
            onClick={() => navigate(`/c/${slug}`)}
            className="mt-4 px-4 py-2 text-sm bg-lamp-500 text-white rounded-xl hover:bg-lamp-600 font-semibold transition-all"
          >
            {t('backToCalendar')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header — cave dark */}
      <div className="bg-cave border-b border-cave-700 px-6 py-5 flex items-center gap-4">
        <button
          onClick={() => navigate(`/c/${slug}`)}
          className="p-1.5 rounded-lg hover:bg-cave-800 text-cave-text transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-cave-text-active tracking-tight">
            {t('title')}
          </h1>
          <p className="text-xs text-cave-text mt-0.5">{calendar.title}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher variant="dark" />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-lamp-500" />
            <span className="text-cave-text text-xs font-medium">{tc('brand')}</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 p-1 bg-stone-100 rounded-xl mb-6">
          {visibleTabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg
                flex-shrink-0 justify-center transition-all duration-150 ${
                activeTab === key
                  ? 'bg-white shadow-sm text-stone-800 font-semibold'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'general' && <GeneralTab calendar={calendar} isSuperadmin={isSuperadmin} />}
        {activeTab === 'links' && <LinksTab calendar={calendar} subCalendars={subCalendars} />}
        {activeTab === 'users' && <UsersTab calendar={calendar} subCalendars={subCalendars} />}
        {activeTab === 'groups' && <GroupsTab calendar={calendar} subCalendars={subCalendars} />}
        {activeTab === 'subcalendars' && <SubCalendarsTab calendar={calendar} />}
        {activeTab === 'tags' && <TagsTab calendar={calendar} />}
        {activeTab === 'superadmin-users' && <SuperadminUsersTab />}
        {activeTab === 'superadmin-calendars' && <SuperadminCalendarsTab />}
      </div>
    </div>
  )
}
