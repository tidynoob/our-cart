# Phase 9: Auth Integration into ListPage - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 12 (10 modified, 2 created, 2 deleted)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/item.ts` | model | — | itself (extend existing interface) | exact |
| `src/stores/authStore.ts` | store | request-response | `src/stores/listsStore.ts` (renameList optimistic) | exact |
| `src/stores/uiStore.ts` | store | event-driven | itself (dismissBanner inverse) | exact |
| `src/stores/uiStore.test.ts` | test | — | `src/stores/authStore.test.ts` | exact |
| `src/components/AttributionBadge.tsx` | component | transform | itself (extend with avatarUrl prop) | exact |
| `src/components/AttributionBadge.test.tsx` | test | — | `src/components/SyncStatus.test.tsx` | role-match |
| `src/components/ItemRow.tsx` | component | transform | itself (extend attribution block lines 251-261) | exact |
| `src/components/Sidebar.tsx` | component | request-response | itself + `src/pages/ListPage.tsx` inline-rename lines 314-333 | exact |
| `src/components/AppShell.tsx` | component | — | itself (extend prop pass to Sidebar) | exact |
| `src/pages/ListPage.tsx` | page | CRUD | itself (remove + extend) | exact |
| `src/components/AddItemBar.tsx` | component | CRUD | itself (prop change only) | exact |
| `src/components/NamePromptDialog.tsx` + test | component | — | DELETE — no analog needed | deleted |

---

## Pattern Assignments

### `src/types/item.ts` (model, extend)

**Analog:** itself

**Current interface** (lines 1-14):
```typescript
export interface Item {
  id: string
  list_id: string
  name: string
  quantity: string | null
  category: string | null
  checked: boolean
  added_by: string | null
  created_at: string
}
```

**Change:** Add `user_id: string | null` after `added_by`. The DB column exists (`items_auth.sql: uuid DEFAULT auth.uid()`), `fetchItems` uses `select('*')` so the value already arrives — only the type is missing.

```typescript
// ADD this field (D-05):
user_id: string | null
```

---

### `src/stores/authStore.ts` (store, request-response)

**Analog:** `src/stores/listsStore.ts` — `renameList` optimistic update pattern (lines 83-111)

**Existing interface block** (lines 5-13):
```typescript
export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
  initialize: () => () => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}
```

**Optimistic update pattern from listsStore** (lines 83-111):
```typescript
// 1. Snapshot BEFORE set() (prevents reading stale state from callback)
const prev = get().lists.find((l) => l.id === id)
if (!prev) return

// 2. Optimistic write
set((state) => ({
  lists: state.lists.map((l) => (l.id === id ? { ...l, name: trimmed } : l)),
}))

// 3. Await server call
const { error } = await supabase.from('lists').update({ name: trimmed }).eq('id', id)

// 4. Rollback on error
if (error) {
  set((state) => ({
    lists: state.lists.map((l) => (l.id === id ? prev : l)),
    error: 'Failed to rename list',
  }))
}
```

**New `updateDisplayName` action to add** (D-03):
```typescript
// ADD to AuthState interface:
updateDisplayName: (name: string) => Promise<void>

// ADD to store implementation:
updateDisplayName: async (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return

  // Optimistic update — USER_UPDATED will fire and repeat this set idempotently
  set((state) => ({
    user: state.user
      ? { ...state.user, user_metadata: { ...state.user.user_metadata, display_name: trimmed } }
      : null,
    error: null,
  }))

  const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } })
  if (error) {
    // Rollback: re-fetch from server
    const { data: { user } } = await supabase.auth.getUser()
    set({ user, error: error.message })
  }
},
```

**Critical constraint:** Do NOT call `updateDisplayName` inside `onAuthStateChange` — creates infinite USER_UPDATED loop. The existing `onAuthStateChange` callback (lines 26-44) must stay sync and must NOT be modified to call `updateDisplayName`.

---

### `src/stores/uiStore.ts` (store, event-driven)

**Analog:** itself — `dismissBanner` (lines 10-13) is the direct inverse

**Current full file** (lines 1-14):
```typescript
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
```

**Change — add `restoreBanner` action** (D-11):
```typescript
// ADD to UIState interface:
restoreBanner: (listCode: string) => void

// ADD to store (inverse of dismissBanner — new Set reference required for Zustand reactivity):
restoreBanner: (listCode) =>
  set((state) => {
    const next = new Set(state.dismissedBanners)
    next.delete(listCode)
    return { dismissedBanners: next }
  }),
```

