import { useCookieConsentStore } from '../store/cookieConsentStore'

export function setPreference(key: string, value: string): void {
  const consent = useCookieConsentStore.getState().consent
  if (consent?.preferences) {
    localStorage.setItem(key, value)
  }
}

export function getPreference(key: string): string | null {
  return localStorage.getItem(key)
}
