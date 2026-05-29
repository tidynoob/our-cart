import { createContext, useContext } from 'react'

export const SidebarContext = createContext<{
  onOpenSidebar: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
}>({
  onOpenSidebar: () => {},
  triggerRef: { current: null },
})

export function useSidebarContext() {
  return useContext(SidebarContext)
}
