import { useItemsStore } from '@/stores/itemsStore'

/**
 * Three-state sync status pill reading syncStatus from itemsStore.
 * Shows green "Live" when subscribed, amber "Connecting…" / "Reconnecting…" otherwise.
 * Per D-08: text-xs, non-intrusive, never blocks add-item flow.
 */
export function SyncStatus() {
  const syncStatus = useItemsStore((s) => s.syncStatus)

  if (syncStatus === 'live') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        Live
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
      {syncStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
    </span>
  )
}
