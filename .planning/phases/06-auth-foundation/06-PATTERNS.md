# Phase 6: Auth Foundation - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/authStore.ts` | store | request-response | `src/stores/itemsStore.ts` | exact |
| `src/stores/authStore.test.ts` | test | request-response | `src/stores/itemsStore.test.ts` | exact |
| `src/components/auth/ProtectedRoute.tsx` | component | request-response | `src/pages/ListPage.tsx` (useNavigate + useParams pattern) | role-match |
| `src/components/auth/ProtectedRoute.test.tsx` | test | request-response | `src/pages/ListPage.test.tsx` | role-match |
| `src/components/auth/LoginPage.tsx` | component | request-response | `src/pages/LandingPage.tsx` | role-match |
| `src/pages/LandingPage.tsx` | page (MODIFY) | request-response | `src/pages/LandingPage.tsx` (self) | self |
| `src/App.tsx` | app shell (MODIFY) | event-driven | `src/pages/ListPage.tsx` (useEffect lifecycle) | partial |
| `src/router.tsx` | config (MODIFY) | request-response | `src/router.tsx` (self) | self |
| `src/lib/supabase.ts` | config (MODIFY) | request-response | `src/lib/supabase.ts` (self) | self |
| `supabase/migrations/items_auth.sql` | migration | CRUD | existing Phase 1 SQL (referenced in RESEARCH.md Pattern 7) | no-file-analog |
| `supabase/migrations/lists_auth.sql` | migration | CRUD | existing Phase 1 SQL (referenced in RESEARCH.md Pattern 8) | no-file-analog |

---

## Pattern Assignments

### `src/stores/authStore.ts` (store, request-response)

**Analog:** `src/stores/itemsStore.ts`

**Imports pattern** (lines 1-5 of itemsStore.ts):
```typescript
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
```
Extend with Supabase auth types:
```typescript
import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
```

**Store shape pattern** (lines 18-50 of itemsStore.ts):
```typescript
interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
  syncStatus: 'connecting' | 'live' | 'reconnecting'
  channel: RealtimeChannel | null
  // ... actions
}

export const useItemsStore = create<ItemsState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,
  syncStatus: 'connecting',
  channel: null,
  // ... action implementations
}))
```
For authStore, same `create<AuthState>()((set) => ({...}))` shape:
```typescript
interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
  initialize: () => () => void  // returns unsubscribe cleanup
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  isLoading: true,  // true on start — resolved by INITIAL_SESSION
  error: null,
  // ... actions
}))
```

**Error handling pattern** — copy from every action in itemsStore.ts (e.g., lines 102-110):
```typescript
if (error) {
  set({ error: 'Failed to add item' })
}
```
For authStore actions:
```typescript
if (error) set({ error: error.message })
```

**Action returning cleanup** — use `initialize()` to set up `onAuthStateChange` and return unsubscribe. The callback must be synchronous (STATE.md locked decision). Pattern from RESEARCH.md Pattern 1:
```typescript
initialize: () => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      set({
        user: session?.user ?? null,
        session: session,
        isLoading: false,
        error: null,
      })
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      } else {
        supabase.realtime.setAuth(null)
      }
    }
  )
  return () => subscription.unsubscribe()
},
```

---

### `src/stores/authStore.test.ts` (test, request-response)

**Analog:** `src/stores/itemsStore.test.ts`

**Mock setup pattern** (lines 1-98 of itemsStore.test.ts):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useItemsStore } from './itemsStore'

// vi.hoisted() for mocks needed inside vi.mock() factory
const { mockChannelSubscribe, ... } = vi.hoisted(() => {
  // define mocks here
  return { ... }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (_table: string) => createMockFrom(),
    channel: vi.fn().mockReturnValue({ on: mockChannelOn, subscribe: mockChannelSubscribe }),
    removeChannel: mockRemoveChannel,
  },
}))
```
For authStore.test.ts, mock the auth namespace:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

const { mockOnAuthStateChange, mockSignInWithOAuth, mockSignOut, captureCallback } =
  vi.hoisted(() => {
    let _capturedCb: ((event: string, session: unknown) => void) | null = null
    return {
      mockOnAuthStateChange: vi.fn().mockImplementation((cb) => {
        _capturedCb = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      mockSignInWithOAuth: vi.fn(),
      mockSignOut: vi.fn(),
      captureCallback: () => _capturedCb,
    }
  })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
    realtime: { setAuth: vi.fn() },
  },
}))
```

**beforeEach reset pattern** (lines 101-127 of itemsStore.test.ts):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  useItemsStore.setState({
    items: [...],
    loading: false,
    error: null,
    // ...
  })
})
```
For authStore:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  })
})
```

---

### `src/components/auth/ProtectedRoute.tsx` (component, request-response)

