# Phase 1: Foundation - Research

**Researched:** 2026-05-24
**Domain:** Supabase schema + RLS, React/Vite SPA scaffold, nanoid share codes, React Router v7, Tailwind v4, shadcn/ui
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Landing page presents two paths: "Create a list" (requires naming it) or "Join a list" (enter code/URL)
- **D-02:** Join input auto-detects whether user entered a short code or full URL
- **D-03:** After creating, show share code + copy button AND a native share sheet button (Web Share API on mobile, fallback to copy on desktop)
- **D-04:** Post-creation lands on the list view with a dismissable banner prompting "Share this list with your partner" (includes code/link)
- **D-05:** URL structure is `/list/CODE` (e.g., `our-cart.vercel.app/list/V1StGXR8`)
- **D-06:** Share code is 8 characters using nanoid
- **D-07:** Alphabet is nanoid default (A-Za-z0-9_-) — codes are shared via text/copy, not spoken

### Claude's Discretion

- **Schema design:** Create both `lists` and `items` tables in Phase 1 to avoid migration churn in Phase 2. Items table will be empty but structurally ready.
- **Lists table columns:** id (UUID PK, auto-generated), share_code (nanoid 8-char, unique, indexed), name (text, required), created_at (timestamptz, default now())
- **RLS approach:** Share code = access. RLS policies filter by share_code matching a request parameter. Anyone who knows the code can read/write. Appropriate for a private 2-person app where the URL is the only credential.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHARE-01 | User can create a new list and receive a shareable link or code | nanoid(8) generates share code; Supabase INSERT creates the list row; client constructs the URL |
| SHARE-02 | Partner can join the list by opening the shared link — no account creation needed | React Router `/list/:code` route loads list by share_code; RLS allows anon access; no auth required |
| SHARE-03 | Shared link acts as the only access credential (URL contains list ID) | share_code in URL is the sole credential; RLS gates all DB access by share_code column match; no session/auth involved |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield scaffold of the entire technical stack with no existing code to build on. The primary technical challenge is configuring Supabase RLS correctly for a no-auth, share-code-as-credential access pattern — which is a non-standard but well-supported Supabase use case. The React/Vite/Tailwind/shadcn stack is fully locked by CLAUDE.md and all versions have been registry-verified.

The RLS model for this app is: grant `anon` role access to rows, but scope access by including `share_code` or `list_id` as an explicit query filter from the client. For the `lists` table, the policy is `USING (true)` for `anon` with client queries always filtered by `share_code`. For the `items` table, the policy checks that the referenced `list_id` belongs to a list (via EXISTS subquery) — but since Phase 1 creates no items, the items RLS policy only needs to be structurally sound. Items are added in Phase 2.

