# Phase 4: Real-Time Sync - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 7 (4 source files, 3 test files)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/itemsStore.ts` | store | event-driven + CRUD | `src/stores/itemsStore.ts` (self — existing actions) | exact |
| `src/components/SyncStatus.tsx` | component | request-response (store read) | `src/components/AttributionBadge.tsx` | exact (small presentational, no props beyond store slice) |
| `src/pages/ListPage.tsx` | page / lifecycle driver | request-response | `src/pages/ListPage.tsx` (self — existing useEffect) | exact |
| `src/lib/supabase.ts` | config | — | `src/lib/supabase.ts` (self — existing createClient call) | exact |
| `src/stores/itemsStore.test.ts` | test | — | `src/stores/itemsStore.test.ts` (self — existing vi.mock shape) | exact |
| `src/pages/ListPage.test.tsx` | test | — | `src/pages/ListPage.test.tsx` (self — existing render helper + mock shape) | exact |
| `src/components/SyncStatus.test.tsx` | test | — | `src/components/ShareBanner.test.tsx` | role-match (simple render + state assertions, no router needed) |

---

## Pattern Assignments

### `src/stores/itemsStore.ts` (store, event-driven — ADD `subscribeToList`, `unsubscribe`, `syncStatus`, `channel`)

**Analog:** `src/stores/itemsStore.ts` (existing actions)

**Existing interface block** (lines 6–26) — extend this interface with new fields and actions:
```typescript
// Current interface (lines 6-26 of itemsStore.ts) — add to this:
interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
  // ADD:
  syncStatus: 'connecting' | 'live' | 'reconnecting'
  channel: ReturnType<typeof supabase.channel> | null

  fetchItems: (listId: string) => Promise<void>
  // ... existing actions ...
  // ADD:
  subscribeToList: (listId: string) => void
  unsubscribe: () => void
}
```

**Existing `set()` pattern for state update** (lines 62, 96–98) — the merge reducer uses the same functional-set form:
```typescript
// Optimistic add — from addItem (line 62):
set((state) => ({ items: [...state.items, optimisticItem] }))

// Optimistic update with map — from updateItem (lines 96-98):
set((state) => ({
  items: state.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
}))

// Filter by id — from deleteItem (lines 120-122):
set((state) => ({
  items: state.items.filter((i) => i.id !== id),
}))
```

**Existing `get()` for reading state inside actions** (lines 92, 166):
```typescript
// Read current items inside an action:
const prev = get().items.find((i) => i.id === id)
// Read items before set():
const checkedItems = get().items.filter((i) => i.checked)
```

**INSERT echo guard pattern — analog in addItem temp-id replacement** (lines 83–88):
```typescript
// Replace temp item with real DB row by id (addItem lines 83-88):
set((state) => ({
  items: state.items.map((i) => (i.id === tempId ? data : i)),
}))
// The INSERT echo guard in the merge reducer is the same id-keyed check:
// const alreadyPresent = state.items.some((i) => i.id === (newRow as Item).id)
// if (alreadyPresent) return state
```

**Existing supabase import** (lines 1–4):
```typescript
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/item'
```

**New imports to add for Phase 4** (append after existing imports):
```typescript
import type { RealtimeChannel } from '@supabase/supabase-js'
// Use string literals for status — avoids import-path uncertainty (RESEARCH Open Question 1):
// 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
```

**Store initial state** (lines 28–31) — add new fields here:
```typescript
export const useItemsStore = create<ItemsState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,
  // ADD:
  syncStatus: 'connecting',
  channel: null,
  // ... existing actions
}))
```

---

### `src/components/SyncStatus.tsx` (component, store read — CREATE)

**Analog:** `src/components/AttributionBadge.tsx`

**File structure to copy** (all of AttributionBadge.tsx):
```typescript
// AttributionBadge.tsx — the exact structural template:
import { getAttributionColor, getInitials } from '@/lib/attribution'
import { cn } from '@/lib/utils'

interface AttributionBadgeProps {
  name: string
  className?: string
}

export function AttributionBadge({ name, className }: AttributionBadgeProps) {
  const color = getAttributionColor(name)

  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        className
      )}
      // ...
    >
      {getInitials(name)}
    </div>
  )
}
```

