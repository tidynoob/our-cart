import { Outlet } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'
import { SidebarContext } from '@/contexts/SidebarContext'
import Sidebar from '@/components/Sidebar'

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const user = useAuthStore((state) => state.user)
  const lists = useListsStore((state) => state.lists)
  const fetchLists = useListsStore((state) => state.fetchLists)

  // D-05: fetch only when lists cache is empty — prevents refetch on list→list navigation.
  // fetchLists and lists intentionally excluded from dep array to avoid refetch loop.
  useEffect(() => {
    if (user && lists.length === 0) {
      fetchLists(user.id)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue = useMemo(
    () => ({ onOpenSidebar: () => setOpen(true), triggerRef }),
    [triggerRef],
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <Sidebar open={open} onOpenChange={setOpen} lists={lists} finalFocus={triggerRef} />
      <Outlet />
    </SidebarContext.Provider>
  )
}