**Analog:** `src/pages/ListPage.tsx` (useNavigate + loading-state guard pattern, lines 1-60)

**Imports pattern** — React Router + store:
```typescript
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
```

**Loading guard pattern** — copy from ListPage.tsx (lines 29-60) where it shows a loading state before data resolves. Also copy Tailwind centering from LandingPage.tsx (line 6):
```typescript
if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}
```

**Redirect pattern** — if not authenticated, store return path in sessionStorage, then Navigate:
```typescript
if (!user) {
  sessionStorage.setItem('returnTo', location.pathname + location.search)
  return <Navigate to="/" replace />
}

return <Outlet />
```

**Zustand selector pattern** — copy from SyncStatus.tsx (lines 9-10) or ListPage.tsx (lines 47-54) — one selector per value:
```typescript
const user = useAuthStore((state) => state.user)
const isLoading = useAuthStore((state) => state.isLoading)
const location = useLocation()
```

---

### `src/components/auth/ProtectedRoute.test.tsx` (test, request-response)

**Analog:** `src/pages/ListPage.test.tsx`

**MemoryRouter render helper pattern** (lines 92-101 of ListPage.test.tsx):
```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/list/:code" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/" element={<div>Home (Login)</div>} />
      </Routes>
    </MemoryRouter>
  )
}
```

**Store mock via setState pattern** (lines 185-186 of ListPage.test.tsx):
```typescript
// Inject auth state directly — no need to mock the store
useAuthStore.setState({ user: null, session: null, isLoading: false, error: null })
```

**vi.mock for supabase** — same pattern as other test files (lines 44-90 of ListPage.test.tsx), but only the auth + realtime namespaces need to be mocked for ProtectedRoute since it reads from the store (no direct supabase calls).

---

### `src/components/auth/LoginPage.tsx` (component, request-response)

**Analog:** `src/pages/LandingPage.tsx`

**Page layout pattern** (lines 4-19 of LandingPage.tsx):
```typescript
export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Our Cart</h1>
      {/* content */}
    </main>
  )
}
```
For LoginPage:
```typescript
export default function LoginPage({ onSignIn }: { onSignIn: () => Promise<void> }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Our Cart</h1>
      {/* Google sign-in button */}
    </main>
  )
}
```

**Button pattern** — use `src/components/ui/button.tsx` (lines 43-56):
```typescript
import { Button } from '@/components/ui/button'

<Button onClick={onSignIn} size="lg">
  Sign in with Google
</Button>
```

**Error display pattern** — copy from CreateListForm (which renders inline error text below the form, CreateListForm.test.tsx line 77-98 shows the expected pattern). Surface `error` from authStore as inline text with a retry affordance via the button.

---

### `src/pages/LandingPage.tsx` (page, MODIFY)

**Analog:** Self — existing file at `src/pages/LandingPage.tsx` (lines 1-20)

**Current structure to preserve** (lines 1-20):
```typescript
import CreateListForm from '@/components/CreateListForm'
import JoinListForm from '@/components/JoinListForm'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-3xl font-bold">Our Cart</h1>
      <section className="flex flex-col items-center gap-4 w-full max-w-sm">
        <h2 className="text-xl font-semibold">Create a list</h2>
        <CreateListForm />
      </section>
      <section className="flex flex-col items-center gap-4 w-full max-w-sm">
        <h2 className="text-xl font-semibold">Join a list</h2>
        <JoinListForm />
      </section>
    </main>
  )
}
```

**Auth-conditional render to add** — wrap with auth check, copy loading spinner pattern from RESEARCH.md Pattern 5 and return-to-URL pattern from RESEARCH.md Pattern 6. Add imports:
```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LoginPage from '@/components/auth/LoginPage'
```
Then at the top of the component body:
```typescript
const user = useAuthStore((state) => state.user)
const isLoading = useAuthStore((state) => state.isLoading)
const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
const navigate = useNavigate()

// Return-to-URL: navigate to stored path after sign-in
useEffect(() => {
  if (user) {
    const returnTo = sessionStorage.getItem('returnTo')
    if (returnTo && returnTo !== '/') {
      sessionStorage.removeItem('returnTo')
      navigate(returnTo, { replace: true })
    }
  }
}, [user, navigate])

if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}

if (!user) {
  return <LoginPage onSignIn={signInWithGoogle} />
}
// ... existing JSX unchanged below
```

---

### `src/App.tsx` (app shell, MODIFY)

**Analog:** Self — existing file at `src/App.tsx` (lines 1-6)

**Current structure** (lines 1-6):
```typescript
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'

export default function App() {
  return <RouterProvider router={router} />
}
```