**Key:** Must create a new Set (`new Set(state.dismissedBanners)` then `.delete()`) — mutating in place produces same reference = no re-render. Same discipline as `dismissBanner` uses spread.

---

### `src/stores/uiStore.test.ts` (test — NEW FILE)

**Analog:** `src/stores/authStore.test.ts` (lines 1-173)

**Setup pattern** (authStore.test.ts lines 1-52):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

// vi.hoisted() — mocks available inside vi.mock() factory
const { mockXxx } = vi.hoisted(() => { ... })

vi.mock('@/lib/supabase', () => ({ supabase: { ... } }))

describe('authStore — actionName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ /* reset to known state */ })
  })

  it('describes behavior (REQ-ID)', () => {
    // arrange, act, assert
  })
})
```

**uiStore.test.ts does NOT need supabase mock** — uiStore has no async calls. Template:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './uiStore'

describe('uiStore — dismissBanner', () => {
  beforeEach(() => {
    useUIStore.setState({ dismissedBanners: new Set() })
  })
  // test dismissBanner existing behavior
})

describe('uiStore — restoreBanner', () => {
  beforeEach(() => {
    useUIStore.setState({ dismissedBanners: new Set(['abc123']) })
  })

  it('removes the code from dismissedBanners (NAV-03)', () => {
    useUIStore.getState().restoreBanner('abc123')
    expect(useUIStore.getState().dismissedBanners.has('abc123')).toBe(false)
  })

  it('returns a new Set reference (triggers Zustand reactivity)', () => {
    const before = useUIStore.getState().dismissedBanners
    useUIStore.getState().restoreBanner('abc123')
    const after = useUIStore.getState().dismissedBanners
    expect(after).not.toBe(before)
  })

  it('does not throw when restoring a code not in the Set', () => {
    expect(() => useUIStore.getState().restoreBanner('not-there')).not.toThrow()
  })
})
```

---

### `src/components/AttributionBadge.tsx` (component, transform)

**Analog:** itself — extend the existing 29-line component

**Current full file** (lines 1-29):
```typescript
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
      style={{ backgroundColor: color.bg, color: color.text }}
      aria-label={`${name} added this`}
    >
      {getInitials(name)}
    </div>
  )
}
```

**Changes required** (D-07):
1. Add `import { useState } from 'react'`
2. Add `avatarUrl?: string` to interface
3. Add `[imgError, setImgError]` state
4. Conditionally render `<img>` or initials
5. Apply `style` only when NOT showing image (avoids tinting the avatar)
6. Add `overflow-hidden` to container class (clips circular img)

```typescript
// Updated component shape:
import { useState } from 'react'
import { getAttributionColor, getInitials } from '@/lib/attribution'
import { cn } from '@/lib/utils'

interface AttributionBadgeProps {
  name: string
  avatarUrl?: string   // NEW (D-07)
  className?: string
}

export function AttributionBadge({ name, avatarUrl, className }: AttributionBadgeProps) {
  const [imgError, setImgError] = useState(false)
  const color = getAttributionColor(name)
  const showImg = avatarUrl && !imgError   // guard: onError never fires for empty src

  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden',
        className
      )}
      style={!showImg ? { backgroundColor: color.bg, color: color.text } : undefined}
      aria-label={`${name} added this`}
    >
      {showImg ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover rounded-full"
          referrerPolicy="no-referrer"   // REQUIRED — Google CDN returns 403 without this
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}
```

---

### `src/components/AttributionBadge.test.tsx` (test — NEW FILE)

**Analog:** `src/components/SyncStatus.test.tsx` (lines 1-44) — simple component test with store mock via `vi.mock`

**SyncStatus.test.tsx setup pattern** (lines 1-11):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatus } from './SyncStatus'
import { useItemsStore } from '@/stores/itemsStore'

vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: vi.fn((selector) => selector({ syncStatus: 'live' })),
}))
```

**AttributionBadge.test.tsx has no store dep** — simpler than SyncStatus. Key cases:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AttributionBadge } from './AttributionBadge'

describe('AttributionBadge', () => {
  it('renders initials when no avatarUrl (PROF-02 fallback)', () => { ... })
  it('renders <img> with referrerPolicy="no-referrer" when avatarUrl present (PROF-02)', () => { ... })
  it('falls back to initials when img fires onError (PROF-02)', () => {
    const { container } = render(<AttributionBadge name="Alice" avatarUrl="https://bad.url" />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('A')).toBeInTheDocument()  // or whatever getInitials returns
  })
  it('sets aria-label to "{name} added this" (accessibility)', () => { ... })
  it('does NOT render <img> when avatarUrl is undefined (onError guard)', () => { ... })
})
```

