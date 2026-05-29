# Phase 8: App Shell & Sidebar - Research

**Researched:** 2026-05-29
**Domain:** React Router v7 layout routes, Base UI Dialog primitive (left-anchored drawer), tw-animate-css slide animation, Zustand data loading, accessibility (ARIA, focus management)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `AppShell` mounted as a React Router **layout route** (renders `<Outlet/>`), wrapping `/list/:code`, nested under the existing `ProtectedRoute` element route. Repo is on **React Router v7** (`react-router-dom ^7.15.1`).
- **D-02:** Drawer built on `@base-ui/react` **Dialog primitive** — NOT a new library, NOT the centered `DialogContent`. New left-anchored `Sidebar` component; reuse focus-trap, Escape, backdrop, portal. Animate with `tw-animate-css` `data-open`/`data-closed` classes. Zero new dependencies.
- **D-03:** Sidebar open state is **local `useState` in `AppShell`** — NOT `uiStore`.
- **D-04:** Active list identified by matching `useParams().code` against `list.share_code`. Visual treatment + `aria-current="page"` on active row.
- **D-05:** `AppShell` calls `listsStore.fetchLists(user.id)` on mount when `lists` is empty.
- **D-06:** **One overlay drawer at all breakpoints** — no persistent desktop rail. Width constrained (e.g. `w-72`/`max-w-[80vw]`).
- **D-07:** LandingPage stays unchanged — no shell, no hamburger. Sidebar is only on `/list/:code`.
- **D-08:** List row tap: navigate to `/list/:share_code` + set open state to `false`.

### Claude's Discretion

- Hamburger icon placement in `ListPage` header (co-locate with name + `SyncStatus`, likely leading-left).
- Whether to extract a generic `Drawer`/`Sheet` wrapper vs. inline styles in `Sidebar`.
- Sidebar header/title text and zero-lists empty-state copy.
- Exact animation easing/duration — left-anchored slide-in expected.
- Whether hamburger/shell appears on `NotFoundPage` (answer per CONTEXT: no).

### Deferred Ideas (OUT OF SCOPE)

- Profile section in the shell (avatar, display name, sign out) — Phase 9.
- Re-expand dismissed share-code header (NAV-03) — Phase 9.
- Persistent desktop sidebar rail — explicitly rejected for Phase 8.
- Realtime sidebar updates across sessions/users — Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | User can open a slide-in sidebar showing all their lists | Base UI Dialog primitive left-anchored; `listsStore.lists` as data source; `fetchLists` on AppShell mount |
| NAV-02 | Currently viewed list is visually highlighted in sidebar | `useParams().code` matched against `list.share_code`; active row bg + font-weight + `aria-current="page"` |
</phase_requirements>

---

## Summary

Phase 8 wires a persistent navigation shell around the protected list route. The three key technical problems are: (1) placing `AppShell` as a layout route in React Router v7 without disrupting the existing `ProtectedRoute` pathless element; (2) building a left-anchored slide-in drawer on the Base UI Dialog primitive, whose `Popup` has no positioning props — positioning is purely CSS; and (3) wiring `tw-animate-css` slide utilities to Base UI's `data-open`/`data-closed` state attributes.

All three problems have clean, verified solutions. React Router v7 supports stacked pathless layout routes natively — the router config becomes two nested pathless entries (`ProtectedRoute` then `AppShell`), both rendering `<Outlet/>`. The Base UI `Dialog.Popup` renders a plain `<div>` with no default positioning — applying `fixed inset-y-0 left-0 w-72 max-w-[80vw]` replaces the centered `DialogContent` classes entirely. The `tw-animate-css` library ships `slide-in-from-left` / `slide-out-to-left` utilities that set CSS custom properties consumed by the `animate-in` / `animate-out` keyframe animations; combining these as `data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left` on the Popup element produces the expected slide behavior using the exact same pattern as the existing dialog overlay.

The phase introduces zero new dependencies. The `@base-ui/react` package (v1.5.0, already installed) also ships a dedicated `Drawer` component at `@base-ui/react/drawer`, but D-02 locks to the Dialog primitive — the Dialog approach is sufficient and keeps the component tree minimal.

