# Phase 8: App Shell & Sidebar - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/AppShell.tsx` | layout component | request-response (Outlet + store fetch) | `src/components/auth/ProtectedRoute.tsx` | role-match (both are pathless layout wrappers rendering `<Outlet/>`) |
| `src/components/Sidebar.tsx` | component | event-driven (open/close) + CRUD (read lists) | `src/components/ui/dialog.tsx` | role-match (same Base UI Dialog primitive; drawer is a re-skinned dialog) |
| `src/router.tsx` (modify) | config | request-response | `src/router.tsx` itself | exact (adding one nested pathless route entry) |
| `src/pages/ListPage.tsx` (modify) | page | request-response | `src/pages/ListPage.tsx` itself | exact (extending existing header row) |
| `src/components/AppShell.test.tsx` | test | — | `src/components/auth/ProtectedRoute.test.tsx` | exact (same pattern: MemoryRouter + useAuthStore.setState + vi.mock supabase) |
| `src/components/Sidebar.test.tsx` | test | — | `src/components/auth/ProtectedRoute.test.tsx` + `src/stores/listsStore.test.ts` | role-match (component test with store mock + store state injection) |
| `src/router.test.tsx` | test | — | `src/components/auth/ProtectedRoute.test.tsx` | partial-match (router render pattern, no direct existing router test) |

---

## Pattern Assignments

### `src/components/AppShell.tsx` (layout component, request-response)

**Analog:** `src/components/auth/ProtectedRoute.tsx`

**Imports pattern** (`src/components/auth/ProtectedRoute.tsx` lines 1-2):
```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
```
AppShell replaces `Navigate`/`useLocation` with `useState`/`useEffect`/`Menu` and adds `useListsStore`:
```tsx
import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'
import Sidebar from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
```

**Store selector pattern** (`src/components/auth/ProtectedRoute.tsx` lines 5-6 and `src/pages/LandingPage.tsx` lines 21-31):
```tsx
// Granular selectors — one value per selector (avoids unnecessary re-renders)
const user = useAuthStore((state) => state.user)
const isLoading = useAuthStore((state) => state.isLoading)
// For AppShell, also:
const lists = useListsStore((state) => state.lists)
const fetchLists = useListsStore((state) => state.fetchLists)
```

**fetchLists on mount pattern** (`src/pages/LandingPage.tsx` lines 57-61 — closest analog; AppShell adds the empty-guard from D-05):
```tsx
// LandingPage fetches unconditionally on mount:
useEffect(() => {
  if (user && fetchLists) {
    fetchLists(user.id)
  }
}, [user, fetchLists])

// AppShell D-05 adds lists.length === 0 guard to prevent refetch on list→list nav:
useEffect(() => {
  if (user && lists.length === 0) {
    fetchLists(user.id)
  }
}, [user]) // eslint-disable-line react-hooks/exhaustive-deps
```

**Outlet render pattern** (`src/components/auth/ProtectedRoute.tsx` line 24):
```tsx
return <Outlet />
// AppShell wraps this with the trigger + Sidebar:
return (
  <>
    <Sidebar open={open} onOpenChange={setOpen} lists={lists} />
    {/* hamburger trigger — see UI-SPEC Hamburger section */}
    <Outlet />
  </>
)
```

---

### `src/components/Sidebar.tsx` (component, event-driven + CRUD-read)

**Analog:** `src/components/ui/dialog.tsx`

**Imports pattern** (`src/components/ui/dialog.tsx` lines 1-8):
```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
```
Sidebar imports — use primitives directly (NOT the exported `DialogContent` wrapper):
```tsx
import { useRef } from 'react'
import { Link, useMatch, useNavigate } from 'react-router-dom'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { List } from '@/types/list'
```

**Backdrop animation pattern** (`src/components/ui/dialog.tsx` lines 31-38 — copy verbatim):
```tsx
<DialogPrimitive.Backdrop
  data-slot="dialog-overlay"
  className={cn(
    "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
    className
  )}
  {...props}
/>
```
For the sidebar backdrop, use `z-40` (one level below the popup `z-50`), otherwise copy this string verbatim.

