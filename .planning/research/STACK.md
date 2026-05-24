# Technology Stack

**Project:** Our Cart — Shared Grocery List
**Researched:** 2026-05-24
**Overall Confidence:** HIGH (all major choices verified against official docs and current npm)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.2.6 | UI framework | Industry standard, React 19 Actions API reduces boilerplate for mutations like adding/checking items; React 19 compiler eliminates manual memoization |
| Vite | 8.0.14 | Build tool + dev server | HMR under 50ms, zero-config for SPA, no SSR complexity needed for this app. State of JS 2024 ranks it #1 most-loved build tool |
| TypeScript | 5.x (bundled with Vite template) | Type safety | Catch bugs at compile time; Vite's react-ts template includes it at no setup cost |

**Why not Next.js:** This app is a pure SPA — no SEO requirements, no public-facing content pages, no need for SSR or SSG. Next.js adds App Router complexity, React Server Components ceremony, and a deployment dependency on Vercel's serverless infrastructure. Vite + React is the right tool for a client-rendered, real-time collaborative app. The 17% negative sentiment toward Next.js in State of JS 2024 reflects exactly this over-engineering pattern.

### Backend / Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | @supabase/supabase-js 2.106.1 | Postgres DB + real-time WebSockets | Single free-tier service covers both data persistence (Postgres) and real-time sync (WebSocket broadcast). 200 concurrent connections, 2M messages/month on free tier — absurd headroom for a 2-person app |

**Why Supabase over Firebase:** Supabase uses Postgres (structured, queryable, schemas), is open-source (no vendor lock-in), broadcasts changes in under 50ms latency, and the free tier is commercially usable. Firebase's Realtime Database is NoSQL document-based and removed Cloud Storage from the free Spark plan in February 2026.

**Why Supabase over Liveblocks:** Liveblocks is specialized for collaborative editing (cursors, presence). A grocery list does not need cursor tracking or conflict-resolution CRDTs — it needs a list in a database and a WebSocket to push updates. Supabase covers both without the cost or complexity overhead.

**Real-time mechanism to use:** Supabase Realtime **Postgres Changes** (not Broadcast). Subscribe to `INSERT`, `UPDATE`, `DELETE` events on the `items` table. This means the database is always authoritative — no manual state reconciliation needed between the two clients. Broadcast (ephemeral peer-to-peer) is for transient events (typing indicators, cursors) that don't need persistence; Postgres Changes is the right primitive for a list where data must survive page refresh.

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.13 | Client-side UI state | Manages ephemeral UI state (modal open/closed, optimistic check-off). Tiny bundle (~3KB), no boilerplate, works with React 19. For a 2-user app, global client state is minimal |
| React built-ins (useState, useReducer) | n/a | Component-local state | Form state, input values — no library needed |

**Why not TanStack Query:** TanStack Query excels at cache management for REST/GraphQL APIs where you're polling or paginating. With Supabase Realtime pushing changes via WebSocket, the database state flows directly into component state via subscription callbacks — there is no polling layer for TanStack Query to optimize. It would add ~14KB and an abstraction layer for no gain. Use TanStack Query if this ever grows into a multi-list app with complex data fetching.

**Why not Redux:** Redux is for complex state machines across large teams. A grocery list with 2 users has no coordination problem complex enough to justify Redux's boilerplate and mental model overhead.

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.3.0 | Utility-first CSS | v4 is CSS-first (no tailwind.config.js), builds are 5x faster than v3, zero-config Vite integration. Mobile-first utilities are ideal for a phone-primary app |
| shadcn/ui (selective) | latest (CLI-installed) | Pre-built accessible components | Use only for specific components that need accessibility primitives: Dialog, Checkbox, Input. Do NOT import the full library — copy in only what is needed. Built on Radix UI, fully Tailwind v4 and React 19 compatible |

**Why not a full component library (MUI, Chakra, Ant Design):** These bring hundreds of components, their own design systems, and heavy bundles. This app needs fewer than 10 UI components. Using a full library would make it harder, not easier, to achieve the "simpler than existing grocery apps" goal.

**Why Tailwind v4 over v3:** The CSS-first configuration is a better mental model, the performance improvements are material, and all new projects should start on v4. shadcn/ui's CLI fully supports Tailwind v4 initialization.

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel (Hobby plan) | n/a | Static frontend hosting + CDN | Free, 1M function invocations/month, 100GB bandwidth, global CDN, instant deploys from Git push. Non-commercial personal use is explicitly allowed |
| Supabase (Free tier) | n/a | Postgres database + Realtime | 500MB database, 5GB egress, 200 concurrent Realtime connections, 2M messages/month. A 2-person grocery list will never approach any of these limits |

