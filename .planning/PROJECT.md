# Our Cart

## What This Is

A shared grocery list web app for couples. Two people share a single list in real-time — add items, see updates instantly, and check off items as they're bought. Phone-first design, works on desktop too. Deployed on Vercel with Supabase backend.

## Core Value

Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.

## Requirements

### Validated

- Real-time shared grocery list between two users — v1.0
- Add items with name (required), quantity and category (optional) — v1.0
- Edit and delete existing items — v1.0
- Items display who added them (color-coded attribution) — v1.0
- Items auto-sort by category — v1.0
- Previously added items appear as autocomplete suggestions — v1.0
- Check off items when bought (stays visible crossed out) — v1.0
- Clear checked-off items with confirmation dialog — v1.0
- Share list via URL link — no account creation needed — v1.0
- Phone-first responsive design with 44px tap targets — v1.0
- Real-time sync — changes appear within 2 seconds — v1.0
- Offline detection and automatic reconnection — v1.0
- Connection status indicator (Live/Reconnecting) — v1.0

### Active

(No active requirements — next milestone not yet planned)

### Out of Scope

- Multiple lists — one shared list is the core value for v1
- User accounts/authentication — shared link access only, minimal friction
- Offline mode/PWA — requires complex sync conflict resolution; internet required
- Aisle mapping/store layout — categories are simple grouping only
- Recipe integration — this is a list, not a meal planner
- Push notifications — real-time sync on screen is sufficient
- Barcode scanning — name + qty sufficient for grocery list
- Voice assistant integration — high complexity, niche usage

## Context

Shipped v1.0 MVP in 3 days (2026-05-24 → 2026-05-26).
Tech stack: React 19 + Vite 8 + Supabase (Postgres + Realtime) + Tailwind v4 + Zustand.
3,888 LOC TypeScript across 37 source files. 19 plans across 5 phases.
Hosted on Vercel (free tier) + Supabase (free tier). $0/month operational cost.

Two-person household use case (Mitch + wife). Primary use: one person plans at home, the other shops at store. Phone is primary device.

## Constraints

- **Budget**: Free tier hosting only — $0/month operational cost
- **Users**: Optimized for 2 concurrent users (not a public/multi-tenant app)
- **Device**: Must work well on mobile browsers (Chrome, Safari)
- **Simplicity**: Must be simpler than existing grocery apps or there's no point

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No auth — shared link access | Two-person private use, minimize friction | Good |
| Real-time sync over polling | Core value depends on instant updates | Good |
| Check-off-then-clear flow | Lets both people see what was bought before clearing | Good |
| Single list for v1 | Keep scope minimal, validate core value first | Good |
| React 19 + Vite 8 + Supabase stack | Free tier covers all needs; React 19 Actions reduce boilerplate | Good |
| Subscribe-before-fetch for Realtime | Prevents missed events during initial load | Good |
| Optimistic mutations with per-item rollback | Responsive UX without complex conflict resolution | Good |
| Belt-and-suspenders offline detection | Window events + mutation error guards cover all network failure modes | Good |
| nanoid(8) for share codes | URL-friendly, collision-resistant, shorter than UUID | Good |
| No debounce on autocomplete | O(n) filter on cached small list is imperceptible | Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason
2. Requirements validated? Move to Validated with phase reference
3. New requirements emerged? Add to Active
4. Decisions to log? Add to Key Decisions
5. "What This Is" still accurate? Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-26 after v1.0 milestone*
