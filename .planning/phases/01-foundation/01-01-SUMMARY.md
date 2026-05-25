---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [vite, react, typescript, tailwind, supabase, vitest, shadcn, nanoid, zustand, react-router]

# Dependency graph
requires: []
provides:
  - Vite 5 + React 19 + TypeScript 5.8 SPA scaffold
  - Tailwind v4 configured via @tailwindcss/vite plugin
  - shadcn/ui button and input components
  - Supabase client singleton (src/lib/supabase.ts)
  - Vitest 3 test infrastructure with jsdom environment
  - vercel.json SPA routing rewrite
  - nanoid(8) unit tests (generateCode.test.ts)
  - .gitignore protecting .env.local
affects: [02, 03, phase-2, phase-3, phase-4, phase-5]

# Tech tracking
tech-stack:
  added:
    - "vite@5.4.21 (downgraded from 8.0.14 — Node 20.12.1 incompatible with Vite 8+rolldown)"
    - "@vitejs/plugin-react@4.7.0"
    - "react@19.2.6 + react-dom@19.2.6"
    - "typescript@5.8.3"
    - "@supabase/supabase-js@2.106.1"
    - "react-router-dom@7.15.1"
    - "nanoid@5.1.11"
    - "zustand@5.0.13"
    - "tailwindcss@4.3.0 + @tailwindcss/vite@4.3.0"
    - "shadcn/ui (button, input components via CLI)"
    - "vitest@3.2.4 + @testing-library/react@16.3.0 + jsdom@26.1.0"
  patterns:
    - "Supabase client singleton: import createClient once in src/lib/supabase.ts, export supabase"
    - "Env var guard: throw Error on missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY"
    - "@ alias: resolves to ./src in both vite.config.ts and tsconfig.app.json"
    - "Tailwind v4: single @import 'tailwindcss' in src/index.css, no tailwind.config.js"

key-files:
  created:
    - "package.json"
    - "vite.config.ts"
    - "tsconfig.json"
    - "tsconfig.app.json"
    - "tsconfig.node.json"
    - "vitest.config.ts"
    - "vercel.json"
    - ".env.local.example"
    - ".gitignore"
    - "index.html"
    - "components.json"
    - "src/main.tsx"
    - "src/App.tsx"
    - "src/index.css"
    - "src/lib/supabase.ts"
    - "src/lib/utils.ts"
    - "src/lib/generateCode.test.ts"
    - "src/components/ui/button.tsx"
    - "src/components/ui/input.tsx"
  modified: []

key-decisions:
  - "Downgraded Vite from 8.0.14 to 5.4.21 — Node v20.12.1 is incompatible with Vite 8's rolldown bundler which requires Node >=20.19.0. Vite 5 supports Node >=20.0.0 and is fully compatible with Tailwind v4, React 19, and all other stack dependencies."
  - "Added .gitignore (Rule 2) — no .gitignore existed in project root; threat model T-01-03 requires .env.local be excluded from git"
  - "shadcn/ui CLI installed additional deps: tw-animate-css, class-variance-authority, clsx, tailwind-merge, @base-ui/react, @fontsource-variable/geist, lucide-react"

patterns-established:
  - "Pattern: Supabase singleton — import from src/lib/supabase.ts, never call createClient in component"
  - "Pattern: @ alias — use @/lib/supabase not relative paths in src"
  - "Pattern: Tailwind v4 — @import 'tailwindcss' in CSS, no config file, no PostCSS"

requirements-completed: [SHARE-01, SHARE-02, SHARE-03]

# Metrics
duration: 7min
completed: 2026-05-24
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Vite 5 + React 19 SPA scaffold with Tailwind v4, shadcn/ui, Supabase client singleton (tables + RLS verified live), and Vitest test infrastructure — dev server ready, tests green, Supabase project provisioned**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-24T21:47:10Z
- **Completed:** 2026-05-24T21:54:10Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 23 files created

## Accomplishments
- Full Vite 5 + React 19 + TypeScript 5.8 SPA scaffold with all dependencies installed
- Tailwind v4 configured via `@tailwindcss/vite` plugin — single `@import "tailwindcss"` CSS entry point, no config file
- shadcn/ui Button and Input components installed via CLI (New York style)
- Supabase client singleton in `src/lib/supabase.ts` with env var guard (throws on missing vars)
- Vitest 3 configured for jsdom environment; 3 nanoid(8) unit tests passing
- `vercel.json` SPA routing rewrite in place for `/list/:code` paths
- `.gitignore` protecting `.env.local` from accidental commit (T-01-03 threat mitigation)

## Task Commits

1. **Task 1: Scaffold Vite project, install all dependencies, configure build** - `d6e9180` (feat)
2. **Task 2: Supabase setup** - COMPLETE (user action) — tables verified live against Supabase API