**SyncStatus diverges from the analog in one key way:** it reads from the Zustand store (no props for the status value) and renders conditionally. Apply the AttributionBadge structure but source state from `useItemsStore`:

```typescript
// Pattern: read a single store slice, no props required
import { useItemsStore } from '@/stores/itemsStore'

export function SyncStatus() {
  const syncStatus = useItemsStore((s) => s.syncStatus)
  // ... conditional render based on syncStatus
}
```

**Tailwind className conventions from AttributionBadge** (lines 19–25):
- Use `flex items-center` for inline layout
- Use `text-xs` for small labels
- Use `rounded-full` for dot indicators
- Use `shrink-0` on fixed-size elements
- Pass `className` prop + `cn()` only when the component may need external layout overrides; SyncStatus does not need this since it is self-contained in the header

**Named export convention** (not default): all components in `src/components/` use `export function` (not `export default`). SyncStatus must follow suit.

---

### `src/pages/ListPage.tsx` (page, lifecycle driver — MODIFY)

**Analog:** `src/pages/ListPage.tsx` (self)

**Existing useEffect to modify** (lines 83–93) — this is the "Lifecycle step 2" block; Phase 4 replaces the bare `fetchItems` call with subscribe-before-fetch:
```typescript
// CURRENT (lines 83-93):
useEffect(() => {
  if (!list) return

  fetchItems(list.id)

  const storedName = localStorage.getItem(`our-cart-name-${list.id}`)
  if (storedName) {
    setUserName(storedName)
  }
}, [list, fetchItems])
```

**Pattern: destructure actions from getState() inside effects** — shown in research sketch; consistent with how the store is consumed elsewhere:
```typescript
// Store selector pattern used throughout ListPage (lines 46-53):
const items = useItemsStore((state) => state.items)
const fetchItems = useItemsStore((state) => state.fetchItems)
// For the useEffect interior, use getState() to avoid dependency array issues:
const { subscribeToList, unsubscribe, fetchItems } = useItemsStore.getState()
```

**Header location for SyncStatus pill** (lines 197–198):
```typescript
// Current header (line 197-198):
<div className="w-full max-w-md p-4">
  <h1 className="text-2xl font-semibold">{list.name}</h1>
```
The pill mounts adjacent to `<h1>` — wrap both in a `flex items-center justify-between` div or append inline after the heading text.

**Existing import block** (lines 1–20) — import SyncStatus here following the existing component import pattern:
```typescript
import { ShareBanner } from '@/components/ShareBanner'
import { NamePromptDialog } from '@/components/NamePromptDialog'
import { AddItemBar } from '@/components/AddItemBar'
import { CategorySection } from '@/components/CategorySection'
// ADD:
import { SyncStatus } from '@/components/SyncStatus'
```

**Store selector lines to extend** (lines 46–53) — add new selectors following the same pattern:
```typescript
// Existing pattern:
const fetchItems = useItemsStore((state) => state.fetchItems)
// ADD (same pattern):
const subscribeToList = useItemsStore((state) => state.subscribeToList)
const unsubscribe = useItemsStore((state) => state.unsubscribe)
```

---

### `src/lib/supabase.ts` (config — MODIFY)

**Analog:** `src/lib/supabase.ts` (self — current createClient call)

