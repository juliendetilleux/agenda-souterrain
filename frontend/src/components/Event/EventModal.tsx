import { useState, useEffect, lazy, Suspense } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Trash2, FileText, User, Repeat, Tag, Download } from 'lucide-react'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { calendarApi } from '../../api/calendars'
import { useCalendarStore } from '../../store/calendarStore'
import { useAuthStore } from '../../store/authStore'
import { canAdd, canModify, canModifyOwn, canRead } from '../../utils/permissions'
import type { CalendarConfig, SubCalendar, CalendarEvent } from '../../types'
const LocationPicker = lazy(() => import('./LocationPicker'))
import ChatSection from './ChatSection'
import AttachmentSection from './AttachmentSection'
import { getTranslatedTitle, getTranslatedNotes } from '../../hooks/useAutoTranslate'
import toast from 'react-hot-toast'

interface Props {
  calendar: CalendarConfig
  subCalendars: SubCalendar[]
  event: CalendarEvent | null
  defaultDates: { start: Date; end: Date; allDay: boolean } | null
  onClose: () => void
  onSaved: () => void
}

// Converts stored ISO string to "yyyy-MM-ddTHH:mm" for datetime-local input
function toDatetimeLocal(iso: string) {
  const base = iso.slice(0, 16)
  return base.includes('T') ? base : base + 'T00:00'
}