## Files Created/Modified
- `package.json` - Project manifest with all locked dependency versions
- `vite.config.ts` - Vite config: react() + tailwindcss() plugins, @ alias to ./src
- `tsconfig.json` + `tsconfig.app.json` - TypeScript config with baseUrl + paths for @ alias
- `vitest.config.ts` - Vitest config: jsdom environment, globals enabled, @ alias
- `vercel.json` - SPA routing rewrite: `/(.*) → /index.html`
- `.env.local.example` - Env var template (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
- `.gitignore` - Excludes .env.local, node_modules, dist from git
- `src/main.tsx` - ReactDOM.createRoot entry point with StrictMode
- `src/App.tsx` - Minimal shell component (Plan 02 replaces with RouterProvider)
- `src/index.css` - Tailwind v4 entry: `@import "tailwindcss"` + shadcn/ui theme variables
- `src/lib/supabase.ts` - Supabase client singleton with env var validation
- `src/lib/utils.ts` - shadcn/ui utility: cn() helper (clsx + tailwind-merge)
- `src/lib/generateCode.test.ts` - nanoid(8) unit tests (3 tests, all green)
- `src/components/ui/button.tsx` - shadcn/ui Button component (Radix-based)
- `src/components/ui/input.tsx` - shadcn/ui Input component (Radix-based)
- `components.json` - shadcn/ui CLI configuration file

## Decisions Made
- **Vite 5 instead of Vite 8:** Node v20.12.1 cannot run Vite 8 (requires Node >=20.19.0 for rolldown's native bindings). Downgraded to Vite 5.4.21 which supports Node >=20.0.0. All other stack dependencies (Tailwind v4, React 19, vitest, shadcn/ui) are fully compatible with Vite 5.
- **Added .gitignore:** Project had no .gitignore; created one to exclude .env.local (T-01-03 threat mitigation), node_modules, and dist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Downgraded Vite 8 to Vite 5 due to Node version incompatibility**
- **Found during:** Task 1 (build verification)
- **Issue:** Vite 8.0.14 uses rolldown bundler which requires Node >=20.19.0. Developer has Node v20.12.1. `npm run build` failed with `ERR_INVALID_ARG_VALUE` from rolldown's use of `util.styleText` with array arguments (Node 21+ API).
- **Fix:** Downgraded to vite@5.4.21 + @vitejs/plugin-react@4.7.0. All other deps unchanged. Build passes, vitest passes.
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run build` exits 0, `npx vitest run` exits 0 with 3 tests passing
- **Committed in:** d6e9180 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added .gitignore**
- **Found during:** Task 1 (pre-commit review)
- **Issue:** Project had no .gitignore. Threat model T-01-03 requires `.env.local` (containing Supabase keys) be excluded from git. Without .gitignore, `git add .` would include secrets.
- **Fix:** Created `.gitignore` with standard Vite project excludes plus explicit `.env.local` and `.env*.local` exclusions.
- **Files modified:** .gitignore (created)
- **Verification:** `.env.local` shows as excluded in `git status`
- **Committed in:** d6e9180 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary — Vite downgrade enables any local dev work; .gitignore is a security requirement. No scope creep.

## Issues Encountered
- `@rolldown/binding-win32-x64-msvc` optional dependency not auto-installed by npm on Node 20.12.1 — manually installing it showed the underlying Node version constraint. Resolved by switching to Vite 5 which uses Rollup (pure JS, no native binary dependency).

## User Setup Required

**Task 2 requires manual Supabase configuration.** This is a `checkpoint:human-action` task:

1. Go to https://supabase.com → New Project (free tier)
2. In SQL Editor, run the schema SQL from `.planning/phases/01-foundation/01-RESEARCH.md` (Supabase Schema SQL section)
3. Copy `.env.local.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Run `npm run dev` to verify no "Missing Supabase environment variables" error

The full SQL to run:
```sql
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

alter table lists enable row level security;
alter table lists force row level security;
alter table items enable row level security;
alter table items force row level security;

create policy "anon_select_lists" on lists for select to anon using (true);
create policy "anon_insert_lists" on lists for insert to anon with check (true);

create policy "anon_select_items" on items for select to anon
  using (exists (select 1 from lists where lists.id = items.list_id));
create policy "anon_insert_items" on items for insert to anon
  with check (exists (select 1 from lists where lists.id = items.list_id));
```

## Next Phase Readiness
- Task 1 complete: dev server ready (`npm run dev`), tests green, all config files in place
- Task 2 complete: Supabase project provisioned, `lists` and `items` tables created with RLS + 2 anon policies each, `.env.local` populated, tables verified live via API
- Plans 02 and 03 can proceed — all prerequisites met

---
*Phase: 01-foundation*
*Completed: 2026-05-24*

## Self-Check: PASSED

**Files verified:**
- `package.json` — FOUND
- `vite.config.ts` — FOUND
- `tsconfig.app.json` — FOUND
- `vitest.config.ts` — FOUND
- `vercel.json` — FOUND
- `src/lib/supabase.ts` — FOUND
- `src/lib/generateCode.test.ts` — FOUND
- `src/components/ui/button.tsx` — FOUND
- `src/components/ui/input.tsx` — FOUND
- `.gitignore` — FOUND
- `.env.local.example` — FOUND

**Commits verified:**
- `d6e9180` — FOUND (feat(01-01): scaffold Vite 5 project with all dependencies and config)