**Popup pattern — centered (DO NOT copy these classes for the drawer)** (`src/components/ui/dialog.tsx` lines 53-57):
```tsx
// WRONG for drawer — these classes center the popup:
className={cn(
  "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 ...",
)}
```
**Replace with left-anchored positioning** (UI-SPEC Drawer container spec):
```tsx
<DialogPrimitive.Popup
  finalFocus={triggerRef}  // focus restoration — see RESEARCH Pitfall 6
  className={cn(
    // LEFT-ANCHORED — replaces -translate-x-1/2 -translate-y-1/2 centering
    'fixed inset-y-0 left-0 z-50',
    'h-dvh',                          // dvh avoids iOS Safari 100vh cutoff (RESEARCH Pitfall 5)
    'w-72 max-w-[80vw]',
    // Surface
    'bg-sidebar text-sidebar-foreground flex flex-col',
    'shadow-lg ring-1 ring-foreground/10',
    // Animation — data-open: / data-closed: boolean-attr syntax (NOT data-[state=open]:)
    'duration-200',
    'data-open:animate-in data-open:slide-in-from-left',
    'data-closed:animate-out data-closed:slide-out-to-left',
  )}
>
```

**Close button pattern** (`src/components/ui/dialog.tsx` lines 63-76 — copy size/render pattern):
```tsx
<DialogPrimitive.Close
  data-slot="dialog-close"
  render={
    <Button
      variant="ghost"
      className="absolute top-2 right-2"
      size="icon-sm"
    />
  }
>
  <XIcon />
  <span className="sr-only">Close</span>
</DialogPrimitive.Close>
```
Sidebar uses `DialogPrimitive.Close` with same `Button variant="ghost" size="icon-sm"` + `XIcon` + `sr-only` span.

**Dialog.Title pattern** (`src/components/ui/dialog.tsx` lines 121-130):
```tsx
<DialogPrimitive.Title
  data-slot="dialog-title"
  className={cn(
    "font-heading text-base leading-none font-medium",
    className
  )}
  {...props}
/>
```
Sidebar title uses `font-heading text-base font-semibold leading-none` (UI-SPEC specifies `font-semibold` not `font-medium`).

**Controlled Dialog.Root pattern** (verified from `src/pages/LandingPage.tsx` lines 205-211 and RESEARCH Code Examples):
```tsx
// LandingPage analog — controlled open/onOpenChange:
<Dialog
  open={deleteTarget !== null}
  onOpenChange={(open) => {
    if (!open) setDeleteTarget(null)
  }}
  disablePointerDismissal
>
// Sidebar uses same controlled pattern (without disablePointerDismissal — backdrop dismiss is desired):
<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
```

**Active-list match pattern** (RESEARCH Pitfall 3 — useMatch NOT useParams):
```tsx
// WRONG — useParams() in Sidebar (parent of :code route) returns {}:
// const { code } = useParams<{ code: string }>()

// CORRECT — useMatch resolves :code even from the parent route:
import { useMatch } from 'react-router-dom'
const match = useMatch('/list/:code')
const activeCode = match?.params.code ?? null
// Then per row:
const isActive = list.share_code === activeCode
```

**List row Link pattern** (`src/pages/LandingPage.tsx` lines 167-170 — styling reference):
```tsx
// LandingPage row (analog):
<Link
  to={`/list/${list.share_code}`}
  className="flex-1 py-3 text-sm font-normal truncate"
>
  {list.name}
</Link>
```
Sidebar row extends this with active state, full-width touch target, and close-on-click (D-08 + UI-SPEC):
```tsx
<Link
  key={list.id}
  to={`/list/${list.share_code}`}
  aria-current={isActive ? 'page' : undefined}
  onClick={() => onOpenChange(false)}
  className={cn(
    'flex items-center min-h-[48px] px-4 py-3 text-sm truncate transition-colors',
    'font-normal text-sidebar-foreground hover:bg-sidebar-accent',
    isActive && 'bg-sidebar-accent font-semibold',
  )}
>
  {list.name}
</Link>
```

**Empty/error state copy pattern** (`src/pages/LandingPage.tsx` lines 129-133):
```tsx
// LandingPage — reuse this exact tone/class pattern:
<p className="text-sm font-normal text-muted-foreground">No lists yet</p>
// Error:
<p className="text-sm text-destructive mt-2" role="alert">
  Could not load your lists. Please refresh.
</p>
```

---

### `src/router.tsx` (modify — add AppShell layout route)

**Analog:** `src/router.tsx` itself (lines 7-16)