export default function EventModal({
  calendar,
  subCalendars,
  event,
  defaultDates,
  onClose,
  onSaved,
}: Props) {
  const { t, i18n } = useTranslation('events')
  const { t: tc } = useTranslation('common')
  const targetLang = i18n.language.slice(0, 2)
  const sourceLang = calendar.language || 'fr'
  const isNew = !event

  const { effectivePermission } = useCalendarStore()
  const { user } = useAuthStore()

  const isOwner = !!user && event?.creator_user_id === user.id
  const canEdit = isNew
    ? canAdd(effectivePermission)
    : canModify(effectivePermission) || (canModifyOwn(effectivePermission) && isOwner)
  const canDeleteEvent =
    canModify(effectivePermission) ||
    (canModifyOwn(effectivePermission) && isOwner)

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [title, setTitle] = useState(event?.title ?? '')
  const [titleEdited, setTitleEdited] = useState(false)
  const [subCalId, setSubCalId] = useState(
    event?.sub_calendar_id ?? subCalendars[0]?.id ?? ''
  )
  const [startDt, setStartDt] = useState(() => {
    if (event) return toDatetimeLocal(event.start_dt)
    if (defaultDates) {
      if (defaultDates.allDay) return format(defaultDates.start, "yyyy-MM-dd") + 'T09:00'
      return format(defaultDates.start, "yyyy-MM-dd'T'HH:mm")
    }
    return format(new Date(), "yyyy-MM-dd'T'HH:mm")
  })
  const [endDt, setEndDt] = useState(() => {
    if (event) return toDatetimeLocal(event.end_dt)
    if (defaultDates) {
      if (defaultDates.allDay) return format(defaultDates.start, "yyyy-MM-dd") + 'T10:00'
      return format(defaultDates.end, "yyyy-MM-dd'T'HH:mm")
    }
    const end = new Date()
    end.setHours(end.getHours() + 1)
    return format(end, "yyyy-MM-dd'T'HH:mm")
  })
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [location, setLocation] = useState(event?.location ?? '')
  const [latitude, setLatitude] = useState<number | null>(event?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(event?.longitude ?? null)
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [notesEdited, setNotesEdited] = useState(false)
  const [who, setWho] = useState(event?.who ?? '')
  const [rrule, setRrule] = useState(event?.rrule ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    event?.tags?.map((tg) => tg.id) ?? []
  )

  const isDirty = (() => {
    if (isNew) {
      return !!(title || location || notes || who || rrule || selectedTagIds.length > 0)
    }
    if (!event) return false
    return (
      (titleEdited && title !== event.title) ||
      subCalId !== event.sub_calendar_id ||
      location !== (event.location ?? '') ||
      (notesEdited && notes !== (event.notes ?? '')) ||
      who !== (event.who ?? '') ||
      rrule !== (event.rrule ?? '') ||
      allDay !== event.all_day ||
      JSON.stringify(selectedTagIds.sort()) !== JSON.stringify((event.tags?.map(t => t.id) ?? []).sort())
    )
  })()

  const guardedClose = () => {
    if (isDirty && canEdit) {
      if (!window.confirm('Vous avez des modifications non sauvegardées. Quitter quand même ?')) {
        return
      }
    }
    onClose()
  }

  // Close on Escape key — no dependency array so guardedClose always reflects latest isDirty
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') guardedClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const { data: availableTags = [] } = useQuery({
    queryKey: ['tags', calendar.id],
    queryFn: () => calendarApi.getTags(calendar.id),
  })

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const createMutation = useMutation({
    mutationFn: (data: Partial<CalendarEvent>) => calendarApi.createEvent(calendar.id, data),
    onSuccess: () => { toast.success(t('toast.created')); onSaved() },
    onError: () => toast.error(t('toast.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CalendarEvent>) =>
      calendarApi.updateEvent(calendar.id, event!.id, data),
    onSuccess: () => { toast.success(t('toast.updated')); onSaved() },
    onError: () => toast.error(t('toast.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => calendarApi.deleteEvent(calendar.id, event!.id),
    onSuccess: () => { toast.success(t('toast.deleted')); onSaved() },
    onError: () => toast.error(t('toast.deleteError')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      sub_calendar_id: subCalId,
      title,
      start_dt: allDay ? `${startDt.slice(0, 10)}T00:00:00` : `${startDt}:00`,
      end_dt: allDay ? `${endDt.slice(0, 10)}T00:00:00` : `${endDt}:00`,
      all_day: allDay,
      location: location || null,
      latitude: latitude,
      longitude: longitude,
      notes: notes || null,
      who: who || null,
      rrule: rrule || null,
      tag_ids: selectedTagIds,
    }
    if (isNew) createMutation.mutate(payload)
    else updateMutation.mutate(payload)
  }

  const handleStartChange = (newStart: string) => {
    if (!newStart) { setStartDt(newStart); return }
    const duration = Math.max(new Date(endDt).getTime() - new Date(startDt).getTime(), 60 * 60 * 1000)
    const newEnd = new Date(new Date(newStart).getTime() + duration)
    setStartDt(newStart)
    setEndDt(format(newEnd, "yyyy-MM-dd'T'HH:mm"))
  }

  const handleEndChange = (newEnd: string) => {
    setEndDt(newEnd && newEnd < startDt ? startDt : newEnd)
  }

  const handleDelete = () => {
    confirm(t('deleteTitle'), t('deleteMsg'), () => deleteMutation.mutate())
  }

  const handleExportIcs = async () => {
    if (!event) return
    try {
      await calendarApi.exportEventIcal(calendar.id, event.id, title || 'event')
    } catch { /* ignore */ }
  }

  const selectedSc = subCalendars.find((s) => s.id === subCalId)
  const isPending = createMutation.isPending || updateMutation.isPending

  const inputClass = (extra = '') =>
    `w-full text-sm rounded-lg border border-stone-200 px-3 py-2 focus:outline-none
     focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all ${extra} ${
      !canEdit ? 'bg-stone-100 text-stone-400 cursor-default' : 'bg-white'
    }`

  const rruleOptions = [
    { value: '', label: t('recurrence.none') },
    { value: 'FREQ=DAILY', label: t('recurrence.daily') },
    { value: 'FREQ=WEEKLY', label: t('recurrence.weekly') },
    { value: 'FREQ=MONTHLY', label: t('recurrence.monthly') },
    { value: 'FREQ=YEARLY', label: t('recurrence.yearly') },
  ]

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-3 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            {isNew ? t('newEvent') : canEdit ? t('editEvent') : t('eventDetails')}
          </h2>
          <button
            onClick={guardedClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          className="px-6 pb-6 space-y-4"
        >
          {/* Title */}
          <div>
            <input
              type="text"
              value={!titleEdited && !isNew && event ? getTranslatedTitle(event, targetLang, sourceLang) : title}
              onChange={(e) => { setTitle(e.target.value); setTitleEdited(true) }}
              required
              maxLength={500}
              readOnly={!canEdit}
              placeholder={t('titlePlaceholder')}
              className={`w-full text-xl font-semibold border-0 border-b-2 border-stone-100 pb-3
                focus:outline-none placeholder:text-stone-300 text-stone-900 tracking-tight ${
                canEdit ? 'focus:border-lamp-400' : 'bg-white text-stone-600 cursor-default'
              }`}
            />
            {title.length > 450 && (
              <p className={`text-xs mt-1 ${title.length >= 500 ? 'text-red-500' : 'text-stone-400'}`}>
                {title.length}/500{title.length >= 500 ? ` — ${t('validation.titleTooLong')}` : ''}
              </p>
            )}
          </div>

          {/* Section 1: Sub-cal + dates */}
          <div className="bg-stone-50 rounded-xl p-4 space-y-3">
            {/* Sub-calendar */}
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedSc?.color ?? '#3788d8' }}
              />
              <select
                value={subCalId}
                onChange={(e) => setSubCalId(e.target.value)}
                disabled={!canEdit}
                className={inputClass('flex-1')}
              >
                {subCalendars.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1">
                  {t('start')}
                </label>
                <input
                  type="datetime-local"
                  value={startDt}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required
                  readOnly={!canEdit}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1">
                  {t('end')}
                </label>
                <input
                  type="datetime-local"
                  value={endDt}
                  min={startDt}
                  onChange={(e) => handleEndChange(e.target.value)}
                  required
                  readOnly={!canEdit}
                  className={inputClass()}
                />
              </div>
            </div>

            {/* All-day */}
            <label className={`flex items-center gap-2 text-sm text-stone-600 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                disabled={!canEdit}
                className="rounded"
                style={{ accentColor: '#f59e0b' }}
              />
              <span className="text-sm text-stone-600">{t('allDay')}</span>
            </label>
          </div>

          {/* Section 2: Optional fields */}
          <div className="bg-stone-50 rounded-xl p-4 space-y-3">
            {/* Location with map */}
            <Suspense fallback={<div className="h-10 flex items-center text-xs text-stone-400">...</div>}>
              <LocationPicker
                location={location}
                latitude={latitude}
                longitude={longitude}
                readOnly={!canEdit}
                onLocationChange={setLocation}
                onCoordsChange={(lat, lng) => { setLatitude(lat); setLongitude(lng) }}
              />
            </Suspense>

            {/* Who */}
            <div className="flex items-center gap-3">
              <User size={15} className="text-stone-400 flex-shrink-0" />
              <input
                type="text"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                readOnly={!canEdit}
                placeholder={t('whoPlaceholder')}
                className={inputClass('flex-1')}
              />
            </div>

            {/* Notes */}
            <div className="flex items-start gap-3">
              <FileText size={15} className="text-stone-400 flex-shrink-0 mt-2.5" />
              <div className="flex-1">
                <textarea
                  value={!notesEdited && !isNew && event ? (getTranslatedNotes(event, targetLang, sourceLang) ?? '') : notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesEdited(true) }}
                  readOnly={!canEdit}
                  maxLength={10000}
                  placeholder={t('notesPlaceholder')}
                  rows={3}
                  className={`w-full text-sm rounded-lg border border-stone-200 px-3 py-2 focus:outline-none
                    focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all resize-none ${
                    !canEdit ? 'bg-stone-100 text-stone-400 cursor-default' : 'bg-white'
                  }`}
                />
                {notes.length > 9000 && (
                  <p className={`text-xs mt-1 ${notes.length >= 10000 ? 'text-red-500' : 'text-stone-400'}`}>
                    {notes.length.toLocaleString()}/10 000{notes.length >= 10000 ? ` — ${t('validation.notesTooLong')}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Recurrence */}
            <div className="flex items-center gap-3">
              <Repeat size={15} className="text-stone-400 flex-shrink-0" />
              <select
                value={rrule}
                onChange={(e) => setRrule(e.target.value)}
                disabled={!canEdit}
                className={inputClass('flex-1')}
              >
                {rruleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Tags */}
          {availableTags.length > 0 && (
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Tag size={15} className="text-stone-400 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                  {t('tags')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => canEdit && toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                        transition-all ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${
                        selected
                          ? 'text-white shadow-sm'
                          : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300'
                      }`}
                      style={selected ? { backgroundColor: tag.color } : undefined}
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${selected ? '' : ''}`}
                        style={{ backgroundColor: selected ? 'rgba(255,255,255,0.6)' : tag.color }}
                      />
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section 4: Attachments — only for existing events */}
          {!isNew && event && canRead(effectivePermission) && (
            <AttachmentSection
              calendarId={calendar.id}
              eventId={event.id}
              canUpload={canAdd(effectivePermission)}
              canModerate={canModify(effectivePermission)}
            />
          )}

          {/* Section 5: Chat — only for existing events */}
          {!isNew && event && canRead(effectivePermission) && (
            <ChatSection
              calendarId={calendar.id}
              eventId={event.id}
              sourceLang={sourceLang}
              canPost={canRead(effectivePermission)}
              canModerate={canModify(effectivePermission)}
            />
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <div className="flex items-center gap-3">
              {!isNew && canDeleteEvent && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  <Trash2 size={15} />
                  {tc('delete')}
                </button>
              )}
              {!isNew && (
                <button
                  type="button"
                  onClick={handleExportIcs}
                  title={t('exportIcs')}
                  className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <Download size={15} />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={guardedClose}
                className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700 font-medium
                           transition-colors rounded-lg hover:bg-stone-100"
              >
                {canEdit ? tc('cancel') : tc('close')}
              </button>
              {canEdit && (
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-sm bg-lamp-500 text-white rounded-xl hover:bg-lamp-600
                             font-semibold shadow-sm disabled:opacity-50 transition-all"
                >
                  {isPending ? tc('saving') : tc('save')}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
