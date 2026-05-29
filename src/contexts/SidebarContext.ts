import { createContext, useContext } from 'react'

export const SidebarContext = createContext<{ onOpenSidebar: () => void }>({
  onOpenSidebar: () => {},
})

export function useSidebarContext() {
  return useContext(SidebarContext)
}
