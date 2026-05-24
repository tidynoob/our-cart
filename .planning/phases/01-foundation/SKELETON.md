# Walking Skeleton — Our Cart

**Phase:** 1
**Generated:** 2026-05-24

## Capability Proven End-to-End

A user creates a named grocery list in the browser, receives an 8-character shareable URL, and their partner opens that URL to see the same list — no accounts, no backend, just a Supabase query gated by the share code in the URL.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | React 19 + Vite 8 (SPA) | No SSR needed — real-time collab is client-driven; Vite HMR under 50ms; React 19 Actions API reduces mutation boilerplate |
| Routing | React Router v7 createBrowserRouter | Data mode supports loaders/actions; `/list/:code` route param drives list lookup; `vercel.json` rewrite serves `index.html` for all paths |
| Data layer | Supabase PostgREST (supabase-js 2.x) | Single free-tier service covers Postgres + Realtime WebSockets; anon client is public-by-design; RLS enforces access |
| Auth / credential model | Share code in URL (`/list/CODE`) | No user accounts; URL is the sole credential; 8-char nanoid (64^8 ≈ 281T combinations); RLS enforces scoping by share_code |
| Realtime | Supabase Realtime (Phase 4) | WebSocket broadcast already bundled with Supabase; no additional service needed |
| Client state | Zustand 5.x | Ephemeral UI state (banner dismissed); 3KB bundle; TypeScript inference via double-parentheses create pattern |
| Styling | Tailwind CSS v4 + selective shadcn/ui | v4 CSS-first (no config file); mobile-first utilities; shadcn/ui for Button and Input accessibility primitives only |
| Deployment target | Vercel Hobby (static SPA) | Free tier, global CDN, instant git deploys; `vercel.json` rewrite required for client-side routing |
| Directory layout | Feature-adjacent under `src/` | `src/pages/` for routes, `src/components/` for UI, `src/lib/` for singletons and utilities, `src/stores/` for Zustand |
| ID generation | `nanoid(8)` default alphabet | Cryptographically secure (Web Crypto API); URL-safe alphabet `A-Za-z0-9_-`; 8 chars sufficient for private 2-person use |

## Stack Touched in Phase 1

- [x] Project scaffold — Vite react-ts template, all dependencies installed, TypeScript + Tailwind v4 configured, `@` alias set
- [x] Routing — React Router v7 with `/`, `/list/:code`, and `*` routes; `vercel.json` SPA rewrite
- [x] Database — Supabase `lists` table INSERT (create list) + SELECT by share_code (load list); RLS enabled and forced on both tables
- [x] UI — CreateListForm wired to Supabase INSERT + navigate; JoinListForm wired to navigate; ShareBanner with clipboard copy + Web Share API; ListPage loads list from DB
- [x] Deployment config — `vercel.json` rewrite in place; `.env.local.example` documents required env vars

## Out of Scope (Deferred to Later Slices)

- Item CRUD — add, edit, delete grocery items (Phase 2)
- Who-added-this attribution — device ID via localStorage (Phase 2)
- Category grouping and sorting (Phase 2)
- Check off / uncheck / clear completed items (Phase 3)
- Supabase Realtime WebSocket subscription (Phase 4)
- Mobile UX polish, autocomplete, 44px tap targets (Phase 5)
- Supabase keep-alive for free-tier pause prevention (v2)
- Presence indicator showing partner is viewing (v2)
- Multiple lists per user (out of scope for v1)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Users can add, edit, delete, and view grocery items with category grouping and device attribution
- Phase 3: Users can check off items while shopping and clear completed items with confirmation
- Phase 4: Changes on one device appear on the other within 2 seconds via Supabase Realtime WebSockets, including reconnection after mobile screen lock
- Phase 5: Phone-first polish — item autocomplete, 44px tap targets, under-3-tap add flow, full responsive layout
