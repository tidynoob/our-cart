import { create } from 'zustand'

interface UIState {
  dismissedBanners: Set<string>
  dismissBanner: (listCode: string) => void
}

export const useUIStore = create<UIState>()((set) => ({
  dismissedBanners: new Set(),
  dismissBanner: (listCode) =>
    set((state) => ({
      dismissedBanners: new Set([...state.dismissedBanners, listCode]),
    })),
}))
