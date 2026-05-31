# Milestones: Our Cart

## v2.0 Accounts & Multi-List — SHIPPED 2026-05-31

**Phases:** 5 (6-10) | **Plans:** 23 | **Commits:** 137 since v1.0 | **Timeline:** 2026-05-27 → 2026-05-31

**Delivered:** Transformed the anonymous single-list MVP into an authenticated multi-list app — Google sign-in, per-user named lists, sidebar navigation, profiles + item attribution, and per-list invite-link sharing gated by Supabase RLS membership.

**Key Accomplishments:**
1. Google OAuth sign-in (PKCE) with persistent sessions and route protection (AUTH-01/02/03)
2. Multi-list CRUD — create, rename, delete with confirmation (LIST-01/02/03)
3. Slide-in sidebar navigation with active-list highlight (NAV-01/02), re-expandable share header (NAV-03)
4. User profiles — display name edit, Google avatar, sign out — plus per-item attribution (PROF-01/02/03)
5. Per-list invite-link sharing with idempotent `redeem_invite` RPC and RLS membership isolation (SHARE-01/02)
6. Cross-account data-isolation leak (null-owner RLS branch) found in two-browser UAT and closed in 10-06

**Requirements:** 14/14 complete (100%)

**Verification at close:** `tsc --noEmit` clean · 166 unit tests green (22 files) · production build green · Phase 10 two-browser UAT 6/6 pass.

**Known deferred items at close:** 4 doc-status items (P07-P09 UAT/verification docs left un-flipped; equivalent browser behaviors exercised live in Phase 10 two-account UAT) — see STATE.md → Deferred Items. No functional gaps.

**Archive:** [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) | [v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md) | [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md)

---

## v1.0 MVP — SHIPPED 2026-05-26

**Phases:** 5 | **Plans:** 19 | **LOC:** 3,888 TypeScript | **Timeline:** 3 days

**Delivered:** A shared grocery list web app where two people can create, share, add items, check off while shopping, and see changes in real-time — all from a phone, no account needed.

**Key Accomplishments:**

1. Shared grocery list with create/join/share via URL — no auth needed (SHARE-01/02/03)
2. CRUD item management with category grouping and device attribution (LIST-01-06)
3. Check-off shopping flow with bulk clear and confirmation dialog (SHOP-01-04)
4. Real-time sync via Supabase Realtime with offline detection + reconnect (SYNC-01-03)
5. Phone-first UX: 44px tap targets, autocomplete suggestions, iOS meta tags (UX-01-03)

**Requirements:** 19/19 complete (100%)

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---
*Last updated: 2026-05-26*