**Current structure** (`src/router.tsx` lines 1-16):
```tsx
import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import ListPage from '@/pages/ListPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/list/:code', element: <ListPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```

**Target structure** — insert one `element: <AppShell />` pathless route between `ProtectedRoute` and `/list/:code`. Key rule: stay consistent with `element:` syntax throughout (NOT `Component:`) per RESEARCH Pattern 1 note:
```tsx
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,          // ← new pathless layout route
        children: [
          { path: '/list/:code', element: <ListPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```
Add `import AppShell from '@/components/AppShell'` alongside the other component imports.

---

### `src/pages/ListPage.tsx` (modify — add hamburger trigger to header)

**Analog:** `src/pages/ListPage.tsx` lines 299-349 (existing header row)

**Existing header row** (`src/pages/ListPage.tsx` lines 299-349):
```tsx
<div className="w-full max-w-md p-4">
  <div className="flex items-center justify-between gap-2">
    {/* Header: inline rename input (owner only) or list name + controls */}
    {isOwner && listRenameOpen ? (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* ... rename input ... */}
      </div>
    ) : (
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <h1 className="text-2xl font-semibold truncate">{displayName}</h1>
        {isOwner && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" aria-label={`Rename ${displayName}`} ...>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Delete ${displayName}`} ...>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    )}
    <SyncStatus />
  </div>
```

**Modification target** — hamburger trigger placed LEADING (left of `h1`) per UI-SPEC. The `onOpenSidebar` callback is passed from AppShell via props or React context. The `Button` variant/size pattern copies the existing icon buttons in this same row:
```tsx
// New import at top of ListPage:
import { Menu } from 'lucide-react'

// In header row — prepend the Menu button before the h1/rename block:
<div className="flex items-center gap-2">
  <Button
    ref={triggerRef}           // for focus restoration (RESEARCH Pitfall 6)
    variant="ghost"
    size="icon"
    aria-label="Open navigation"
    onClick={onOpenSidebar}
    className="h-8 w-8 shrink-0"
  >
    <Menu className="h-4 w-4" />
  </Button>
  {/* existing h1 + owner controls ... */}
</div>
```
Alternatively, AppShell renders the trigger as a `position: fixed` button (Option A from RESEARCH Pattern 4) — planner decides. The `Button variant="ghost" size="icon" h-8 w-8` class string is verbatim from the existing rename/delete buttons in this header.

---

### `src/components/AppShell.test.tsx` (test)

**Analog:** `src/components/auth/ProtectedRoute.test.tsx`

**Test file structure** (`src/components/auth/ProtectedRoute.test.tsx` lines 1-31):
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    realtime: { setAuth: vi.fn() },
  },
}))
```
AppShell test adds `useListsStore` mock alongside `useAuthStore`:
```tsx
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    // same shape as above
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    auth: { onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) },
    realtime: { setAuth: vi.fn() },
  },
}))
```

**Store state injection pattern** (`src/components/auth/ProtectedRoute.test.tsx` lines 35-43):
```tsx
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  })
})
```
AppShell test adds `useListsStore.setState` in beforeEach:
```tsx
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 'u1' } as never, isLoading: false, session: null, error: null })
  useListsStore.setState({ lists: [], loading: false, error: null })
})
```

**MemoryRouter render helper pattern** (`src/components/auth/ProtectedRoute.test.tsx` lines 20-31):
```tsx
function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/list/:code" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/" element={<div>Home (Login)</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
```
AppShell test nests AppShell inside ProtectedRoute to match actual router structure:
```tsx
function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/list/:code" element={<div>List Content</div>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
```

---

### `src/components/Sidebar.test.tsx` (test)

**Analogs:** `src/components/auth/ProtectedRoute.test.tsx` (component render pattern) + `src/stores/listsStore.test.ts` (vi.hoisted + Supabase mock chain pattern)

**vi.hoisted mock pattern** (`src/stores/listsStore.test.ts` lines 4-29 — use for Supabase mock in Sidebar test):
```tsx
const { mockFrom, mockSelect, mockEq, mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })
  const mockEq = vi.fn().mockReturnThis()
  const mockSelect = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
  })
  return { mockFrom, mockSelect, mockEq, mockOrder }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))
```
Sidebar test also needs to mock `react-router-dom` hooks:
```tsx
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useMatch: vi.fn(),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  }
})
```

