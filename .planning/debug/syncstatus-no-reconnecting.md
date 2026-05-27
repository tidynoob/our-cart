---
status: resolved
trigger: "SyncStatus pill does not transition to Reconnecting when network drops. User sees Failed to add/update item errors but green Live pill never changes to amber Reconnecting."
created: 2026-05-26T00:00:00Z
updated: 2026-05-26T00:00:00Z
---

## Current Focus

hypothesis: The SyncStatus pill tracks WebSocket channel status (via subscribe callback) but REST API mutation failures occur independently and instantly. The WebSocket disconnect detection relies on heartbeat timeout (25-50s delay). During brief network drops, REST calls fail immediately (showing "Failed to add/update item") while the WebSocket heartbeat hasn't timed out yet, so syncStatus stays 'live'. The subscribe callback DOES fire CHANNEL_ERROR on actual disconnect but with significant delay. The missing piece: no bridge between REST mutation failures and syncStatus.
test: Confirmed by tracing the full code path through Phoenix Socket -> Channel -> RealtimeChannel -> subscribe callback. The callback chain is intact and fires CHANNEL_ERROR on heartbeat timeout.
expecting: N/A - root cause confirmed
next_action: Document root cause and suggested fix

## Symptoms

expected: When network drops, Supabase Realtime channel should emit a status change (CHANNEL_ERROR / TIMED_OUT / CLOSED), store should set syncStatus to 'reconnecting', SyncStatus.tsx renders amber pill
actual: Mutations fail with "Failed to add item" / "Failed to update item" errors, but green "Live" pill never changes to amber "Reconnecting"
errors: "Failed to add item", "Failed to update item" — optimistic rollback errors from failed Supabase mutations while offline
reproduction: Drop network (airplane mode or DevTools offline), attempt to add/modify items
started: Unknown — possibly never worked correctly

## Eliminated

## Evidence

- timestamp: 2026-05-26T00:01:00Z
  checked: src/stores/itemsStore.ts lines 257-272 — subscribe callback
  found: The .subscribe() callback handles status === 'SUBSCRIBED' -> set live, else -> set reconnecting. This looks correct IF the callback fires on disconnect.
  implication: If Supabase calls this callback with CHANNEL_ERROR/TIMED_OUT/CLOSED on disconnect, the code should work. Need to verify Supabase client behavior.

- timestamp: 2026-05-26T00:02:00Z
  checked: src/components/SyncStatus.tsx
  found: Component correctly renders based on syncStatus: 'live' = green, 'connecting' = amber "Connecting...", 'reconnecting' = amber "Reconnecting...". No issue here.
  implication: The rendering side is correct. Problem must be in store not setting syncStatus.

- timestamp: 2026-05-26T00:03:00Z
  checked: src/pages/ListPage.tsx lines 87-118
  found: SyncStatus is mounted (line 225). subscribeToList called in useEffect on list load. D-07 reconnect handlers only call fetchItems on visibility/online, they do NOT re-subscribe or update syncStatus.
  implication: The visibility/online handlers recover data but don't touch syncStatus. If Supabase doesn't fire the subscribe callback on disconnect, there's no other mechanism to set 'reconnecting'.

- timestamp: 2026-05-26T00:04:00Z
  checked: Full Supabase Realtime internals — RealtimeChannel.ts subscribe(), Phoenix Channel constructor, Phoenix Socket triggerChanError/heartbeatTimeout/onConnClose
  found: The subscribe callback IS wired correctly. On WebSocket disconnect, the flow is: Socket.onConnClose/heartbeatTimeout -> Socket.triggerChanError -> Channel.trigger(error) -> Channel onError handler -> RealtimeChannel._onError -> subscribe callback(CHANNEL_ERROR). The callback DOES fire.
  implication: The subscribe callback works. The issue is timing, not wiring.

- timestamp: 2026-05-26T00:05:00Z
  checked: Heartbeat timing — default heartbeatIntervalMs is 25000ms (25s). With worker:true, heartbeats are sent via Web Worker but still use Phoenix Socket's sendHeartbeat() which sets pendingHeartbeatRef and schedules heartbeatTimeout.
  found: After network drop, the FIRST heartbeat that was already in-flight or sent after the drop won't get a response. The heartbeatTimeoutTimer fires after heartbeatIntervalMs (25s). On the NEXT keepAlive from the Worker, sendHeartbeat() detects pendingHeartbeatRef is still set and fires heartbeatTimeout(). Total delay: 25-50 seconds.
  implication: REST mutations fail instantly (0-2s), but WebSocket disconnect detection takes 25-50s. During this gap, user sees "Failed to add item" error but pill shows "Live".

- timestamp: 2026-05-26T00:06:00Z
  checked: src/stores/itemsStore.ts addItem/updateItem/toggleChecked/clearChecked — how error state is set on REST failures
  found: Each mutation sets error string (e.g., "Failed to add item") via set() on Supabase REST error. These mutations use supabase.from('items').insert/update/delete — HTTP REST calls, completely independent of the WebSocket channel.
  implication: REST failures and WebSocket status are independent signals. The store has no bridge: mutation failure does NOT set syncStatus to 'reconnecting'. The only mechanism to set syncStatus is the channel subscribe callback, which is heartbeat-dependent (25-50s delay).

- timestamp: 2026-05-26T00:07:00Z
  checked: Brief network drop scenario — online event fires quickly, fetchItems succeeds after network returns
  found: If network drops for <25s: REST calls during the drop fail (error shown), network returns, online event fires, fetchItems succeeds, WebSocket heartbeat never timed out (TCP connection may have survived), syncStatus stays 'live' the entire time. The pill never shows 'Reconnecting' because the WebSocket was never detected as disconnected.
  implication: This is the primary scenario. For brief network drops (most common on mobile), the pill will NEVER show Reconnecting. Only for sustained outages >25-50s will the heartbeat timeout trigger the status change.

## Resolution

root_cause: SyncStatus is driven exclusively by the WebSocket channel subscribe callback, which relies on heartbeat timeout for disconnect detection (25-50 second delay). REST API mutation failures (addItem, updateItem, etc.) are independent HTTP calls that fail instantly on network drop. There is no bridge between REST mutation failures and syncStatus. For brief network drops (<25s), the WebSocket heartbeat never times out, so syncStatus stays 'live' while the user sees "Failed to add/update item" errors from instantly-failing REST calls.
fix:
verification:
files_changed: []