**Free tier math for this project:**
- Storage: A grocery list with 50 items at ~500 bytes each = 25KB. Supabase limit is 500MB. Headroom: 20,000x.
- Realtime connections: 2 concurrent users. Limit: 200. Headroom: 100x.
- Vercel bandwidth: A ~150KB SPA bundle. Limit: 100GB/month. Would require 666,667 full page loads to approach the limit.

**Free tier risk:** Supabase free projects **pause after 1 week of inactivity**. This is the most likely operational pain point. Mitigation: keep the project active via a scheduled Supabase Edge Function ping (free) or use the free tier "no-pause" workaround by visiting the Supabase dashboard periodically.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.x (latest: 5.1.11) | Generate unique share codes | Create the shareable list ID (e.g., `our-cart.app/list/V1StGXR8`) when a new list is created. URL-friendly, cryptographically secure, 21-char default is collision-resistant |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | React + Vite | Next.js | SSR/SSG complexity not needed; no SEO requirements; SPA is correct for real-time collab |
| Real-time | Supabase Realtime | Firebase Realtime DB | Firebase removed free Storage; NoSQL less ergonomic for a structured list; Supabase has lower latency (50ms vs 80ms) |
| Real-time | Supabase Realtime | Liveblocks | Overkill for a list app; adds cost ceiling; Supabase already covers persistence + sync |
| Real-time | Supabase Realtime | Ably / Pusher | Both require paid tiers for any sustained usage; Supabase is the only option that bundles database + websockets free |
| Styling | Tailwind v4 + selective shadcn/ui | MUI / Chakra / Ant Design | Full component libraries are 5-10x heavier; impose design systems at odds with "simpler than existing apps" |
| State | Zustand | TanStack Query | Query is for server-state cache management; Supabase push model makes polling unnecessary |
| State | Zustand | Redux Toolkit | 10x the boilerplate for a 2-user app; Zustand covers all needs at ~3KB |
| Hosting | Vercel | Railway | Railway free tier limited to 500 hours/month execution (compute-based, not static). Static SPA on Vercel is always-on |
| Hosting | Vercel | Netlify | Both are valid free-tier static hosts; Vercel has better DX for Vite + native CDN performance. Either works |
| ID generation | nanoid | crypto.randomUUID() | `crypto.randomUUID()` is built-in and fine, but nanoid produces shorter, more URL-friendly codes by default |

---

## Installation

```bash
# Scaffold project
npm create vite@latest our-cart -- --template react-ts
cd our-cart

# Core dependencies
npm install @supabase/supabase-js zustand nanoid

# Tailwind v4
npm install tailwindcss @tailwindcss/vite

# shadcn/ui (CLI-driven, installs components individually)
npx shadcn@latest init
# Then add specific components only as needed:
# npx shadcn@latest add checkbox
# npx shadcn@latest add dialog
# npx shadcn@latest add input
```

---

## Key Architecture Decisions Driven by Stack Choice

1. **No backend API layer needed.** Supabase client SDK talks directly to Postgres via the auto-generated REST API (PostgREST) and to Realtime via WebSocket. There is no Node.js/Express server to build or host.

2. **No auth library needed.** The share code (nanoid) embedded in the URL is the access control mechanism. Supabase Row Level Security (RLS) must be configured to allow `anon` role SELECT/INSERT/UPDATE/DELETE on the items table for rows matching the list ID. This is the "public read/write scoped by list ID" RLS pattern — simpler than auth but still protected from cross-list access.

3. **Real-time update flow:** Supabase Postgres Changes subscription fires on INSERT/UPDATE/DELETE -> callback updates Zustand store -> React re-renders affected components. No polling. No manual reconciliation.

4. **Vercel deployment:** `vite build` produces a static `/dist` folder. Vercel serves it from CDN. Zero serverless functions needed for v1 — all logic runs in the browser against Supabase directly.

---

## Sources

- Vite 8 release announcement: https://vite.dev/blog/announcing-vite8
- React 19 versions: https://react.dev/versions
- Supabase Realtime limits (official docs): https://supabase.com/docs/guides/realtime/pricing
- Supabase Realtime Broadcast API (official docs): https://supabase.com/docs/guides/realtime/broadcast
- Supabase free tier limits: https://supabase.com/pricing
- Vercel Hobby plan (official docs, updated 2026-02-27): https://vercel.com/docs/plans/hobby
- Tailwind CSS v4.0 announcement: https://tailwindcss.com/blog/tailwindcss-v4
- shadcn/ui Tailwind v4 support: https://ui.shadcn.com/docs/tailwind-v4
- nanoid GitHub: https://github.com/ai/nanoid
- TanStack Query v5: https://tanstack.com/query/latest
- Supabase free tier pause behavior: https://supabase.com/pricing
- Supabase RLS securing API: https://supabase.com/docs/guides/api/securing-your-api
- State of JavaScript 2024 (Vite #1 most-loved build tool): referenced via https://strapi.io/blog/vite-vs-nextjs-2025-developer-framework-comparison
