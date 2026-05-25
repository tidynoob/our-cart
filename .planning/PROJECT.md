# Our Cart

## What This Is

A shared grocery list web app for couples. Two people share a single list in real-time — add items, see updates instantly, and check off items as they're bought. Phone-first design, works on desktop too.

## Core Value

Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Real-time shared grocery list between two users
- [ ] Add items with name (required), quantity and category (optional)
- [ ] Check off items when bought (stays visible crossed out)
- [ ] Clear checked-off items (removes from both views)
- [ ] Share list via link or code — no account creation needed
- [ ] Phone-first responsive design
- [ ] Instant sync — changes appear within seconds

### Out of Scope

- Multiple lists — start with one, revisit later
- User accounts/authentication — shared link access only
- Offline mode/PWA — requires internet connection
- Aisle mapping/store layout — categories are simple grouping only
- Recipe integration — this is a list, not a meal planner

## Context

- Two-person household use case (Mitch + wife)
- Primary use: one person plans at home, the other shops at store
- Phone is the primary device (used while walking store aisles)
- Needs to be fast and frictionless — competing with a paper list
- Free-tier cloud hosting (Vercel/Railway/Supabase)
- No tech stack preference — pick what fits

## Constraints

- **Budget**: Free tier hosting only — $0/month operational cost
- **Users**: Optimized for 2 concurrent users (not a public/multi-tenant app)
- **Device**: Must work well on mobile browsers (Chrome, Safari)
- **Simplicity**: Must be simpler than existing grocery apps or there's no point

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No auth — shared link access | Two-person private use, minimize friction | — Pending |
| Real-time sync over polling | Core value depends on instant updates | — Pending |
| Check-off-then-clear flow | Lets both people see what was bought before clearing | — Pending |
| Single list for v1 | Keep scope minimal, validate core value first | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-24 after initialization*
