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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 19 | Initial delivery — wave-based planning, gap closure pattern |

### Cumulative Quality

| Milestone | Source LOC | Source Files | Gap Closures |
|-----------|-----------|--------------|-------------|
| v1.0 | 3,888 | 37 | 3 (02-04, 02-05, 05-05) |

### Top Lessons (Verified Across Milestones)

1. Test early on real devices — framework edge cases only surface in manual testing
2. Keep requirement tracking in sync with implementation — drift compounds