---

### `src/components/ItemRow.tsx` (component, transform)

**Analog:** itself — attribution block at lines 251-261

**Current attribution block** (lines 251-261):
```typescript
{/* Attribution badge (position unchanged per D-02) */}
{item.added_by ? (
  <AttributionBadge name={item.added_by} />
) : (
  <div
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
    aria-label="Unknown person added this"
  >
    ?
  </div>
)}
```

**New props to add** (D-06, per RESEARCH.md open question recommendation — prop-passing keeps ItemRow store-independent):
```typescript
interface ItemRowProps {
  // ... existing props unchanged ...
  currentUserId?: string | null        // NEW
  currentUserDisplayName?: string      // NEW
  currentUserAvatarUrl?: string | null // NEW
}
```

**Attribution resolution logic to replace lines 251-261** (D-06):
```typescript
// Derive inside display-mode render:
const isOwnItem = item.user_id != null && item.user_id === currentUserId

// Replace the attribution block:
{isOwnItem ? (
  <AttributionBadge
    name={currentUserDisplayName ?? item.added_by ?? '?'}
    avatarUrl={currentUserAvatarUrl ?? undefined}
  />
) : item.added_by ? (
  <AttributionBadge name={item.added_by} />
) : (
  <div
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
    aria-label="Unknown person added this"
  >
    ?
  </div>
)}
```

**`baseItem` in ItemRow.test.tsx** (line 72-81) must gain `user_id: null` after the type is updated — existing tests won't compile otherwise:
```typescript
const baseItem: Item = {
  // ...existing fields...
  user_id: null,  // ADD this
}
```

---

### `src/components/Sidebar.tsx` (component, request-response)

**Analog:** itself + `ListPage.tsx` inline-rename pattern (lines 314-333)

**Existing prop pattern** (lines 8-13):
```typescript
interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: List[]
  finalFocus?: React.RefObject<HTMLButtonElement>
}
```

**Change — add `user` prop** (D-08):
```typescript
import type { User } from '@supabase/supabase-js'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: List[]
  user: User | null   // NEW
  finalFocus?: React.RefObject<HTMLButtonElement>
}
```

**Profile slot** (line 82 — currently empty div):
```typescript
{/* Phase 9: profile section — fills data-slot="profile-slot" */}
<div data-slot="profile-slot" className="mt-auto border-t border-sidebar-border p-4">
  {user && <ProfileSection user={user} onOpenChange={onOpenChange} />}
</div>
```

**Inline-rename pattern from ListPage.tsx** (lines 314-333) — copy for display-name edit:
```typescript
// Local state (ephemeral UI — do not put in Zustand)
const [editOpen, setEditOpen] = useState(false)
const [editName, setEditName] = useState('')

// Display name resolver (must handle first-session: display_name may be absent)
function resolveDisplayName(user: User): string {
  return (
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'
  )
}

// Open edit: seed input from current resolved name
function handleEditOpen() {
  setEditName(resolveDisplayName(user))
  setEditOpen(true)
}

async function handleSave() {
  await useAuthStore.getState().updateDisplayName(editName)
  setEditOpen(false)
}

// JSX mirrors ListPage rename pattern:
{editOpen ? (
  <div className="flex items-center gap-2">
    <Input
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') setEditOpen(false)
      }}
      aria-label="Edit display name"
      autoFocus
      className="h-8 text-sm flex-1"
    />
    <Button variant="outline" size="sm" onClick={handleSave}>Save</Button>
    <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
  </div>
) : (
  <div className="flex items-center gap-2">
    <span className="flex-1 truncate text-sm">{resolveDisplayName(user)}</span>
    <Button variant="ghost" size="icon" aria-label="Edit display name" onClick={handleEditOpen}>
      <Pencil className="h-4 w-4" />
    </Button>
  </div>
)}
```

