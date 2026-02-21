import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import frCommon from './locales/fr/common.json'
import frCalendar from './locales/fr/calendar.json'
import frEvents from './locales/fr/events.json'
import frSettings from './locales/fr/settings.json'
import frAuth from './locales/fr/auth.json'
import frHome from './locales/fr/home.json'

import enCommon from './locales/en/common.json'
import enCalendar from './locales/en/calendar.json'
import enEvents from './locales/en/events.json'
import enSettings from './locales/en/settings.json'
import enAuth from './locales/en/auth.json'
import enHome from './locales/en/home.json'

import nlCommon from './locales/nl/common.json'
import nlCalendar from './locales/nl/calendar.json'
import nlEvents from './locales/nl/events.json'
import nlSettings from './locales/nl/settings.json'
import nlAuth from './locales/nl/auth.json'
import nlHome from './locales/nl/home.json'

import deCommon from './locales/de/common.json'
import deCalendar from './locales/de/calendar.json'
import deEvents from './locales/de/events.json'
import deSettings from './locales/de/settings.json'
import deAuth from './locales/de/auth.json'
import deHome from './locales/de/home.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { common: frCommon, calendar: frCalendar, events: frEvents, settings: frSettings, auth: frAuth, home: frHome },
      en: { common: enCommon, calendar: enCalendar, events: enEvents, settings: enSettings, auth: enAuth, home: enHome },
      nl: { common: nlCommon, calendar: nlCalendar, events: nlEvents, settings: nlSettings, auth: nlAuth, home: nlHome },
      de: { common: deCommon, calendar: deCalendar, events: deEvents, settings: deSettings, auth: deAuth, home: deHome },
    },
    fallbackLng: 'fr',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
