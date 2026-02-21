import type { Locale } from 'date-fns'
import { fr, nl, de, enUS } from 'date-fns/locale'
import frLocale from '@fullcalendar/core/locales/fr'
import nlLocale from '@fullcalendar/core/locales/nl'
import deLocale from '@fullcalendar/core/locales/de'
import enLocale from '@fullcalendar/core/locales/en-gb'

const dateFnsLocales: Record<string, Locale> = { fr, nl, de, en: enUS }
const fcLocales: Record<string, typeof frLocale> = { fr: frLocale, nl: nlLocale, de: deLocale, en: enLocale }

export function getDateLocale(lang: string): Locale {
  return dateFnsLocales[lang] ?? fr
}

export function getFcLocale(lang: string) {
  return fcLocales[lang] ?? frLocale
}