**Current file in full** (lines 1–10):
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
```

**Modification:** add a third options argument to `createClient`. No other lines change:
```typescript
export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    worker: true,
  },
})
```

---

## Shared Patterns

### Zustand `set()` functional updater — always use when reading `state`
**Source:** `src/stores/itemsStore.ts` lines 62, 96–98, 120–122, 169–173
**Apply to:** All merge reducer branches in `subscribeToList`
```typescript
// Always use functional form (state) => ({...}) when the new value depends on current state.
// Never use set({ items: ... }) directly when computing from state.items.
set((state) => ({
  items: state.items.filter((i) => i.id !== id),
}))
```

### Zustand `set()` flat update — use for simple field assignments
**Source:** `src/stores/itemsStore.ts` lines 34, 44
**Apply to:** `syncStatus` and `channel` assignments in `subscribeToList` / `unsubscribe`
```typescript
// Simple flat set — no state read needed:
set({ loading: true, error: null })
set({ syncStatus: 'live' })
set({ channel: null, syncStatus: 'connecting' })
```

### Store action wiring in ListPage selectors
**Source:** `src/pages/ListPage.tsx` lines 46–53
**Apply to:** `subscribeToList`, `unsubscribe` selector additions
```typescript
// All store actions are pulled at the top of the component with individual selectors:
const fetchItems = useItemsStore((state) => state.fetchItems)
const updateItem = useItemsStore((state) => state.updateItem)
// Each action is one selector line — no object destructuring from a single selector.
```

### `.catch(() => {})` on store action calls in event handlers
**Source:** `src/pages/ListPage.tsx` lines 114, 128, 144, 154
**Apply to:** Any store action call in ListPage that returns a Promise
```typescript
// Pattern: store handles rollback + error internally; .catch() guards against
// unhandled rejections from network-level throws.
updateItem(id, changes).catch(() => {})
deleteItem(id).catch(() => {})
```

### Named export for components (not default)
**Source:** `src/components/AttributionBadge.tsx` line 14, `src/components/DeleteConfirmation.tsx` line 19
**Apply to:** `SyncStatus.tsx`
```typescript
export function SyncStatus() { ... }
// Not: export default function SyncStatus() { ... }
```

---

## Test File Patterns

### `src/stores/itemsStore.test.ts` (MODIFY — add channel/subscribe mock)

**Analog:** `src/stores/itemsStore.test.ts` (self — existing vi.mock shape)

**Current vi.mock shape** (lines 40–44):
```typescript
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (_table: string) => createMockFrom(),
  },
}))
```

**Extension pattern** — add `channel` and `removeChannel` to the existing mock object:
```typescript
// Capture the subscribe callback so tests can trigger status changes directly:
let capturedSubscribeCb: ((status: string) => void) | null = null
const mockChannelOn = vi.fn().mockReturnThis()   // .on() chains — returns channel
const mockChannelSubscribe = vi.fn().mockImplementation((cb) => {
  capturedSubscribeCb = cb
  return {}   // the channel object returned by .subscribe()
})
const mockRemoveChannel = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (_table: string) => createMockFrom(),   // keep existing
    channel: vi.fn().mockReturnValue({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    }),
    removeChannel: mockRemoveChannel,
  },
}))

// In test: trigger status callback:
capturedSubscribeCb?.('SUBSCRIBED')
// Then assert syncStatus and that fetchItems was called.
```

**beforeEach state reset pattern** (lines 49–68) — extend to reset new state fields:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  useItemsStore.setState({
    items: [...seedItems],
    loading: false,
    error: null,
    // ADD:
    syncStatus: 'connecting',
    channel: null,
  })
  capturedSubscribeCb = null
})
```

**Describe block + it() naming convention** (lines 46, 71):
```typescript
describe('itemsStore — subscribeToList', () => {
  it('sets syncStatus to "live" and calls fetchItems when SUBSCRIBED fires (SYNC-02/03)', async () => { ... })
  it('sets syncStatus to "reconnecting" on CHANNEL_ERROR (SYNC-03)', async () => { ... })
})

describe('itemsStore — mergeReducer', () => {
  it('INSERT echo: no-op when id already exists in items (SYNC-01)', () => { ... })
  it('INSERT from partner: appends new item when id is absent (SYNC-01)', () => { ... })
  it('UPDATE from partner: replaces matching row by id (SYNC-01)', () => { ... })
  it('DELETE from partner: removes item by id from payload.old (SYNC-01)', () => { ... })
  it('DELETE with only id in payload.old: handles partial old object safely (SYNC-01)', () => { ... })
})
```

