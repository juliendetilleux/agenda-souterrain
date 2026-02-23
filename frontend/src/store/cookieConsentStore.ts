import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CookieConsent {
  necessary: true
  preferences: boolean
  analytics: boolean
}

interface CookieConsentState {
  consent: CookieConsent | null
  setConsent: (consent: CookieConsent) => void
  acceptAll: () => void
  rejectOptional: () => void
}

export const useCookieConsentStore = create<CookieConsentState>()(
  persist(
    (set) => ({
      consent: null,
      setConsent: (consent) => set({ consent }),
      acceptAll: () => set({ consent: { necessary: true, preferences: true, analytics: true } }),
      rejectOptional: () => set({ consent: { necessary: true, preferences: false, analytics: false } }),
    }),
    { name: 'cookie-consent' },
  ),
)
