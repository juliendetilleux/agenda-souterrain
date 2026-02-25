import { create } from 'zustand'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  deferredPrompt: BeforeInstallPromptEvent | null
  dismissed: boolean
  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void
  setDismissed: (v: boolean) => void
}

export const usePwaStore = create<PwaState>((set) => ({
  deferredPrompt: null,
  dismissed: localStorage.getItem('pwa-dismissed') === '1',
  setDeferredPrompt: (e) => set({ deferredPrompt: e }),
  setDismissed: (v) => set({ dismissed: v }),
}))