---

### `src/pages/ListPage.test.tsx` (MODIFY — add visibilitychange/online tests)

**Analog:** `src/pages/ListPage.test.tsx` (self — existing render helper)

**Existing supabase mock** (lines 43–80) — must be extended with `channel` and `removeChannel` to prevent "supabase.channel is not a function" errors when ListPage now calls `subscribeToList`:
```typescript
// Add channel + removeChannel alongside existing from mock:
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => { ... },   // keep existing
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockImplementation((cb) => {
        // Trigger SUBSCRIBED immediately so tests don't hang waiting for it:
        setTimeout(() => cb('SUBSCRIBED'), 0)
        return {}
      }),
    }),
    removeChannel: vi.fn(),
  },
}))
```

**Existing `renderAtRoute` helper** (lines 82–91) — reuse unchanged for new tests:
```typescript
function renderAtRoute(code: string) {
  return render(
    <MemoryRouter initialEntries={[`/list/${code}`]}>
      <Routes>
        <Route path="/list/:code" element={<ListPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
```

**beforeEach with store reset** (lines 171–178) — copy this pattern for new describe blocks:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockItemsResponse = []
  useItemsStore.setState({ items: [], loading: false, error: null, syncStatus: 'connecting', channel: null })
  localStorage.setItem('our-cart-name-list-id-1', 'TestUser')
})
```

**`act` + `fireEvent` pattern for DOM events** (lines 215–217):
```typescript
// For visibilitychange / online tests — fire the event and let the handler run:
await act(async () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
// Then assert fetchItems (mockOrder) was called again.
```

---

### `src/components/SyncStatus.test.tsx` (CREATE)

**Analog:** `src/components/ShareBanner.test.tsx`

**File structure to copy** (all of ShareBanner.test.tsx):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareBanner } from './ShareBanner'

// Mock stores used by the component:
vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    dismissBanner: mockDismissBanner,
    dismissedBanners: new Set<string>(),
  })),
}))

describe('ShareBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the listCode value as visible text', () => {
    render(<ShareBanner {...DEFAULT_PROPS} />)
    expect(screen.getByText('ABC12345')).toBeTruthy()
  })
})
```

**SyncStatus.test.tsx applies the same structure**, mocking `itemsStore` instead of `uiStore`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatus } from './SyncStatus'

vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: vi.fn((selector: (s: { syncStatus: string }) => unknown) =>
    selector({ syncStatus: 'live' })
  ),
}))

describe('SyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Live" text when syncStatus is "live"', () => {
    render(<SyncStatus />)
    expect(screen.getByText('Live')).toBeTruthy()
  })

  it('renders "Connecting…" text when syncStatus is "connecting"', () => {
    // Override the mock for this test:
    vi.mocked(useItemsStore).mockImplementation((selector) =>
      selector({ syncStatus: 'connecting' })
    )
    render(<SyncStatus />)
    expect(screen.getByText('Connecting…')).toBeTruthy()
  })

  it('renders "Reconnecting…" text when syncStatus is "reconnecting"', () => { ... })
})
```

**Selector mock pattern** — `useItemsStore` takes a selector function; the mock must call that selector with a fake state object. Matches the ShareBanner mock pattern where `useUIStore` is a `vi.fn()` returning a plain object.

---

## No Analog Found

All files have close analogs in the codebase. No entries in this section.

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/pages/`, `src/lib/`
**Files scanned:** 8 source files read in full
**Key imports verified:**
- `@supabase/supabase-js` already installed at `^2.106.1`
- `RealtimeChannel` type available from `@supabase/supabase-js` (use string literals for status values as fallback per RESEARCH Open Question 1)
- `Item` type at `src/types/item.ts` (id, list_id, name, quantity, category, checked, added_by, created_at)
- `cn()` utility at `@/lib/utils` (used by AttributionBadge; available for SyncStatus if needed)
**Pattern extraction date:** 2026-05-26