**Sign-out handler** (D-09) — close drawer FIRST, then sign out:
```typescript
async function handleSignOut() {
  onOpenChange(false)               // Close drawer immediately (prevents open drawer over login)
  await useAuthStore.getState().signOut()   // ProtectedRoute watches user → redirects to /
}
```

**Sign-out button** — minimum 44px tap target:
```typescript
<Button
  variant="ghost"
  className="mt-2 w-full min-h-[44px] justify-start text-sm text-muted-foreground"
  onClick={handleSignOut}
>
  Sign out
</Button>
```

**Avatar render** — same `<img>` + fallback pattern as AttributionBadge but larger (sidebar profile):
```typescript
const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null
const [avatarError, setAvatarError] = useState(false)

{avatarUrl && !avatarError ? (
  <img
    src={avatarUrl}
    alt={resolveDisplayName(user)}
    className="h-10 w-10 rounded-full object-cover shrink-0"
    referrerPolicy="no-referrer"
    onError={() => setAvatarError(true)}
  />
) : (
  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
    {resolveDisplayName(user).charAt(0).toUpperCase()}
  </div>
)}
```

---

### `src/components/AppShell.tsx` (component, prop pass)

**Analog:** itself — already reads `user` from `authStore` (line 12), already passes `lists` to `<Sidebar>` (line 31)

**Current Sidebar render** (line 31):
```typescript
<Sidebar open={open} onOpenChange={setOpen} lists={lists} finalFocus={triggerRef} />
```

**Change — add `user` prop** (D-08):
```typescript
<Sidebar open={open} onOpenChange={setOpen} lists={lists} user={user} finalFocus={triggerRef} />
```

No other changes. `user` is already in scope at line 12: `const user = useAuthStore((state) => state.user)`.

---

### `src/pages/ListPage.tsx` (page, CRUD)

**Analog:** itself — multiple targeted changes

**1. Remove `NamePromptDialog` (D-10) — exact callsites:**
- Line 12: remove `import { NamePromptDialog } from '@/components/NamePromptDialog'`
- Line 45: remove `const [userName, setUserName] = useState<string | null>(null)`
- Lines 128-131: remove localStorage read block
- Lines 293-298: remove `{userName === null && (<NamePromptDialog ... />)}`

**2. Replace `AddItemBar` invocation** (D-10) — lines 368-372:
```typescript
// REMOVE:
<AddItemBar listId={list.id} addedBy={userName || ''} disabled={userName === null} />

// REPLACE WITH (user is always non-null on ProtectedRoute page):
<AddItemBar listId={list.id} addedBy={resolveDisplayName(user!)} />
```

**3. Add `resolveDisplayName` helper** (reusable across ListPage + Sidebar):
```typescript
// Can be defined locally or extracted to src/lib/auth.ts
function resolveDisplayName(user: User): string {
  return (
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'
  )
}
```

**4. Add `restoreBanner` to uiStore selectors** (D-11) — after the existing `dismissBanner` line 41:
```typescript
const restoreBanner = useUIStore((state) => state.restoreBanner)
```

**5. Add Share2 re-expand affordance** (D-11) — in the header row, co-located near `<SyncStatus />` at line 361. Place BEFORE `<SyncStatus />`:
```typescript
import { Menu, Pencil, Trash2, Share2 } from 'lucide-react'

// In header JSX, before <SyncStatus />:
{dismissedBanners.has(list.share_code) && (
  <Button
    variant="ghost"
    size="icon"
    aria-label="Show share code"
    onClick={() => restoreBanner(list.share_code)}
    className="h-8 w-8 shrink-0"
  >
    <Share2 className="h-4 w-4" />
  </Button>
)}
<SyncStatus />
```

**6. Pass current-user props to ItemRow** (D-06) — via the CategorySection → ItemRow chain. Find the `<CategorySection>` render and thread currentUserId/currentUserDisplayName/currentUserAvatarUrl. Pattern mirrors how `listId` is passed today:
```typescript
const currentUserDisplayName = user ? resolveDisplayName(user) : undefined
const currentUserAvatarUrl = user
  ? (user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null)
  : null

// Pass to CategorySection (which passes to ItemRow):
<CategorySection
  // ...existing props...
  currentUserId={user?.id ?? null}
  currentUserDisplayName={currentUserDisplayName}
  currentUserAvatarUrl={currentUserAvatarUrl}
/>
```

---

### `src/components/AddItemBar.tsx` (component, CRUD)

**Analog:** itself — prop interface change only (D-10)