**Primary recommendation:** Build `AppShell` as a thin layout wrapper (pathless route, local open `useState`, `fetchLists` on mount), and `Sidebar` as a Dialog-based component with CSS-overridden left-anchored positioning and `data-open`/`data-closed` slide animation. The hamburger trigger lives in `AppShell` and is rendered above `<Outlet/>` so it appears on every protected list page.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layout route / Outlet | Frontend (React Router) | — | Route nesting is router's job |
| Drawer open/close state | Frontend (AppShell local state) | — | Single consumer; no cross-component reads |
| Sidebar list data | Client store (Zustand listsStore) | Supabase (fetch on mount) | Store already owns list collection; sidebar reads it |
| Active list identification | Frontend (useParams hook) | — | URL is the source of truth per D-04 |
| Drawer animation | CSS (tw-animate-css) | Base UI state attrs | Pure CSS; no JS animation library needed |
| Focus trap / a11y | Base UI Dialog primitive | — | Built into the primitive; don't hand-roll |
| Navigation on tap | React Router (useNavigate / Link) | AppShell open state | Navigate + close is one handler per D-08 |

---

## Standard Stack

### Core (all already installed — zero new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-router-dom` | ^7.15.1 | Layout route + `<Outlet/>` + `useParams` + `useNavigate` | Already the router; v7 supports stacked pathless routes |
| `@base-ui/react` | ^1.5.0 | Dialog primitive (Root/Portal/Backdrop/Popup/Close) for drawer | Already the component primitive library; focus-trap, Escape, portal built-in |
| `tw-animate-css` | ^1.4.0 | `animate-in`/`animate-out` + `slide-in-from-left`/`slide-out-to-left` | Already imported in `index.css`; exact utility classes verified in dist |
| `zustand` | ^5.0.13 | `listsStore` (read `lists`, call `fetchLists`) | Already the state library |
| `lucide-react` | ^1.16.0 | `Menu` icon for hamburger trigger | Already a dep |

**No installation step required.**

---

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies already exist in `package.json` and `node_modules`. Audit not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser URL: /list/:code
        |
        v
createBrowserRouter
  └── [pathless] ProtectedRoute (auth guard → Outlet)
        └── [pathless] AppShell (layout route → renders trigger + Sidebar + Outlet)
              ├── <button> Menu icon trigger  ──opens──> Sidebar (Dialog)
              ├── <Outlet/>  ──renders──> ListPage (/list/:code)
              └── Sidebar (Dialog.Root controlled by AppShell open state)
                    ├── Dialog.Portal
                    │     ├── Dialog.Backdrop (fade)
                    │     └── Dialog.Popup (fixed left-0 inset-y-0, slide-in-from-left)
                    │           ├── [header + optional Phase 9 profile slot]
                    │           ├── lists.map(list => <Link> row, aria-current if active)
                    │           └── Dialog.Close (X button)
                    └── (open state lifted to AppShell via open/onOpenChange props)