**Store state injection for component test** (`src/components/auth/ProtectedRoute.test.tsx` lines 35-43 pattern applied to listsStore):
```tsx
import { useListsStore } from '@/stores/listsStore'

beforeEach(() => {
  vi.clearAllMocks()
  useListsStore.setState({ lists: [], loading: false, error: null })
})
```

**Portal content query pattern** (RESEARCH Validation Architecture note — Base UI Dialog portals to `document.body`):
```tsx
// Standard: getByRole('dialog') queries document.body automatically in Testing Library
const dialog = screen.getByRole('dialog')
// Or query within document.body for portalled elements:
const nav = document.body.querySelector('nav')
```

---

### `src/router.test.tsx` (new test — no existing analog)

**Closest analog:** `src/components/auth/ProtectedRoute.test.tsx` (render + route assertion pattern)

**Pattern to follow** — render the router with `MemoryRouter`/`createMemoryRouter` and assert AppShell appears in the tree for `/list/:code` routes. The `createBrowserRouter` import pattern from `src/router.tsx` lines 1-7 is the structural reference.

No existing `src/router.test.tsx` file exists in the codebase (confirmed via Glob). Build from scratch using `createMemoryRouter` (React Router v7 test-friendly alternative to `createBrowserRouter` which requires a real DOM history):
```tsx
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
// Import the routes array (not the router instance) from router.tsx, or
// reconstruct a minimal version with mocked page components.
```

---

## Shared Patterns

### Supabase Mock (apply to all test files)

**Source:** `src/components/auth/ProtectedRoute.test.tsx` lines 7-18
```tsx
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    realtime: { setAuth: vi.fn() },
  },
}))
```
AppShell and Sidebar tests also need `.from` on the mock (for listsStore.fetchLists). Use the `vi.hoisted` chain from `src/stores/listsStore.test.ts` lines 4-29 and merge with the auth mock shape.

**Apply to:** `AppShell.test.tsx`, `Sidebar.test.tsx`, `router.test.tsx`

---

### Store Selector Pattern (apply to all components that read stores)

**Source:** `src/components/auth/ProtectedRoute.tsx` lines 5-6 + `src/pages/LandingPage.tsx` lines 21-32
```tsx
// Granular selectors — one `useStore((state) => state.field)` per value
const user = useAuthStore((state) => state.user)
const isLoading = useAuthStore((state) => state.isLoading)
// NOT: const { user, isLoading } = useAuthStore() — triggers re-render on any state change
```
**Apply to:** `AppShell.tsx`, `Sidebar.tsx`

---

### Button/Icon pattern (ghost icon buttons, apply to hamburger trigger + close button)

**Source:** `src/pages/ListPage.tsx` lines 327-345
```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label={`Rename ${displayName}`}
  onClick={handleRenameOpen}
  className="h-8 w-8"
>
  <Pencil className="h-4 w-4" />
</Button>
```
Hamburger trigger: `variant="ghost" size="icon" className="h-8 w-8"` + `aria-label="Open navigation"` + `Menu className="h-4 w-4"`.
Close button: `variant="ghost" size="icon-sm"` (matching `dialog.tsx` line 69) + `XIcon` + `sr-only` span.

**Apply to:** `AppShell.tsx` (hamburger trigger) or `ListPage.tsx` (if trigger lives in header), `Sidebar.tsx` (close button)

---

### data-open / data-closed animation syntax (apply to Sidebar ONLY — NOT data-[state=open])

**Source:** `src/components/ui/dialog.tsx` line 34
```tsx
"... data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
```
This is Tailwind v4 boolean-attribute variant syntax matching Base UI's `data-open` (no value) attribute. Do NOT use `data-[state=open]:` (Radix/shadcn v3 style — does not match Base UI's attributes).

**Apply to:** `Sidebar.tsx` (both Backdrop and Popup className strings)

---

### cn() utility (apply to all new component files)

**Source:** every existing component file (`dialog.tsx` line 6, `LandingPage.tsx` via Button imports)
```tsx
import { cn } from '@/lib/utils'
```
**Apply to:** `AppShell.tsx`, `Sidebar.tsx`

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/`, `src/components/auth/`, `src/components/ui/`, `src/pages/`, `src/stores/`, `src/router.tsx`
**Files scanned:** 8 source files + 2 test files
**Pattern extraction date:** 2026-05-29