**Current interface** (lines 18-26):
```typescript
interface AddItemBarProps {
  listId: string
  addedBy: string
  disabled?: boolean   // REMOVE this prop (no longer needed post D-10)
}
```

**Change:**
- Remove `disabled?: boolean` from interface
- Remove `isInert = submitting || disabled` logic (line 120) → replace with `const isInert = submitting`
- Remove `disabled={isInert}` from the submit button (or keep the submitting-based disable)

The `addedBy` prop stays — its value changes at the call site (ListPage), not here.

---

### DELETE: `src/components/NamePromptDialog.tsx` + `NamePromptDialog.test.tsx`

**No analog needed.** Both files are retired per D-10. Delete together in the same commit (Pitfall 7 — CI breaks if test file imports deleted component).

**Verify no other consumers before deleting:**
```bash
# Confirm only ListPage imports NamePromptDialog:
grep -r "NamePromptDialog" src/
# Expected: only ListPage.tsx (line 12) and NamePromptDialog.test.tsx
```

---

## Shared Patterns

### Display Name Resolution
**Source:** `src/pages/ListPage.tsx` + RESEARCH.md §Code Examples §1
**Apply to:** `ListPage.tsx`, `Sidebar.tsx` (anywhere the auth display name is needed)
**Extract to:** Consider `src/lib/auth.ts` as a shared util to avoid duplication
```typescript
function resolveDisplayName(user: User): string {
  return (
    user.user_metadata?.display_name ??   // User-edited (D-03)
    user.user_metadata?.full_name ??       // Google-provided
    user.user_metadata?.name ??            // Google alt field
    user.email?.split('@')[0] ??           // Email local-part
    'User'
  )
}

function resolveAvatarUrl(user: User): string | null {
  return user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null
}
```

### Optimistic Update + Rollback
**Source:** `src/stores/listsStore.ts` lines 83-111 (renameList)
**Apply to:** `authStore.updateDisplayName`
Pattern: snapshot prev → optimistic set → await server → rollback on error.

### Zustand Set with New Set Reference
**Source:** `src/stores/uiStore.ts` lines 10-13 (dismissBanner)
**Apply to:** `uiStore.restoreBanner`
Always create new Set reference — Zustand shallow equality; mutable in-place mutation = no re-render.

### Component Test Structure (no store dep)
**Source:** `src/components/SyncStatus.test.tsx` lines 1-44
**Apply to:** `AttributionBadge.test.tsx`
Pattern: `describe` → `beforeEach(vi.clearAllMocks)` → `it('describes behavior (REQ-ID)')`. No async needed for pure component render tests.

### Store Test Structure (with supabase mock)
**Source:** `src/stores/authStore.test.ts` lines 1-173
**Apply to:** `authStore.test.ts` (add new `updateDisplayName` cases)
Pattern: `vi.hoisted()` to capture mocks → `vi.mock('@/lib/supabase', ...)` → `describe` per action → `beforeEach` resets `useXxxStore.setState(...)`.

### Inline Edit UI (ephemeral state)
**Source:** `src/pages/ListPage.tsx` lines 56-57 (rename state) + lines 314-333 (JSX)
**Apply to:** `Sidebar.tsx` profile section display-name edit
Pattern: `const [editOpen, setEditOpen] = useState(false)` + `const [editName, setEditName] = useState('')` → Input + Save/Cancel buttons → on Save call async store action → close edit mode.

### Google Avatar `<img>` with Fallback
**Source:** RESEARCH.md §Pattern 3 + §Pitfall 1
**Apply to:** `AttributionBadge.tsx`, `Sidebar.tsx` profile avatar
Critical: `referrerPolicy="no-referrer"` on every Google avatar img. Guard render with `avatarUrl && !imgError`. `onError={() => setImgError(true)}`.

### Prop-Driven Components (shell passes data down)
**Source:** `src/components/AppShell.tsx` lines 12-31 (user + lists → Sidebar)
**Apply to:** `AppShell.tsx` → `Sidebar.tsx` (`user` prop); `ListPage.tsx` → `ItemRow.tsx` (current-user props)
Pattern: shell/page reads from store; passes as props to child. Child stays store-independent (testable without store mocks).

---

## No Analog Found

All files have a close codebase analog. No entries.

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/pages/`, `src/types/`
**Files scanned:** 13 source files read directly
**Pattern extraction date:** 2026-05-29
