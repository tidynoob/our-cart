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

- Google OAuth sign-in (one-tap, PKCE) — v2.0 (AUTH-01/02/03)
- Editable user profile: display name, Google avatar, sign out — v2.0 (PROF-01/02/03)
- Multiple named lists — create, rename, delete — v2.0 (LIST-01/02/03)
- Slide-in sidebar navigation with active-list highlight — v2.0 (NAV-01/02/03)
- Per-list sharing via invite links + idempotent redeem — v2.0 (SHARE-01/02)
- Per-item attribution (Google avatar on own items) — v2.0 (PROF-02)
- RLS membership-based data isolation — v2.0 (hardened in 10-06 after cross-account leak)

### Active (v2.x — next milestone)

- [ ] Supabase keep-alive — prevent free-tier project pausing (OPS-01)
- [ ] Presence indicator — who's currently viewing the list (OPS-02)
- [ ] Item notes field (ITEM-01)
- [ ] Manual item reorder within a category (ITEM-02)
- [ ] Owner can remove a member from a shared list (MEMBER-01)
- [ ] Member can leave a shared list (MEMBER-02)

### Out of Scope

- ~~Multiple lists~~ — delivered in v2.0
- ~~User accounts/authentication~~ — delivered in v2.0 (Google OAuth)
- Email/password auth — Google OAuth only; one auth method
- More than 2 members per list — couples-focused, not a group app
- Granular permissions/RBAC — equal collaborators
- Email invitation sending — text the link; no SMTP
- Offline mode/PWA — requires complex sync conflict resolution; internet required
- Aisle mapping/store layout — categories are simple grouping only
- Recipe integration — this is a list, not a meal planner
- Push notifications — real-time sync on screen is sufficient
- Barcode scanning — name + qty sufficient for grocery list
- Voice assistant integration — high complexity, niche usage

## Context

Shipped v2.0 Accounts & Multi-List on 2026-05-31 (5 phases, 23 plans).
Tech stack: React 19 + Vite + TypeScript + Supabase (Postgres + Realtime + Auth) + Zustand + Tailwind v4 + shadcn/ui.
~3,375 LOC TypeScript across 39 source files; 166 unit tests (22 files); 5 SQL migrations.
Hosted on Vercel (free tier) + Supabase (free tier). $0/month operational cost.

<details>
<summary>v1.0 MVP (2026-05-26)</summary>

Shipped v1.0 MVP in 3 days (2026-05-24 → 2026-05-26). 3,888 LOC across 37 files, 19 plans across 5 phases. Anonymous URL-share grocery list with real-time sync.

</details>

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
| Google OAuth only (PKCE) — v2.0 | One auth method for a 2-person app; Supabase default | Good |
| RLS membership model over app-side owner filter — v2.0 | `is_list_member` (SECURITY DEFINER) gates rows; app filter removed (D-08) | Good — sole gate after 10-06 |
| Persistent (no-expiry) invite tokens — v2.0 | Household use, no churn | Good |
| `redeem_invite` inserts `auth.uid()` only, ON CONFLICT DO NOTHING — v2.0 | Idempotent join; no caller-supplied user_id | Good |
| Drop unconditional `owner_id IS NULL` RLS branch — v2.0 (10-06) | Closed cross-account leak unmasked when D-08 removed the app filter | ⚠️ Revisit — tighten `lists_insert` WITH CHECK; remove dead branches in `lists_auth.sql` |

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
*Last updated: 2026-05-31 after v2.0 milestone*