```

Data flow:
- `AppShell.useEffect([])` → `listsStore.fetchLists(user.id)` when `lists.length === 0`
- `listsStore.lists` → Sidebar props
- `useParams().code` (from ListPage context) → active row match in Sidebar
- Sidebar row click → `navigate(/list/${list.share_code})` + `setOpen(false)`

### Recommended Project Structure

```
src/
├── components/
│   ├── AppShell.tsx        # Layout component: open useState, fetchLists, renders trigger + Sidebar + Outlet
│   ├── Sidebar.tsx         # Dialog-based left-anchored drawer; receives lists + open/onOpenChange
│   └── ui/
│       └── dialog.tsx      # Existing — do not modify; Sidebar uses primitives directly
├── pages/
│   └── ListPage.tsx        # Header gains hamburger trigger OR AppShell renders trigger above Outlet
└── router.tsx              # Add AppShell layout route nested under ProtectedRoute
```

### Pattern 1: Stacked Pathless Layout Routes (React Router v7)

**What:** Two consecutive pathless routes nest so both render `<Outlet/>` — outer does auth gating, inner adds the shell.
**When to use:** When a layout wrapper must sit inside an auth guard without owning a URL segment.

```tsx
// Source: React Router v7 official docs (reactrouter.com/start/data/routing)
// Verified: actual router.tsx confirms existing ProtectedRoute follows this pattern
import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/AppShell'
import ListPage from '@/pages/ListPage'
import LandingPage from '@/pages/LandingPage'
import NotFoundPage from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <ProtectedRoute />,   // pathless auth guard; renders <Outlet/>
    children: [
      {
        element: <AppShell />,     // pathless layout; renders trigger + Sidebar + <Outlet/>
        children: [
          { path: '/list/:code', element: <ListPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```

**Important:** The existing `ProtectedRoute` already uses `element: <ProtectedRoute />` (not `Component: ProtectedRoute`) — stay consistent with `element:` syntax throughout to avoid mixing v6/v7 forms.

### Pattern 2: AppShell Component

**What:** Thin layout component — owns open `useState`, calls `fetchLists` on mount if lists empty, renders the hamburger trigger + Sidebar + `<Outlet/>`.
**When to use:** The one layout host for the sidebar.

```tsx
// Source: codebase pattern (authStore, listsStore) + React Router v7 Outlet
import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'
import Sidebar from '@/components/Sidebar'
import { Button } from '@/components/ui/button'

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const lists = useListsStore((state) => state.lists)
  const fetchLists = useListsStore((state) => state.fetchLists)

  // D-05: fetch only when lists cache is empty (guard prevents refetch on list→list nav)
  useEffect(() => {
    if (user && lists.length === 0) {
      fetchLists(user.id)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Sidebar open={open} onOpenChange={setOpen} lists={lists} />
      {/* Hamburger trigger — rendered above Outlet so it floats over ListPage content
          OR pass setOpen down as a prop to ListPage header. See Pitfall 2 for tradeoffs. */}
      <Outlet />
    </>
  )
}
```

### Pattern 3: Left-Anchored Drawer on Base UI Dialog Primitive

**What:** Override the centered positioning of `DialogContent` with CSS for a full-height left-side panel. The `Dialog.Popup` renders a plain `<div>` with no built-in positioning — all placement is via `className`.
**When to use:** D-02 — building the sidebar drawer.

```tsx
// Source: @base-ui/react/esm/dialog/popup/DialogPopup.d.ts (verified in node_modules)
// + base-ui.com/react/components/dialog (official docs, fetched)
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: List[]
}

export function Sidebar({ open, onOpenChange, lists }: SidebarProps) {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {/* Portal lifts content out of the React tree into <body> */}
      <DialogPrimitive.Portal>
        {/* Backdrop: reuse existing dialog overlay pattern */}
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-40 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200"
        />
        {/* Popup: NO centering transform — fixed to left edge, full height */}
        <DialogPrimitive.Popup
          className={cn(
            // Left-anchored positioning (overrides DialogContent's top-1/2 left-1/2 -translate-*)
            'fixed inset-y-0 left-0 z-50',
            'w-72 max-w-[80vw]',
            // Appearance
            'bg-background flex flex-col',
            'shadow-lg ring-1 ring-foreground/10',
            // Animation: slide from left on open, slide to left on close
            'duration-200',
            'data-open:animate-in data-open:slide-in-from-left',
            'data-closed:animate-out data-closed:slide-out-to-left',
          )}
        >
          {/* Sidebar content */}
          <div className="flex items-center justify-between p-4 border-b">
            <span className="font-semibold text-base">Your Lists</span>
            <DialogPrimitive.Close>
              {/* close button */}
            </DialogPrimitive.Close>
          </div>

          {/* Phase 9 profile slot — leave empty */}

          {/* List rows */}
          <nav className="flex-1 overflow-y-auto py-2">
            {lists.map((list) => {
              const isActive = list.share_code === code
              return (
                <Link
                  key={list.id}
                  to={`/list/${list.share_code}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex items-center px-4 py-3 text-sm truncate',
                    'hover:bg-accent transition-colors',
                    isActive && 'bg-accent font-semibold',
                  )}
                >
                  {list.name}
                </Link>
              )
            })}
          </nav>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

### Pattern 4: Hamburger Trigger Placement

**What:** The `Menu` (hamburger) icon trigger needs to render inside `ListPage`'s header row alongside the list name and `SyncStatus`. Two valid approaches:

**Option A — AppShell renders an absolutely-positioned trigger button** (no ListPage changes):
```tsx
// AppShell.tsx
<>
  <button
    aria-label="Open navigation"
    onClick={() => setOpen(true)}
    className="fixed top-4 left-4 z-30 ..."  // or relative to list page layout
  >
    <Menu />
  </button>
  <Sidebar open={open} onOpenChange={setOpen} lists={lists} />
  <Outlet />
</>
```

**Option B — AppShell passes `onOpenSidebar` callback via React Router context or a prop**:
- More coupled; requires ListPage to accept/know about the sidebar.

**Recommendation (planner's call per Claude's Discretion):** Option A keeps AppShell and ListPage cleanly separated. The exact positioning class depends on how the ListPage header is laid out — planner should verify the header row structure in `ListPage.tsx` (line 299–349) to co-locate precisely.

### Anti-Patterns to Avoid

- **Reusing `DialogContent` from `src/components/ui/dialog.tsx`:** It hardcodes `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`. The sidebar must build directly from `DialogPrimitive.Popup`.
- **Using `Dialog.Trigger` inside AppShell + Dialog.Root:** Trigger must be a sibling/child of Dialog.Root. Since AppShell wraps both, either (a) put the trigger inside Sidebar and pass nothing, or (b) use controlled `open`/`onOpenChange` without a `Dialog.Trigger` (which is what Pattern 3 does with a plain `<button onClick={() => setOpen(true)}`).
- **Fetching lists on every render in AppShell:** The `useEffect` must guard on `lists.length === 0` to prevent a refetch every time the user navigates between lists (D-05).
- **Passing `useNavigate()` into Sidebar from AppShell:** `Sidebar` itself can call `useNavigate()` — it's rendered inside the router tree via the Portal, so hooks work fine.
- **Incorrect `useParams()` location:** `useParams()` works in `Sidebar` because Sidebar is rendered inside AppShell which is inside the router. The Portal moves the *DOM* node but not the React context tree — context (including router context) is preserved.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap inside drawer | Custom focus-lock logic | `Dialog.Root modal=true` (default) | Base UI traps focus, handles Tab/Shift+Tab cycling, exposes `initialFocus`/`finalFocus` props |
| Escape-to-close | `keydown` listener | Base UI Dialog built-in | Handles Escape automatically; fires `onOpenChange(false)` |
| Backdrop click dismiss | `onClick` on overlay div | `Dialog.Backdrop` + `disablePointerDismissal=false` (default) | Built into the primitive |
| Focus restoration on close | Manually track and restore previous focus | `Dialog.Popup finalFocus={true}` (default) | Primitive returns focus to the trigger element automatically |
| Portal / z-index stacking | Render inside DOM tree | `Dialog.Portal` | Lifts to `<body>`, avoids `z-index` stacking context fights |
| Slide animation | CSS `@keyframes` from scratch | `tw-animate-css` + `data-open`/`data-closed` | Library ships `slide-in-from-left` / `slide-out-to-left` utilities; zero-config with Tailwind v4 `@import "tw-animate-css"` already in `index.css` |

**Key insight:** The Base UI Dialog primitive provides a complete accessible overlay experience. The entire a11y surface (focus trap, Escape, focus restoration, `role="dialog"`, `aria-modal`, `aria-labelledby`) is handled by the primitive. Only CSS positioning and animation require custom work.

---

## Common Pitfalls

### Pitfall 1: Dialog.Popup Has No Positioning Props — Position Is 100% CSS

**What goes wrong:** Developer expects positioning props (like `side="left"`) on `Dialog.Popup`. None exist. Without overriding the default styles, the popup appears wherever CSS places it (or floats at top-left if unstyled).
**Why it happens:** `Dialog.Popup` is a plain `<div>` with no Base UI-applied position styles. Positioning is the implementor's responsibility.
**How to avoid:** Apply `fixed inset-y-0 left-0` CSS directly on the `className` prop of `Dialog.Popup`. Do NOT use the exported `DialogContent` wrapper — it adds centering transforms that conflict.
**Warning signs:** Drawer appears in the center of the screen, or appears as a small box at origin.

### Pitfall 2: Hamburger Trigger Placement — AppShell Renders Above Outlet

**What goes wrong:** AppShell renders `<Outlet/>` first, then adds the trigger — so the trigger is DOM-positioned below ListPage's content. On mobile, the user scrolls down and the hamburger is gone.
**Why it happens:** Naive layout: `<Outlet/>` then `<button>`.
**How to avoid:** The trigger must be outside of and visually overlaid on the ListPage content. Either: (a) use `position: fixed` / `position: sticky` on the trigger so it always stays in view, or (b) pass an `onOpen` callback as a prop/context to ListPage so it can render the trigger inside its own header row at the correct layout position.
**Warning signs:** Hamburger disappears when the list has many items and user scrolls.

### Pitfall 3: `useParams()` Called Above the Route That Defines `:code`

**What goes wrong:** If `AppShell` calls `useParams()` to get `code` for the active-list match, it returns `{}` (empty object) because `AppShell` is the parent route of `/list/:code`, not the child.
**Why it happens:** `useParams()` only sees params from the *matched* route and its ancestors — the `:code` param is only available at the `/list/:code` route or below.
**How to avoid:** Call `useParams()` inside `Sidebar` — `Sidebar` is rendered as a child of `AppShell`, but it is rendered *inside* the React component tree at the same level as ListPage once Outlet resolves. The Portal moves only the DOM, not the React context. Alternatively, pass `code` as a prop from AppShell via a context if `useParams()` doesn't resolve correctly in Sidebar. **Test this explicitly** — it should work because `Sidebar` is rendered in AppShell which is nested inside the `:code` route match.

Actually: `Sidebar` is rendered by `AppShell`, which is the *parent* route of `/list/:code`. The `:code` param is not available in parent routes. **Solution:** Pass `code` (from ListPage via outlet context, or via React context, or via `window.location` parsing) down to Sidebar, OR have Sidebar read from the router's matched params a level down. The cleanest approach: use React Router's `useMatch('/list/:code')` inside Sidebar — it returns `null` when not on a list route, or `{ params: { code } }` when on one.

```tsx
// In Sidebar:
import { useMatch } from 'react-router-dom'
const match = useMatch('/list/:code')
const activeCode = match?.params.code ?? null
// Then: const isActive = list.share_code === activeCode
```

**Warning signs:** All rows render without the active highlight even when on a list page.

### Pitfall 4: Base UI `data-open` / `data-closed` Attribute Syntax in Tailwind v4

**What goes wrong:** The existing dialog uses `data-open:animate-in` — this is Tailwind v4 syntax for data-attribute variants. If the drawer uses the older `data-[state=open]:animate-in` form (Tailwind v3 / Radix style), the classes are emitted but the selectors don't match Base UI's attributes.
**Why it happens:** Base UI sets `data-open` (boolean attribute, no value), not `data-state="open"`. Tailwind v4 supports `data-open:` as a first-class variant for boolean attributes.
**How to avoid:** Use the exact same `data-open:` / `data-closed:` variant syntax the existing dialog uses. Confirmed working in `src/components/ui/dialog.tsx`.
**Warning signs:** No animation on open/close despite classes being applied.

### Pitfall 5: Mobile Safari — `position: fixed` and Virtual Keyboard / Bottom Bar

**What goes wrong:** On iOS Safari, `position: fixed; inset-y-0` elements may not stretch to cover the full visual viewport when the address bar is visible or the virtual keyboard is open.
**Why it happens:** iOS Safari's `100vh` doesn't match the visual viewport — the `100dvh` dynamic viewport unit fixes this.
**How to avoid:** Use `h-dvh` (dynamic viewport height, Tailwind v4 supported) instead of `h-full` or `h-screen` on the drawer popup. If `dvh` isn't available as a utility, use `style={{ height: '100dvh' }}`.
**Warning signs:** Bottom of drawer is cut off on iPhone; scrolling inside drawer is limited.

### Pitfall 6: Focus Restoration After Close — Trigger Reference

**What goes wrong:** After the drawer closes, focus does not return to the hamburger trigger button.
**Why it happens:** If the trigger is rendered as a plain `<button onClick>` outside of `Dialog.Trigger`, Base UI's `finalFocus` default (return to trigger) may not find the trigger element automatically.
**How to avoid:** Use a `ref` on the hamburger button and pass it as `finalFocus` on `Dialog.Popup`:
```tsx
const triggerRef = useRef<HTMLButtonElement>(null)
// ...
<button ref={triggerRef} onClick={() => setOpen(true)} ... />
<Sidebar ... popupFinalFocus={triggerRef} />
// In Sidebar:
<DialogPrimitive.Popup finalFocus={finalFocusRef} ...>
```
**Warning signs:** Keyboard users lose focus position after closing drawer; screen reader announces wrong element.

### Pitfall 7: `listsStore.fetchLists` Race with `ProtectedRoute` Auth Guard

**What goes wrong:** `AppShell` mounts, `user` is still `null` (auth resolving), `fetchLists(null)` is called, Supabase query returns empty or errors.
**Why it happens:** The `isLoading` guard in `ProtectedRoute` prevents rendering `<Outlet/>` until auth resolves — but AppShell is the Outlet content. By the time AppShell mounts, `user` should be non-null. However, defensive guard is still good practice.
**How to avoid:** The `useEffect` guard `if (user && lists.length === 0)` already protects against null user. Since `ProtectedRoute` blocks mounting AppShell until `user` is non-null, this is belt-and-suspenders.
**Warning signs:** `fetchLists` receives `undefined` for userId; Supabase returns RLS errors.

---

## Code Examples

Verified patterns from codebase and official sources:

### Existing Dialog Overlay Animation (reference pattern)
```tsx
// Source: src/components/ui/dialog.tsx (read directly)
// This is the EXACT pattern to mirror for the drawer backdrop
<DialogPrimitive.Backdrop
  className="fixed inset-0 isolate z-50 bg-black/10 duration-100
    data-open:animate-in data-open:fade-in-0
    data-closed:animate-out data-closed:fade-out-0"
/>
```

### tw-animate-css Slide Utilities (verified in node_modules dist)
```css
/* Source: node_modules/tw-animate-css/dist/tw-animate.css (read directly) */
/* slide-in-from-left sets: --tw-enter-translate-x: -100% */
/* slide-out-to-left sets: --tw-exit-translate-x: -100% */
/* These CSS custom properties are consumed by the 'enter'/'exit' @keyframes */
/* animate-in triggers: animation: enter var(--tw-animation-duration, .15s) ease ... */
/* animate-out triggers: animation: exit var(--tw-animation-duration, .15s) ease ... */

/* Drawer Popup animation classes — ready to copy: */
.drawer-popup {
  /* Tailwind v4 class string: */
  /* data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left duration-200 */
}
```

### `useMatch` for Active List (solves Pitfall 3)
```tsx
// Source: React Router v7 docs + verified API from react-router-dom ^7.15.1
import { useMatch } from 'react-router-dom'

// In Sidebar component:
const match = useMatch('/list/:code')
const activeCode = match?.params.code ?? null

// In list row render:
const isActive = list.share_code === activeCode
// aria-current={isActive ? 'page' : undefined}
```

### Dialog.Root Controlled Mode (verified API)
```tsx
// Source: base-ui.com/react/components/dialog (fetched) + node_modules type definitions
// Dialog.Root accepts open/onOpenChange for controlled mode
<DialogPrimitive.Root
  open={open}
  onOpenChange={onOpenChange}
  // modal={true} is the default — keeps focus trap + scroll lock + backdrop dismiss
>
  ...
</DialogPrimitive.Root>
```

### Focus Restoration via finalFocus
```tsx
// Source: @base-ui/react/esm/dialog/popup/DialogPopup.d.ts (read directly from node_modules)
// finalFocus?: boolean | RefObject<HTMLElement> | ((closeType: InteractionType) => ...)
<DialogPrimitive.Popup
  finalFocus={triggerRef}  // returns focus to hamburger button on close
  ...
>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `element: <Component />` in router config | `Component: ComponentClass` (v7 preferred) | React Router v7 | `element:` still works; project uses `element:` consistently — keep it |
| Radix UI Dialog (`data-state="open"`) | Base UI Dialog (`data-open` boolean attr) | This codebase uses Base UI | Animation variant syntax is `data-open:` not `data-[state=open]:` |
| `tailwindcss-animate` (JS plugin, v3) | `tw-animate-css` (pure CSS, v4) | Tailwind v4 migration | Import via `@import "tw-animate-css"` in CSS; no plugin config needed |

**Deprecated/outdated in this codebase:**
- `data-[state=open]:` syntax (Radix/shadcn): Not applicable — Base UI uses boolean data attrs.
- `DialogContent` from `src/components/ui/dialog.tsx` for the drawer: Its centering CSS is incompatible with a left-anchored drawer.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useMatch('/list/:code')` in Sidebar correctly resolves `:code` even though Sidebar is rendered by a parent route | Pitfall 3, Code Examples | Active highlight never shows; fallback: pass active code via prop from AppShell using `useLocation()` parsing |
| A2 | `element:` and `Component:` can be mixed within the same `createBrowserRouter` call in RR v7 | Pattern 1 | No actual risk — both are supported in v7; project already uses `element:` consistently so stay with it |

---

## Open Questions

1. **Hamburger trigger positioning strategy**
   - What we know: AppShell renders above ListPage via Outlet; ListPage has a flex header row with list name, rename/delete controls, and SyncStatus.
   - What's unclear: Whether the trigger should be inside the ListPage header row (requiring a prop/callback from AppShell) or overlaid via `position: fixed` from AppShell.
   - Recommendation: Pass an `onOpenSidebar` callback or use React context to let ListPage render the trigger in the correct header position. This avoids fixed-position collision with the existing header layout.

2. **Empty state in sidebar when `lists.length === 0`**
   - What we know: A user on `/list/:code` always owns at least the list they're viewing, so true zero-list is edge case (legacy NULL owner lists only).
   - What's unclear: Copy and design for this edge case.
   - Recommendation: Show a simple "No lists found" message; reuse muted-foreground text style from LandingPage empty state.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is pure frontend code using already-installed packages).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.2.3 + Testing Library ^16.3.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | AppShell renders Sidebar; clicking Menu button opens it; lists appear inside | unit | `npx vitest run src/components/AppShell.test.tsx -x` | ❌ Wave 0 |
| NAV-01 | Sidebar shows all lists from listsStore | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ Wave 0 |
| NAV-01 | AppShell calls fetchLists on mount when lists empty | unit | `npx vitest run src/components/AppShell.test.tsx -x` | ❌ Wave 0 |
| NAV-01 | AppShell does NOT call fetchLists when lists already populated | unit | `npx vitest run src/components/AppShell.test.tsx -x` | ❌ Wave 0 |
| NAV-02 | Active list row has aria-current="page" | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ Wave 0 |
| NAV-02 | Active list row has visual distinction (bg-accent class) | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ Wave 0 |
| NAV-01+D-08 | Clicking a list row calls navigate + closes sidebar | unit | `npx vitest run src/components/Sidebar.test.tsx -x` | ❌ Wave 0 |
| D-01 | Router config: AppShell is nested under ProtectedRoute | unit | `npx vitest run src/router.test.tsx -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/AppShell.test.tsx src/components/Sidebar.test.tsx --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/AppShell.test.tsx` — covers NAV-01 (open trigger, fetchLists guard)
- [ ] `src/components/Sidebar.test.tsx` — covers NAV-01 (list rendering), NAV-02 (active highlight, aria-current), D-08 (navigate+close)
- [ ] `src/router.test.tsx` — covers D-01 (AppShell in router tree) — may already partially exist; check if `src/router.tsx` has a test

**Existing test infrastructure:** Vitest + jsdom + Testing Library already configured. `src/test-setup.ts` imports `@testing-library/jest-dom`. Pattern to follow: `src/stores/listsStore.test.ts` (mock Supabase via `vi.mock`), `src/components/auth/ProtectedRoute.test.tsx` (mock router + store).

**Base UI Dialog in tests:** `@base-ui/react` Dialog uses portals. Testing Library's `render` + jsdom renders portals into `document.body` — use `getByRole('dialog')` or query within `document.body` for elements that portal out.

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth is already gated by ProtectedRoute; AppShell is inside the auth boundary |
| V3 Session Management | No | No new session state introduced |
| V4 Access Control | Yes (minor) | Sidebar must only show user's own lists — enforced by `listsStore.fetchLists` which queries `owner_id = auth.uid()` (Phase 7 RLS + store query) |
| V5 Input Validation | No | Sidebar is read-only; no user input fields |
| V6 Cryptography | No | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sidebar showing other users' lists | Information Disclosure | Already mitigated: `fetchLists` queries `eq('owner_id', userId)` + Supabase RLS enforces owner-scoped reads |
| Focus escaping drawer to background content | Spoofing / Elevation | Base UI Dialog `modal=true` default: focus trapped, pointer interactions on outside disabled |

**No new security surface introduced.** The sidebar is a read display of already-authenticated, already-authorized list data. The drawer primitive provides modal focus trapping by default.

---

## Sources

### Primary (HIGH confidence)

- `src/components/ui/dialog.tsx` — exact `data-open:animate-in` / `data-closed:animate-out` pattern, confirmed `@base-ui/react/dialog` import path, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Portal`, `Dialog.Close` usage
- `node_modules/@base-ui/react/esm/dialog/popup/DialogPopup.d.ts` — confirmed `Dialog.Popup` has `initialFocus`/`finalFocus` props, no positioning props, renders `<div>`
- `node_modules/@base-ui/react/esm/drawer/root/DrawerRoot.d.ts` — confirmed `@base-ui/react/drawer` exists in installed v1.5.0 with `swipeDirection: 'left' | 'right' | 'up' | 'down'`
- `node_modules/tw-animate-css/dist/tw-animate.css` — confirmed `slide-in-from-left` sets `--tw-enter-translate-x: -100%`, `slide-out-to-left` sets `--tw-exit-translate-x: -100%`, used with `animate-in`/`animate-out`
- `src/router.tsx` — confirmed `element:` syntax (not `Component:`), `ProtectedRoute` is a pathless element route with `children: [{ path: '/list/:code', element: <ListPage /> }]`
- `src/stores/listsStore.ts` — confirmed `fetchLists(userId)`, `lists` state shape, `List.share_code` field
- `src/stores/authStore.ts` — confirmed `user: User | null`, `user.id` available
- `src/pages/ListPage.tsx` — confirmed `useParams<{ code: string }>()` returns `code`; header structure lines 299–349; `SyncStatus` in trailing position

### Secondary (MEDIUM confidence)

- `base-ui.com/react/components/dialog` (fetched) — Dialog.Root `open`/`onOpenChange`/`modal`/`disablePointerDismissal` props; `data-open`/`data-closed` state attributes; "No positioning props on Popup" explicitly confirmed
- `base-ui.com/react/components/drawer` (fetched) — Drawer exists as separate component with `swipeDirection`; D-02 locks to Dialog, but Drawer is a valid future alternative
- `reactrouter.com/start/data/routing` (fetched) — confirmed pathless layout route syntax for v7; `Component:` is preferred in v7, `element:` is still valid

### Tertiary (LOW confidence)

- WebSearch results on `tw-animate-css` slide utilities — corroborated by direct source reading, elevated to HIGH

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in `package.json` + `node_modules`
- Architecture (router nesting): HIGH — confirmed from `src/router.tsx` + official RR v7 docs
- Base UI Dialog positioning: HIGH — confirmed from type definitions + official docs ("no positioning props")
- tw-animate-css utilities: HIGH — confirmed from actual dist CSS source
- Pitfalls (useParams in parent route): MEDIUM — verified by React Router context rules; A1 assumption applies
- Test patterns: HIGH — existing test files confirm Vitest + Testing Library + vi.mock pattern

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable libraries; Base UI 1.x API unlikely to change)
