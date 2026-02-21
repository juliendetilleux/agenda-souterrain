import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../api/calendars'
import type { CalendarEvent } from '../types'

/**
 * Watches i18n.language and triggers background translations for
 * visible events that don't have a cached translation yet.
 * Updates the React Query cache when translations arrive.
 */
export function useAutoTranslate(
  calendarId: string,
  events: CalendarEvent[],
  sourceLang: string
) {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const targetLang = i18n.language.slice(0, 2)
  const translatingRef = useRef(new Set<string>())

  useEffect(() => {
    if (targetLang === sourceLang) return

    const untranslated = events.filter(
      (e) => !e.translations?.[targetLang] && !translatingRef.current.has(e.id)
    )
    if (untranslated.length === 0) return

    untranslated.forEach((event) => {
      translatingRef.current.add(event.id)
      calendarApi
        .translateEvent(calendarId, event.id, targetLang, sourceLang)
        .then((data) => {
          qc.setQueriesData<CalendarEvent[]>(
            { queryKey: ['events', calendarId] },
            (old) => {
              if (!old) return old
              return old.map((e) =>
                e.id !== event.id
                  ? e
                  : {
                      ...e,
                      translations: { ...e.translations, [targetLang]: data },
                    }
              )
            }
          )
        })
        .catch(() => {})
        .finally(() => {
          translatingRef.current.delete(event.id)
        })
    })
  }, [targetLang, events, sourceLang, calendarId, qc])
}

/** Returns translated title if available, otherwise the original. */
export function getTranslatedTitle(
  event: CalendarEvent,
  targetLang: string,
  sourceLang: string
): string {
  if (targetLang === sourceLang) return event.title
  return event.translations?.[targetLang]?.title ?? event.title
}

/** Returns translated notes if available, otherwise the original. */
export function getTranslatedNotes(
  event: CalendarEvent,
  targetLang: string,
  sourceLang: string
): string | null {
  if (targetLang === sourceLang) return event.notes
  return event.translations?.[targetLang]?.notes ?? event.notes
}
