<!-- GSD:project-start source:PROJECT.md -->
## Project

**Our Cart**

A shared grocery list web app for couples. Two people share a single list in real-time — add items, see updates instantly, and check off items as they're bought. Phone-first design, works on desktop too.

**Core Value:** Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.

### Constraints

- **Budget**: Free tier hosting only — $0/month operational cost
- **Users**: Optimized for 2 concurrent users (not a public/multi-tenant app)
- **Device**: Must work well on mobile browsers (Chrome, Safari)
- **Simplicity**: Must be simpler than existing grocery apps or there's no point
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.2.6 | UI framework | Industry standard, React 19 Actions API reduces boilerplate for mutations like adding/checking items; React 19 compiler eliminates manual memoization |
| Vite | 8.0.14 | Build tool + dev server | HMR under 50ms, zero-config for SPA, no SSR complexity needed for this app. State of JS 2024 ranks it #1 most-loved build tool |
| TypeScript | 5.x (bundled with Vite template) | Type safety | Catch bugs at compile time; Vite's react-ts template includes it at no setup cost |
### Backend / Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | @supabase/supabase-js 2.106.1 | Postgres DB + real-time WebSockets | Single free-tier service covers both data persistence (Postgres) and real-time sync (WebSocket broadcast). 200 concurrent connections, 2M messages/month on free tier — absurd headroom for a 2-person app |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.13 | Client-side UI state | Manages ephemeral UI state (modal open/closed, optimistic check-off). Tiny bundle (~3KB), no boilerplate, works with React 19. For a 2-user app, global client state is minimal |
| React built-ins (useState, useReducer) | n/a | Component-local state | Form state, input values — no library needed |
### Styling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.3.0 | Utility-first CSS | v4 is CSS-first (no tailwind.config.js), builds are 5x faster than v3, zero-config Vite integration. Mobile-first utilities are ideal for a phone-primary app |
| shadcn/ui (selective) | latest (CLI-installed) | Pre-built accessible components | Use only for specific components that need accessibility primitives: Dialog, Checkbox, Input. Do NOT import the full library — copy in only what is needed. Built on Radix UI, fully Tailwind v4 and React 19 compatible |
### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel (Hobby plan) | n/a | Static frontend hosting + CDN | Free, 1M function invocations/month, 100GB bandwidth, global CDN, instant deploys from Git push. Non-commercial personal use is explicitly allowed |
| Supabase (Free tier) | n/a | Postgres database + Realtime | 500MB database, 5GB egress, 200 concurrent Realtime connections, 2M messages/month. A 2-person grocery list will never approach any of these limits |
- Storage: A grocery list with 50 items at ~500 bytes each = 25KB. Supabase limit is 500MB. Headroom: 20,000x.
- Realtime connections: 2 concurrent users. Limit: 200. Headroom: 100x.
- Vercel bandwidth: A ~150KB SPA bundle. Limit: 100GB/month. Would require 666,667 full page loads to approach the limit.
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.x (latest: 5.1.11) | Generate unique share codes | Create the shareable list ID (e.g., `our-cart.app/list/V1StGXR8`) when a new list is created. URL-friendly, cryptographically secure, 21-char default is collision-resistant |
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
## Installation
# Scaffold project
# Core dependencies
# Tailwind v4
# shadcn/ui (CLI-driven, installs components individually)
# Then add specific components only as needed:
# npx shadcn@latest add checkbox
# npx shadcn@latest add dialog
# npx shadcn@latest add input
## Key Architecture Decisions Driven by Stack Choice
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Generated by GSD from session_analysis. Run `/gsd-profile-user --refresh` to update.

| Dimension | Rating | Confidence |
|-----------|--------|------------|
| Communication | mixed | HIGH |
| Decisions | fast-intuitive | MEDIUM |
| Explanations | concise | MEDIUM |
| Debugging | diagnostic | MEDIUM |
| UX Philosophy | pragmatic | MEDIUM |
| Vendor Choices | pragmatic-fast | LOW |
| Frustrations | instruction-adherence | LOW |
| Learning | guided | MEDIUM |

**Directives:**
- **Communication:** Mirror the user's register per task: respond briefly to their terse commands, provide structured sectioned output when they send structured prompts, and engage conversationally when they think aloud about a problem. Do not impose heavy structure on quick execution requests.
- **Decisions:** Present a clear recommendation rather than open-ended option menus. When trade-offs matter, lead with your pick and a one-line rationale so the user can confirm fast.
- **Explanations:** Lead with the answer and a brief rationale. Keep explanations scoped to the task at hand; expand into deeper concept explanation only when the user asks a 'why/how' question, then stop. Be extremely concise per the user's stated preference.
- **Debugging:** When the user reports a bug with reproduction detail, briefly state the likely cause before applying the fix. Treat their behavioral descriptions as the spec and confirm root cause rather than only patching the symptom.
- **UX Philosophy:** Ensure UI flows are usable and behave correctly (loading, empty, multi-action states) without over-investing in visual polish unless asked. For frontend projects like our-cart, keep mobile-first usability in mind. Ask before adding decorative styling.
- **Vendor Choices:** Recommend a single well-justified library or integration and proceed once confirmed. Try leading with your default pick rather than a comparison table -- ask if the user wants alternatives weighed before committing.
- **Frustrations:** Follow stated constraints exactly (brevity, formatting, scope). When requirements are precise, do not deviate or add unrequested formatting. Try confirming you've met each stated constraint -- ask if precision expectations differ.
- **Learning:** When the user encounters something unfamiliar, explain it directly and concisely in the context of their current task. Provide the procedural how-to and clarify scope (global vs local, what affects what) without requiring them to read external docs first.
<!-- GSD:profile-end -->
