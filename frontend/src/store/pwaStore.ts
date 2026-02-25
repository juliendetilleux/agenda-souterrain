import { create } from 'zustand'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const checkStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true

interface PwaState {
  deferredPrompt: BeforeInstallPromptEvent | null
  dismissed: boolean
  isStandalone: boolean
  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void
  setDismissed: (v: boolean) => void
  setIsStandalone: (v: boolean) => void
}

export const usePwaStore = create<PwaState>((set) => ({
  deferredPrompt: null,
  dismissed: localStorage.getItem('pwa-dismissed') === '1',
  isStandalone: checkStandalone(),
  setDeferredPrompt: (e) => set({ deferredPrompt: e }),
  setDismissed: (v) => set({ dismissed: v }),
  setIsStandalone: (v) => set({ isStandalone: v }),
}))
