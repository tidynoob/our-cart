# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-26
**Phases:** 5 | **Plans:** 19

### What Was Built
- Shared grocery list with URL-based access (no accounts)
- Full CRUD with category grouping, device attribution, and autocomplete
- Check-off shopping flow with bulk clear + confirmation
- Real-time sync via Supabase Realtime with offline detection and auto-reconnect
- Phone-first UX with 44px tap targets and iOS meta tags

### What Worked
- Wave-based planning (test stubs first, then implementation) kept phases clean and caught issues early
- Optimistic mutations with per-item rollback gave responsive UX without complexity
- Subscribe-before-fetch pattern for Realtime was correct from the start — no missed events
- Gap closure plans (2.1/2.2-style insertions) handled UAT bugs without derailing phase flow
- 3-day delivery from zero to deployed app with real-time sync

### What Was Inefficient
- SHARE-01/02/03 requirement checkboxes never got updated despite code being complete — bookkeeping drift
- Two gap closure plans in Phase 2 for UI bugs (@base-ui button type, Select portal blur) — both were framework-edge-case issues that could have been caught with earlier manual testing
- Debug session `syncstatus-no-reconnecting` was diagnosed and fixed but file status never updated to "resolved"

### Patterns Established
- Optimistic mutation pattern: snapshot state → set optimistic → await Supabase → rollback on error
- Subscribe-before-fetch for Supabase Realtime channels
- Belt-and-suspenders offline detection: window events + mutation error guards
- vi.hoisted() for Supabase channel mocks in Vitest
- Attribution color hash: average charcode (sum/length floor mod 2) for nickname-stable colors

### Key Lessons
1. Manual phone testing catches UI bugs that unit tests miss (portal blur, button type issues) — budget time for it early, not just end-of-phase
2. Requirement tracking checkboxes need to be updated at phase completion, not deferred to milestone close
3. Supabase Realtime heartbeat timeout (25-50s) creates a blind spot for brief network drops — mutation-level guards are necessary
4. For a 2-person app, the simplest auth model (URL = credential) works well and removes an entire category of complexity

---

## Milestone: v2.0 — Accounts & Multi-List

**Shipped:** 2026-05-31
**Phases:** 5 | **Plans:** 23

### What Was Built
- Google OAuth accounts (PKCE) replacing anonymous URL access; persistent sessions + route protection
- Multiple named lists per user with full CRUD
- Slide-in sidebar navigation with active-list highlight
- Profile (display name, Google avatar, sign out) and per-item attribution
- Per-list invite-link sharing with idempotent `redeem_invite` RPC, gated by Supabase RLS membership

### What Worked
- Wave 0 test scaffolds before implementation (carried from v1.0) kept every phase green — 166 tests at close
- SECURITY DEFINER helpers (`is_list_member`, invite lookup) cleanly sidestepped RLS recursion and the unauthenticated-invite catch-22
- Two-browser manual UAT was the *only* thing that caught the cross-account data-isolation leak — unit tests could not

### What Was Inefficient
- RLS layering bit back late: removing the app-side owner filter (D-08) unmasked a latent `owner_id IS NULL` leak in policies written back in Phase 6 — cost a full gap-closure cycle (10-06) at the end of the milestone
- Doc-status hygiene drifted: phases 7-9 shipped functionally but left UAT/verification docs at `human_needed`/`testing`, forcing an acknowledge step at close

### Patterns Established
- Membership-gated RLS as the sole row gate (no app-side ownership filtering)
- `auth.uid()`-only inserts with `ON CONFLICT DO NOTHING` for idempotent joins
- `referrerPolicy="no-referrer"` for Google CDN avatars

### Key Lessons
1. When you remove a masking app-side filter, re-audit every RLS policy it was hiding — the filter and the policy must agree
2. Defense in depth: app sets `owner_id` on insert AND RLS enforces it (D-04)
3. Flip verification/UAT doc statuses at phase close, not milestone close — stale statuses become audit noise

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 19 | Initial delivery — wave-based planning, gap closure pattern |
| v2.0 | 5 | 23 | Auth + RLS; two-browser UAT became the critical security gate |

### Cumulative Quality

| Milestone | Source LOC | Source Files | Tests | Gap Closures |
|-----------|-----------|--------------|-------|-------------|
| v1.0 | 3,888 | 37 | — | 3 (02-04, 02-05, 05-05) |
| v2.0 | 3,375 | 39 | 166 (22 files) | 1 (10-06 RLS leak) |

### Top Lessons (Verified Across Milestones)

1. Test early on real devices — framework edge cases only surface in manual testing
2. Keep requirement tracking in sync with implementation — drift compounds
3. The hardest bugs live at the sync/security boundary (real-time reconnection in v1.0, RLS isolation in v2.0) and surface only under real two-client testing — keep investing in two-device/two-account UAT