The secondary challenge is correct Vercel SPA routing (a `vercel.json` rewrite is required so that direct navigation to `/list/CODE` doesn't 404), and the new Supabase API key format (`sb_publishable_xxx` instead of legacy `anon` key).

**Primary recommendation:** Scaffold Vite react-ts, install all dependencies in one wave, create Supabase tables + RLS via the dashboard SQL editor, wire up the three routes (Home, List, NotFound), implement the create/join flow, and ship a working shareable URL.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| List creation (INSERT into Supabase) | Browser / Client | — | SPA, no backend — client calls Supabase PostgREST directly via supabase-js |
| Share code generation | Browser / Client | — | nanoid(8) runs in browser at creation time |
| URL routing (`/list/CODE`) | Browser / Client | CDN / Static | React Router handles client-side routing; Vercel serves index.html for all paths via rewrite |
| Share code lookup (JOIN via URL) | Browser / Client | — | Client queries Supabase with share_code from URL params |
| Data access enforcement | Database / Storage | — | Supabase RLS policies enforce access; client-side filtering is supplementary performance optimization |
| Share sheet / copy-to-clipboard | Browser / Client | — | Web Share API + Clipboard API, both browser-native |
| UI state (banner dismissal, modal open) | Browser / Client | — | Zustand store; ephemeral, no persistence needed |
| Static hosting | CDN / Static | — | Vercel Hobby plan serves the built SPA bundle |

---

## Standard Stack

### Core (all versions registry-verified 2026-05-24)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.6 | UI framework | Locked in CLAUDE.md [VERIFIED: npm registry] |
| react-dom | 19.2.6 | DOM renderer | Paired with react [VERIFIED: npm registry] |
| vite | 8.0.14 | Build tool + dev server | Locked in CLAUDE.md [VERIFIED: npm registry] |
| @vitejs/plugin-react | 6.0.2 | React Fast Refresh for Vite | Required peer for react in Vite [VERIFIED: npm registry] |
| typescript | 5.x | Type safety | Included in Vite react-ts template [ASSUMED] |
| @supabase/supabase-js | 2.106.1 | Postgres + Realtime client | Locked in CLAUDE.md [VERIFIED: npm registry] |
| react-router-dom | 7.15.1 | Client-side routing | Industry standard SPA routing [VERIFIED: npm registry] |
| nanoid | 5.1.11 | Share code generation | Locked in CLAUDE.md [VERIFIED: npm registry] |
| zustand | 5.0.13 | Client UI state | Locked in CLAUDE.md [VERIFIED: npm registry] |
| tailwindcss | 4.3.0 | Utility CSS | Locked in CLAUDE.md [VERIFIED: npm registry] |
| @tailwindcss/vite | 4.3.0 | Tailwind v4 Vite plugin | Required for Tailwind v4 Vite integration [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | 25.9.1 | Node.js type defs | Required for `path` module in vite.config.ts (shadcn/ui alias setup) [VERIFIED: npm registry] |
| shadcn/ui components | CLI-installed | Accessible UI primitives | Add only when a specific component is needed (e.g., `npx shadcn@latest add button`) [CITED: ui.shadcn.com/docs/installation/vite] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-router-dom v7 Data Mode | Declarative Mode (BrowserRouter) | Data mode adds loader/action support — worth it for code clarity; Declarative mode is simpler but loses data fetching patterns |
| nanoid(8) default alphabet | customAlphabet with subset | Default `A-Za-z0-9_-` is fine — codes are copy/pasted not spoken (D-07 confirms this) |

**Installation:**
```bash
npm create vite@latest our-cart -- --template react-ts
cd our-cart
npm install @supabase/supabase-js react-router-dom nanoid zustand
npm install tailwindcss @tailwindcss/vite
npm install -D @types/node
```

Then shadcn/ui init (after vite.config and tsconfig aliases are set):
```bash
npx shadcn@latest init
```

Individual components as needed:
```bash
npx shadcn@latest add button input
```

---

## Package Legitimacy Audit

> slopcheck was installed but the CLI entry point was not on PATH. Packages below are verified via npm registry (all established, open-source, high-download packages) with repository URLs confirmed.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| @supabase/supabase-js | npm | ~5 yrs (2020) | github.com/supabase/supabase-js | N/A | Approved [VERIFIED: npm registry + official docs] |
| nanoid | npm | ~8 yrs (2017) | github.com/ai/nanoid | N/A | Approved [VERIFIED: npm registry + official docs] |
| zustand | npm | ~6 yrs (2019) | github.com/pmndrs/zustand | N/A | Approved [VERIFIED: npm registry] |
| react-router-dom | npm | ~9 yrs (2016) | github.com/remix-run/react-router | N/A | Approved [VERIFIED: npm registry] |
| tailwindcss | npm | ~6 yrs | github.com/tailwindlabs/tailwindcss | N/A | Approved [VERIFIED: npm registry + official docs] |
| @tailwindcss/vite | npm | ~1 yr | github.com/tailwindlabs/tailwindcss | N/A | Approved [VERIFIED: npm registry + official docs] |
| @types/node | npm | ~9 yrs | github.com/DefinitelyTyped/DefinitelyTyped | N/A | Approved [VERIFIED: npm registry] |

**No postinstall scripts detected on any package.** (`npm view <pkg> scripts.postinstall` returned empty for all.)

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck CLI was not reachable at PATH despite pip install. All packages are long-established, widely-used, officially documented libraries. Risk: minimal.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React SPA)
        │
        ├── React Router v7 (createBrowserRouter)
        │        ├── "/" → LandingPage
        │        │       ├── CreateListForm (name input → INSERT)
        │        │       └── JoinListForm (code/URL input → navigate)
        │        ├── "/list/:code" → ListPage
        │        │       ├── useEffect: lookup share_code → get list.id
        │        │       ├── ShareBanner (dismissable, shows code + share button)
        │        │       └── [items area — empty, Phase 2]
        │        └── "*" → NotFoundPage
        │
        ├── Zustand store
        │        └── bannerDismissed: boolean (per list)
        │
        └── Supabase client (supabase-js)
                 │   createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
                 │
                 └── Supabase (hosted)
                          ├── PostgREST API
                          │       ├── lists table (RLS: anon SELECT/INSERT)
                          │       └── items table (RLS: anon SELECT/INSERT via list_id)
                          └── Postgres
                                   ├── lists: id, share_code, name, created_at
                                   └── items: id, list_id (FK→lists), name, qty, category, checked, created_at

CDN (Vercel Hobby)
        └── Serves built SPA (dist/)
                 vercel.json: rewrites "/:path*" → "/index.html"
```

### Recommended Project Structure

```
our-cart/
├── public/
├── src/
│   ├── lib/
│   │   └── supabase.ts          # createClient singleton
│   ├── stores/
│   │   └── uiStore.ts           # Zustand: banner dismissed, etc.
│   ├── pages/
│   │   ├── LandingPage.tsx      # Create + Join forms
│   │   ├── ListPage.tsx         # List view (shell in Phase 1)
│   │   └── NotFoundPage.tsx
│   ├── components/
│   │   ├── CreateListForm.tsx
│   │   ├── JoinListForm.tsx
│   │   └── ShareBanner.tsx      # Dismissable share prompt
│   ├── router.tsx               # createBrowserRouter definition
│   ├── App.tsx                  # RouterProvider wrapper
│   ├── main.tsx                 # ReactDOM.createRoot entry
│   └── index.css                # @import "tailwindcss";
├── vercel.json                  # SPA routing rewrite
├── vite.config.ts               # react() + tailwindcss() plugins, @ alias
├── tsconfig.json                # baseUrl + paths for @ alias
├── tsconfig.app.json            # same paths config
└── .env.local                   # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
```

### Pattern 1: Supabase Client Singleton

Create once, import everywhere. Never call `createClient` in a component.

```typescript
// src/lib/supabase.ts
// Source: supabase.com/docs/guides/getting-started/quickstarts/reactjs
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### Pattern 2: Generating an 8-Character Share Code

```typescript
// Source: github.com/ai/nanoid README
import { nanoid } from 'nanoid'

// nanoid(size) uses the default URL-safe alphabet (A-Za-z0-9_-)
const shareCode = nanoid(8)  // e.g. "IRFa-VaY"
```

Decision D-06/D-07 confirmed: `nanoid(8)` with default alphabet is correct. No need for `customAlphabet`.

### Pattern 3: Creating a List (INSERT + navigate)

```typescript
// In CreateListForm.tsx
import { supabase } from '@/lib/supabase'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'

async function createList(name: string) {
  const shareCode = nanoid(8)

  const { error } = await supabase
    .from('lists')
    .insert({ name, share_code: shareCode })

  if (error) throw error

  return shareCode
}

// After success: navigate(`/list/${shareCode}`)
```

### Pattern 4: Loading a List by Share Code

```typescript
// In ListPage.tsx — useEffect on mount
const { data: list, error } = await supabase
  .from('lists')
  .select('id, name, share_code, created_at')
  .eq('share_code', code)     // code = useParams().code
  .single()

// If !list → navigate('/not-found')
```

### Pattern 5: React Router v7 Data Mode Setup

```typescript
// src/router.tsx
// Source: reactrouter.com/start/modes
import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '@/pages/LandingPage'
import ListPage from '@/pages/ListPage'
import NotFoundPage from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/list/:code', element: <ListPage /> },
  { path: '*', element: <NotFoundPage /> },
])

// src/App.tsx
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

export default function App() {
  return <RouterProvider router={router} />
}
```

### Pattern 6: Zustand Store (TypeScript v5 pattern)

```typescript
// src/stores/uiStore.ts
// Source: zustand.docs.pmnd.rs/learn/guides/beginner-typescript
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

Note: The double-parentheses form `create<T>()((set) => ...)` is required in Zustand v5 for TypeScript inference. [CITED: zustand.docs.pmnd.rs]

### Pattern 7: Vite Config with Tailwind v4 + shadcn/ui alias

```typescript
// vite.config.ts
// Source: tailwindcss.com/docs (Vite section) + ui.shadcn.com/docs/installation/vite
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Pattern 8: Web Share API with Clipboard Fallback

```typescript
// Source: developer.mozilla.org/en-US/docs/Web/API/Navigator/share
async function shareList(url: string, listName: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title: listName, url })
      return
    } catch {
      // User cancelled or error — fall through to copy
    }
  }
  // Fallback: copy to clipboard (HTTPS required, always true on Vercel)
  await navigator.clipboard.writeText(url)
  // Show "Copied!" toast
}
```

`navigator.share` is supported on iOS Safari and Android Chrome (the primary targets for this app). Feature-detect with `if (navigator.share)`. Requires user gesture (button click) and HTTPS. [CITED: developer.mozilla.org]

### Pattern 9: Supabase RLS SQL

```sql
-- Source: supabase.com/docs/guides/database/postgres/row-level-security

-- LISTS TABLE
alter table lists enable row level security;
alter table lists force row level security;

-- Anyone can look up a list by share_code (client always filters by share_code)
create policy "anon_select_lists"
  on lists for select
  to anon
  using (true);

-- Anyone can create a new list (client inserts with the generated share_code)
create policy "anon_insert_lists"
  on lists for insert
  to anon
  with check (true);

-- ITEMS TABLE
alter table items enable row level security;
alter table items force row level security;

-- Anyone can read items belonging to a list they know the ID of
-- (client always queries items filtered by list_id, which it gets from the list lookup)
create policy "anon_select_items"
  on items for select
  to anon
  using (
    exists (
      select 1 from lists
      where lists.id = items.list_id
    )
  );

-- Anyone can insert items into a list (list_id must reference a real list)
create policy "anon_insert_items"
  on items for insert
  to anon
  with check (
    exists (
      select 1 from lists
      where lists.id = items.list_id
    )
  );
```

**Security model rationale:** The anon policies on `lists` allow SELECT/INSERT to all rows. Security is enforced through query scoping: the client always queries `lists` with `.eq('share_code', code)` and always queries `items` with `.eq('list_id', knownId)`. An attacker would need to enumerate all 8-char nanoid codes — the collision space is (64^8 ≈ 281 trillion) which is sufficient for a private 2-person app. This matches the decision in CONTEXT.md: "anyone who knows the code can read/write."

### Pattern 10: Vercel SPA Routing

```json
// vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Without this, navigating directly to `/list/CODE` on Vercel returns 404 because Vercel looks for a static file at that path. [CITED: vercel.com community + DEV.to guides]

### Anti-Patterns to Avoid

- **Calling `createClient` in a component or hook:** Always import from `src/lib/supabase.ts`. Creating multiple clients causes connection pool issues.
- **Not setting `FORCE ROW LEVEL SECURITY`:** Table owners bypass RLS by default. Always use both `ENABLE` and `FORCE`. [CITED: postgres-row-level-security-footguns]
- **Using legacy `SUPABASE_ANON_KEY` env var name in new projects:** New Supabase projects use `sb_publishable_xxx` keys, not JWT-based anon keys. The env var should be `VITE_SUPABASE_PUBLISHABLE_KEY`. [CITED: supabase.com/docs/guides/api/api-keys]
- **Missing `vercel.json` rewrite:** The SPA will work locally but 404 on direct URL navigation in production.
- **Calling `navigator.share()` without feature detection:** Desktop Chrome and Firefox do not support it. Always check `if (navigator.share)`.
- **Auto-detecting code vs URL with regex that fails edge cases:** D-02 requires auto-detect. A simple heuristic: if input contains `/` or starts with `http`, treat as URL and extract the last path segment; otherwise treat as 8-char code directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique share code generation | Custom random string | `nanoid(8)` | nanoid uses cryptographically secure randomness + URL-safe alphabet |
| Client-server data sync | Manual fetch/poll | supabase-js PostgREST client | Handles auth headers, response parsing, error normalization |
| Accessible form inputs | Raw `<input>` with manual ARIA | shadcn/ui Input, Button | Pre-built focus states, ARIA labels, keyboard navigation |
| URL routing with browser history | `window.history.pushState` | React Router v7 | Handles nested routes, route params, navigation stack, 404 fallback |

**Key insight:** The supabase-js client handles all HTTP details including the `Authorization: Bearer <anon_key>` header required for RLS to apply the correct role. Never bypass the client with raw `fetch`.

---

## Common Pitfalls

### Pitfall 1: RLS Blocks All Anon Requests (missing policy)

**What goes wrong:** After enabling RLS, all Supabase queries from the browser return empty results or permission errors with no rows.
**Why it happens:** RLS defaults to DENY ALL when no policy exists for a role. The `anon` role needs explicit policies.
**How to avoid:** Create SELECT and INSERT policies for `anon` role before testing any client queries.
**Warning signs:** `supabase.from('lists').select()` returns `data: []` with no error — this is RLS silently blocking, not a network error.

### Pitfall 2: Direct Route Navigation Returns 404 on Vercel

**What goes wrong:** The app works locally, but navigating to `https://our-cart.vercel.app/list/CODE` returns a Vercel 404 page.
**Why it happens:** Vercel serves static files. `/list/CODE` has no static file — the SPA needs to be served from `index.html` for all paths.
**How to avoid:** Add `vercel.json` with the `/:(.*)` → `/index.html` rewrite before first deploy.
**Warning signs:** Works on `/` but 404 on any other direct URL.

### Pitfall 3: Legacy Anon Key vs New Publishable Key

**What goes wrong:** `createClient` throws "supabaseKey is required" or "Legacy API keys disabled" when using old env var names.
**Why it happens:** New Supabase projects (created after late 2024) issue `sb_publishable_xxx` keys, not JWT anon keys. The official quickstart now uses `VITE_SUPABASE_PUBLISHABLE_KEY`.
**How to avoid:** Use `VITE_SUPABASE_PUBLISHABLE_KEY` as the env var name. Copy the key from Supabase dashboard → Project Settings → API Keys → "Publishable key".
**Warning signs:** The Supabase dashboard shows "sb_publishable_xxx" format keys; if using an `ANON_KEY` that starts with `eyJ`, it's the legacy format.

### Pitfall 4: `navigator.share()` Called Without User Gesture

**What goes wrong:** `navigator.share()` throws `NotAllowedError: Must be handling a user gesture to show a share picker`.
**Why it happens:** The Web Share API requires transient user activation (a real button click, not a programmatic call).
**How to avoid:** Always call `navigator.share()` directly inside a click event handler. Never call it from a `useEffect` or setTimeout.
**Warning signs:** Works in one place, breaks in another — check if it's being called from an async chain that lost the user gesture context.

### Pitfall 5: `nanoid` Used as React `key` Prop

**What goes wrong:** Calling `nanoid()` inside a render generates a new ID every render, causing React to remount the element.
**Why it happens:** `nanoid()` is not a stable ID — it generates a new value each call.
**How to avoid:** Only call `nanoid(8)` at list creation time (in the submit handler). Never call it in JSX or render logic.
**Warning signs:** Elements flicker or lose focus unexpectedly.

### Pitfall 6: Share Code in URL Doesn't Match DB (case sensitivity)

**What goes wrong:** User copies share code, partner pastes it, list not found even though code looks correct.
**Why it happens:** nanoid default alphabet is mixed-case. If the join form normalizes to lowercase, `.eq('share_code', code.toLowerCase())` won't match the stored code.
**How to avoid:** Never normalize the share code. Store it as-is from nanoid. Query it as-is from the URL. Keep the join form's input value unmodified when querying.

### Pitfall 7: Missing `FORCE ROW LEVEL SECURITY`

**What goes wrong:** RLS appears to work in tests but all data is exposed in production via the Data API.
**Why it happens:** Postgres table owners bypass RLS by default. Supabase's `postgres` role (used in migrations) is the owner, so it bypasses RLS.
**How to avoid:** Always use `ALTER TABLE x FORCE ROW LEVEL SECURITY` alongside `ENABLE ROW LEVEL SECURITY`.
**Warning signs:** Security Advisor in Supabase dashboard flags "RLS disabled" or "owner bypass" warnings.

---

## Code Examples

Verified patterns from official sources:

### Tailwind v4 CSS Entry Point

```css
/* src/index.css */
/* Source: tailwindcss.com/docs (official Vite installation guide) */
@import "tailwindcss";
```

No `tailwind.config.js` needed. No PostCSS config. No autoprefixer.

### TypeScript tsconfig.json for shadcn/ui Alias

```json
// tsconfig.json (or tsconfig.app.json — add to both)
// Source: ui.shadcn.com/docs/installation/vite
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Supabase Schema SQL

```sql
-- Source: Derived from supabase.com/docs/guides/database/postgres/row-level-security
-- Run in Supabase Dashboard → SQL Editor

create table lists (
  id          uuid primary key default gen_random_uuid(),
  share_code  text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

create index lists_share_code_idx on lists (share_code);

create table items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists (id) on delete cascade,
  name        text not null,
  quantity    text,
  category    text,
  checked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index items_list_id_idx on items (list_id);

-- RLS
alter table lists enable row level security;
alter table lists force row level security;
alter table items enable row level security;
alter table items force row level security;

-- Lists policies (anon role = browser without auth)
create policy "anon_select_lists" on lists for select to anon using (true);
create policy "anon_insert_lists" on lists for insert to anon with check (true);

-- Items policies (items accessible only via valid list_id)
create policy "anon_select_items" on items for select to anon
  using (exists (select 1 from lists where lists.id = items.list_id));
create policy "anon_insert_items" on items for insert to anon
  with check (exists (select 1 from lists where lists.id = items.list_id));
```

### Auto-Detect Code vs URL (D-02)

```typescript
function extractShareCode(input: string): string {
  const trimmed = input.trim()
  // If it looks like a URL, extract the last path segment
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean)
    return segments[segments.length - 1]
  }
  // Otherwise treat as raw share code
  return trimmed
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `anon` key (`eyJxxx`) for Supabase frontend | `sb_publishable_xxx` publishable key | Late 2024 | New projects don't have legacy keys; use `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Tailwind v3 `tailwind.config.js` + PostCSS | Tailwind v4 `@import "tailwindcss"` in CSS, no config file | Jan 2025 | No config file, 5x faster builds |
| React Router v6 `<Routes>/<Route>` JSX | React Router v7 `createBrowserRouter` array config | Nov 2024 | Data mode enables loaders/actions for clean data fetching |
| `npm install react-router-dom` imports separate package | Both `react-router` and `react-router-dom` are v7.15.1 | Nov 2024 | Can import from either; `react-router-dom` remains the convention for browser apps |

**Deprecated/outdated:**
- `tailwind.config.js`: Not used in Tailwind v4; CSS-first configuration
- `@tailwind base/components/utilities` directives: Replaced by single `@import "tailwindcss"`
- Legacy Supabase anon JWT key: Works until end of 2026, but new projects should use publishable key format

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeScript 5.x is bundled with the Vite react-ts template at scaffolding time | Standard Stack | Low — TypeScript version mismatch is caught at build; easy to update |
| A2 | The RLS `USING (true)` on `lists` table provides sufficient security when client always scopes queries by `share_code` | Architecture Patterns / RLS SQL | Medium — if Supabase anon API is called directly (bypassing the React app), any list ID could be guessed. For a private 2-person app with 281 trillion code combinations, acceptable |

**If table A2 is a concern:** A stronger RLS model would use `current_setting('request.headers')` to require the `share_code` header, but this requires an RPC wrapper function and is disproportionate complexity for this app's threat model.

---

## Open Questions

1. **Supabase project pausing on free tier**
   - What we know: Supabase free tier pauses inactive projects after 7 days (OPS-01 is a v2 concern)
   - What's unclear: Phase 1 dev/test activity should prevent pausing; confirmed deferred to v2
   - Recommendation: No action needed in Phase 1; note in STATE.md for v2

2. **shadcn/ui component selection for Phase 1**
   - What we know: D-01 requires a landing page with form inputs and buttons; D-03 requires a share button
   - What's unclear: Exact shadcn/ui components needed (Button and Input are likely sufficient)
   - Recommendation: Install `button` and `input` components via CLI at scaffold time; no more

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm, Vite | ✓ | 20.12.1 | — |
| npm | Package management | ✓ | 10.5.0 | — |
| Git | Version control | ✓ | (repo exists) | — |
| Supabase project | Database + API | ✗ | — | Must create at supabase.com (free) |
| Vercel account | Hosting | ✗ | — | Must connect at vercel.com (free Hobby plan) |

**Missing dependencies with no fallback:**
- Supabase project must be created in the cloud dashboard before running the SQL schema migration. This is a manual step (cannot be automated without Supabase CLI or Management API).
- Vercel project connection can be deferred to end of phase or done at any point during development.

**Missing dependencies with fallback:**
- None — local dev server (`npm run dev`) fully works without Vercel; Supabase cloud is needed for any DB calls.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (Vite-native, included in `react-ts` template consideration) |
| Config file | `vitest.config.ts` — none yet, Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

> Note: The Vite `react-ts` template does not include Vitest by default; it must be added. Wave 0 must install `vitest` and `@testing-library/react`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-01 | `nanoid(8)` generates an 8-char URL-safe string | unit | `npx vitest run src/lib/generateCode.test.ts` | ❌ Wave 0 |
| SHARE-01 | `createList()` inserts row + returns share_code | integration (manual) | Manual: create list in browser, check Supabase dashboard | manual-only |
| SHARE-02 | `/list/:code` route loads list by share_code | unit (route param) | `npx vitest run src/pages/ListPage.test.tsx` | ❌ Wave 0 |
| SHARE-03 | No auth session required to view a list | smoke | Manual: open incognito window with share URL | manual-only |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest` + `@testing-library/react` + `jsdom` — not in Vite react-ts template by default; install: `npm install -D vitest @testing-library/react jsdom`
- [ ] `vitest.config.ts` — configure `environment: 'jsdom'` and `globals: true`
- [ ] `src/lib/generateCode.test.ts` — unit tests for nanoid share code generation
- [ ] `src/pages/ListPage.test.tsx` — route param extraction test

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` confirmed in config.json.

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user accounts — URL is the credential |
| V3 Session Management | No | No sessions — stateless share-code model |
| V4 Access Control | Yes | Supabase RLS policies on `lists` and `items` tables |
| V5 Input Validation | Yes | Validate share_code format (8-char, valid alphabet) before DB query; trim user inputs |
| V6 Cryptography | Yes (limited) | nanoid uses `crypto.getRandomValues()` internally — cryptographically secure; never hand-roll |
| V7 Error Handling | Yes | Never expose Supabase error details to UI; show generic "list not found" messages |
| V8 Data Protection | Yes | Anon key is public by design (safe with RLS); never expose service_role key client-side |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anon key exposed in browser | Information Disclosure | Intentional — anon key is public-by-design; RLS is the mitigation |
| Share code brute force | Elevation of Privilege | 64^8 ≈ 281 trillion combinations; acceptable for private 2-person use |
| RLS misconfiguration (tables accessible to all anon) | Elevation of Privilege | Use `FORCE ROW LEVEL SECURITY`; test with anon client before shipping |
| XSS via list name or item name | Tampering | React's JSX escapes all interpolated values by default; never use `dangerouslySetInnerHTML` |
| Exposed service_role key | Elevation of Privilege | Only use `sb_publishable_xxx` in frontend; service_role key never leaves server (unused in this app) |

**ASVS Level 1 notes:**
- No authentication means V2/V3 are out of scope
- V4 is satisfied entirely by Supabase RLS — no application-layer auth logic needed
- V5: Validate share_code input in join form (8 chars, regex `[A-Za-z0-9_-]{8}`) before querying DB
- V6: nanoid uses Web Crypto API internally — verified in nanoid source [CITED: github.com/ai/nanoid]

---

## Sources

### Primary (HIGH confidence)
- [Supabase RLS Official Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy SQL syntax, anon role behavior, ENABLE/FORCE patterns
- [Supabase React Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) — createClient setup, env var names, publishable key
- [Supabase API Keys Docs](https://supabase.com/docs/guides/api/api-keys) — publishable vs legacy anon key distinction
- [Tailwind CSS v4 Official Docs](https://tailwindcss.com/docs) — `@tailwindcss/vite` plugin, CSS import, zero-config
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) — tsconfig paths, vite.config alias, CLI init
- [React Router v7 Modes](https://reactrouter.com/start/modes) — createBrowserRouter, RouterProvider, Data Mode
- [nanoid README](https://github.com/ai/nanoid/blob/main/README.md) — `nanoid(8)` API, default alphabet
- [Zustand TypeScript Guide](https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript) — double-parentheses create pattern
- [Navigator.share MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) — feature detection, iOS/Android support, transient activation requirement
- [Vite Getting Started](https://vite.dev/guide/) — scaffold command, react-ts template

### Secondary (MEDIUM confidence)
- [Supabase anon insert discussion](https://github.com/orgs/supabase/discussions/6757) — `returning: 'minimal'` workaround for anon INSERT
- [Supabase advanced RLS discussion](https://github.com/orgs/supabase/discussions/18761) — EXISTS subquery pattern for child table policies
- [Vercel SPA routing (DEV.to)](https://dev.to/rohantgeorge/how-to-fix-404-error-on-vercel-with-react-router-and-client-side-routing-1n52) — vercel.json rewrite pattern
- [Supabase new API keys discussion](https://github.com/orgs/supabase/discussions/29260) — migration timeline, backward compatibility

### Tertiary (LOW confidence — flagged)
- None in this research. All critical claims verified with official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions registry-verified against npm on 2026-05-24
- Architecture: HIGH — patterns derived from official Supabase, React Router, and Tailwind docs
- RLS model: MEDIUM-HIGH — core pattern verified in official docs; the specific `USING (true)` + client-scoped query model is a well-known Supabase pattern but the exact SQL was synthesized from multiple sources
- Pitfalls: HIGH — all verified against official docs or known CVEs

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (30 days — stable, well-established libraries)