**Auth initialization to add** — copy `useEffect` lifecycle pattern from `src/pages/ListPage.tsx` (lines 60+, where it uses useEffect for mount-time initialization with cleanup). Specifically:
```typescript
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useAuthStore } from '@/stores/authStore'

export default function App() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    const cleanup = initialize()
    return cleanup
  }, [initialize])

  return <RouterProvider router={router} />
}
```
The `useEffect` cleanup return mirrors the unsubscribe pattern in ListPage.tsx (lines 60+ where subscribeToList cleanup is returned from useEffect).

---

### `src/router.tsx` (config, MODIFY)

**Analog:** Self — existing file at `src/router.tsx` (lines 1-10)

**Current structure** (lines 1-10):
```typescript
import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import ListPage from '@/pages/ListPage'
import NotFoundPage from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/list/:code', element: <ListPage /> },
  { path: '*', element: <NotFoundPage /> },
])
```

**ProtectedRoute wrapper to add** — wrap the `/list/:code` route using React Router's layout route pattern (element with `<Outlet />`):
```typescript
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

---

### `src/lib/supabase.ts` (config, MODIFY)

**Analog:** Self — existing file at `src/lib/supabase.ts` (lines 1-14)

**Current structure** (lines 1-14):
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    worker: true,
  },
})
```

**Auth config to add** — extend the `createClient` options object. Keep `realtime.worker: true` unchanged; add `auth` block:
```typescript
export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    worker: true,
  },
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
})
```
This is additive — no existing options removed.

---

## Shared Patterns

### Zustand Selector Pattern
**Source:** `src/components/SyncStatus.tsx` line 9, `src/pages/ListPage.tsx` lines 47-54
**Apply to:** `authStore.ts`, `ProtectedRoute.tsx`, `LoginPage.tsx`, `LandingPage.tsx` (modified)
```typescript
// One selector per value — avoids over-subscription and unnecessary re-renders
const user = useAuthStore((state) => state.user)
const isLoading = useAuthStore((state) => state.isLoading)
```

### Loading Spinner Pattern
**Source:** LandingPage layout (lines 5-8 of `src/pages/LandingPage.tsx`) + Tailwind centering
**Apply to:** `ProtectedRoute.tsx`, `LandingPage.tsx` (modified)
```typescript
<div className="min-h-screen flex items-center justify-center">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
</div>
```

### Supabase Mock in Tests
**Source:** `src/stores/itemsStore.test.ts` lines 89-98, `src/pages/ListPage.test.tsx` lines 44-90
**Apply to:** `authStore.test.ts`, `ProtectedRoute.test.tsx`
```typescript
vi.mock('@/lib/supabase', () => ({
  supabase: {
    // Only mock the namespaces you use — auth tests only need auth + realtime
    auth: { ... },
    realtime: { setAuth: vi.fn() },
  },
}))
```

### vi.hoisted for Captured Callbacks
**Source:** `src/stores/itemsStore.test.ts` lines 67-84
**Apply to:** `authStore.test.ts` (capturing the `onAuthStateChange` callback for test-time triggering)
```typescript
const { captureCallback } = vi.hoisted(() => {
  let _cb: unknown = null
  return {
    captureCallback: () => _cb,
    // The mock sets _cb when called:
    mockOnAuthStateChange: vi.fn().mockImplementation((cb) => {
      _cb = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  }
})
```

### useEffect Cleanup Return
**Source:** `src/pages/ListPage.tsx` (useEffect with subscribeToList/unsubscribe cleanup)
**Apply to:** `src/App.tsx` (modified) — returning the cleanup function from `initialize()`
```typescript
useEffect(() => {
  const cleanup = initialize()
  return cleanup      // unsubscribes onAuthStateChange listener on unmount
}, [initialize])
```

### Path Alias Imports
**Source:** All existing source files (e.g., `src/stores/itemsStore.ts` line 3, `src/pages/ListPage.tsx` line 3)
**Apply to:** All new files
```typescript
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/migrations/items_auth.sql` | migration | CRUD | No SQL migration files exist in the codebase yet — Phase 1 SQL was run directly in Supabase Dashboard. RESEARCH.md Patterns 7 and 8 are the reference. |
| `supabase/migrations/lists_auth.sql` | migration | CRUD | Same as above. |

For the SQL migrations, use RESEARCH.md Patterns 7 and 8 directly. Key rules to copy:
- Always `DROP POLICY IF EXISTS` before `CREATE POLICY` (avoid conflicts)
- Use `(select auth.uid())` not bare `auth.uid()` (query planner caching)
- Policy pattern: `user_id IS NULL OR (select auth.uid()) = user_id`
- RLS is already enabled on both tables — do NOT re-run `ENABLE ROW LEVEL SECURITY`

---

## Metadata

**Analog search scope:** `src/stores/`, `src/pages/`, `src/components/`, `src/lib/`, `src/`
**Files scanned:** 14 source files read in full
**Pattern extraction date:** 2026-05-27
