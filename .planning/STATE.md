---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Polish, Profiles & Member Management
status: "v2.1 phases 11–13 shipped — PR #1 (code-only branch gsd/v2.1-polish-profiles → main)"
last_updated: "2026-06-07T16:57:54.843Z"
last_activity: "2026-06-07 - Completed quick task 260607-hok: port code-review fixes to PR #1 branch"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 20
  completed_plans: 19
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** Two people can see the same grocery list update in real-time, so nothing gets missed or double-bought.
**Current focus:** Phase 13 — enhanced-items

## Current Position

Phase: 13 (enhanced-items) — COMPLETE (UAT 8/8 passed, security 9/9 closed)
Plan: 13-07 complete (all 8 plans done)
Status: v2.1 phases 11–13 shipped — PR #1 (code-only branch gsd/v2.1-polish-profiles → main)
Last activity: 2026-06-07 - Completed quick task 260607-hok: port code-review fixes to PR #1 branch

```
v2.1 Progress: [██········] 20% (1/5 phases)
Phase 11: [x] Complete
Phase 12: [ ] Not started
Phase 13: [ ] Not started
Phase 14: [ ] Not started
Phase 15: [ ] Not started
```

## Performance Metrics

| Metric | v1.0 | v2.0 | v2.1 Target |
|--------|------|------|-------------|
| Phases | 5 | 5 | 5 |
| Plans per phase | 3.8 avg | 4.6 avg | TBD |
| LOC | 3,888 | ~3,375 | TBD |
| Phase 11 P02 | 100 | 2 tasks | 2 files |
| Phase 11 P03 | 5 | 2 tasks | 2 files |
| Phase 11-profiles-foundation-hardening P07 | 20 | 1 tasks | 1 files |
| Phase 11-profiles-foundation-hardening P06 | 25 | 3 tasks | 7 files |
| Phase 12 P01 (Wave 0 RED) | n/a | 2 tasks | 2 files |
| Phase 12 P02 | 6 min | 3 tasks | 6 files |
| Phase 13 P00 | 4min | 3 tasks | 5 files |
| Phase 13 P01 | 8min | 3 tasks | 6 files |
| Phase 13 P13-02 | 4min | 2 tasks | 2 files |
| Phase 13 P13-03 | 9min | 2 tasks | 2 files |
| Phase 13-enhanced-items P04 | 3min | 2 tasks | 4 files |
| Phase 13 P05 | 3min | 3 tasks | 2 files |
| Phase 13 P07 | 6min | 2 tasks | 2 files |

## Accumulated Context

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Auth before Lists | RLS policies require auth.uid(); lists schema depends on owner_id |
| Lists before Sidebar | Sidebar needs list data to render; must exist first |
| Sidebar before Profile | AppShell layout hosts profile section; logical containment |
| Profile/Auth wiring before Sharing | Sharing requires knowing who owns what list |
| PKCE for OAuth | Preferred by OAuth 2.1; Supabase default |
| Nullable user_id on items | v1.0 items have no user_id; policy: `user_id IS NULL OR user_id = auth.uid()` |
| Persistent invite tokens | No expiry for 2-person household use |
| SECURITY DEFINER invite lookup | Avoids RLS catch-22 for unauthenticated invite token resolution |
| No email column in public.profiles | USING (true) SELECT on profiles would expose email; column excluded by design |
| SECURITY DEFINER for remove_member/leave_list | Direct DELETE policies risk any member removing any other; RPC enforces owner-check |
| Broadcast member_removed on removal | RLS revoke does NOT close an open WebSocket (cached up to 1hr JWT); broadcast is the UX eject gate |
| position TEXT via fractional-indexing | Float positions exhaust precision at ~53 halvings; string keys from fractional-indexing are lexicographically stable |
| pendingReorders Set in Zustand | Suppresses own-update echo from Postgres Changes after reorder, preventing flicker |
| Minimal no-cache SW for PWA | A cache-first SW breaks realtime on stale asset deploys; no fetch handler = no caching risk |
| Daily ping to /rest/v1/profiles?limit=1 | Must touch DB to register as activity; bare /rest/v1/ root does not count |

### Watch Out For

- Enable RLS + create policies in the SAME migration — never enable RLS without policies
- OAuth redirect URL must match in 3 places: Supabase Site URL, Supabase allowlist, Google Cloud Console
- `onAuthStateChange` callback must NOT be async (Supabase requirement)
- Call `realtime.setAuth()` on auth state change — JWT is cached at channel-open
- Use `(select auth.uid())` not bare `auth.uid()` in RLS policies (query planner caching)
- INSERT/UPDATE RLS policies need both `USING` and `WITH CHECK`
- `isLoading` guard required on ProtectedRoute to prevent auth state flash
- Pre-flight check: `SELECT count(*) FROM lists WHERE owner_id IS NULL` must be 0 before HARD-01 migration
- handle_new_user trigger requires `SECURITY DEFINER SET search_path = ''` — canonical Supabase pattern
- All columns in profiles trigger handler must be nullable + COALESCE + ON CONFLICT DO NOTHING (blocks signup if trigger throws)
- realtime-js archived January 2026; StrictMode ghost-channel bug will NOT be fixed upstream — use mounted ref guard in usePresence
- Use `supabase.removeChannel()` not just `unsubscribe()` for presence cleanup (channel leak on list switch)
- Re-call `channel.track()` on TOKEN_REFRESHED — JWT expiry drops presence tracking (~1hr)
- Do NOT use @dnd-kit/react (v0.4.0) — experimental, TouchSensor removed, open iOS bug #1723
- iOS has no `beforeinstallprompt` — must show manual Share > Add to Home Screen banner
- GitHub Actions silently disabled after 60-day repo inactivity — keepalive-workflow@v2 prevents this

### Todos

- [x] Two-browser UAT after Phase 11 — DONE 2026-06-01, T1-T4 all pass (gaps T1-T4 closed by 11-10)
- SECURITY DEFINER EXECUTE grants flagged WARN by advisors (remove_member/leave_list/handle_new_user/is_list_member_for_rls) — REVOKE from anon/public deferred to `/gsd-secure-phase`

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Doc status | Phase 07 UAT (07-HUMAN-UAT.md) — `partial`, 1 scenario blocked_by prior-phase (now unblocked by Phase 10) | doc-debt | v2.0 close |
| Doc status | Phase 08 verification (08-VERIFICATION.md) — `human_needed`, browser-only visual checks, code verified | doc-debt | v2.0 close |
| Doc status | Phase 09 verification (09-VERIFICATION.md) — `human_needed`, code verified | doc-debt | v2.0 close |
| Doc status | Phase 09 UAT (09-HUMAN-UAT.md) — `testing`, 6 browser scenarios | doc-debt | v2.0 close |

Doc-status items acknowledged at milestone close: UAT/verification docs left un-flipped. Equivalent browser behaviors exercised live during Phase 10 two-account UAT. No functional gaps — `tsc --noEmit` clean, 166 unit tests green (22 files), prod build green.

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260607-hok | port code-review fixes to PR #1 branch | 2026-06-07 | bae1347 | [260607-hok-port-code-review-fixes-to-pr-1-branch](./quick/260607-hok-port-code-review-fixes-to-pr-1-branch/) |

## Session Continuity

Last session: 2026-06-07T16:57:54.827Z
Stopped at: Phase 14 context gathered
Resume file: .planning/phases/14-shopping-flow-qol/14-CONTEXT.md
Next action: Plan Phase 14 (Shopping Flow & QoL) — /gsd-discuss-phase 14
Note: origin/main is code-only (squash PRs). Local main retains full .planning history and is AHEAD of origin/main — do NOT push local main; publish future code via gsd-pr-branch cut from origin/main.

## Decisions

- [Phase ?]: useListsStore() called without selector in LandingPage for mock-compatible test behavior
- [Phase ?]: CreateListForm delegates to listsStore.createList — owner_id NULL tech debt D-04 closed
- [Phase ?]: displayName = storedName ?? list?.name — store cache for live rename, local state fallback for direct URL nav (D-06/D-03)
- [Phase ?]: ProfileSection extracted as local sub-component; handleSignOut closes drawer before redirect (D-09)
- [Phase ?]: resolveDisplayName scoped as component-local helper in ListPage (display_name ?? full_name ?? name ?? email.split('@')[0] ?? 'Unknown')
- [Phase ?]: D-01: list_members composite PK (list_id, user_id) as idempotency layer 1 for membership
- [Phase ?]: D-02: SECURITY DEFINER is_list_member avoids RLS recursion; list_members own policies use direct column check only
- [Phase ?]: D-04: redeem_invite inserts auth.uid() only, never caller-supplied user_id, with ON CONFLICT DO NOTHING idempotency
- [Phase ?]: D-05: ShareBanner uses /invite/:code URL so partners receive redemption flow not blocked ListPage
- [Phase ?]: D-08: fetchLists drops owner_id filter; RLS membership policy gates rows; userId param kept as _userId for API compatibility
- [Phase ?]: Reactive useProfilesStore selector in ItemRow (not getState snapshot) for PROF-05 live names
- [Phase 11 gap]: is_list_member_for_rls SECURITY DEFINER helper (explicit user_id arg) broadens list_members_select so any member reads all co-member rows — fixes cross-user avatar + Members-dialog spinner without RLS recursion
- [Phase 11 gap]: public.profiles added to supabase_realtime publication for live name/avatar UPDATEs; client must re-subscribe (reload) after a publication change to receive events
- [Phase 11 gap]: display_name has no visible surface for an avatar'd member (badge shows img; name only feeds initials fallback + aria-label) — live PROF-05 only observable when avatar absent
- [Phase 12 W0]: OPS-02 presence contract pinned as failing tests before implementation (Nyquist gate) — presenceStore.test.ts + PresenceIndicator.test.tsx committed RED. Wave 1 (12-02) builds presenceStore.ts + PresenceIndicator.tsx to GREEN.
- [Phase 12 W0]: PresenceIndicator must neutralize AttributionBadge's hardcoded inner `aria-label="{name} added this"` so the wrapper `"{name} is viewing this list"` is the SINGLE accessible name (W-2 correctness pin; do not edit AttributionBadge).
- [Phase ?]: [Phase 12 W1]: OPS-02 presence shipped via presence-listId channel keyed by user.id; deriveOthers self-filter + tab-dedupe; retrack on TOKEN_REFRESHED through single auth listener; aria-label neutralized by ref (no AttributionBadge fork)
- [Phase ?]: [Phase 13 W0]: ITEM-01..05 contracts pinned as failing RED tests before implementation (Nyquist gate); Wave 1/2 build to GREEN.
- [Phase ?]: [Phase 13 W0]: ItemRow swipe container must expose [data-swipe-row]; stepper aria-labels Increase/Decrease quantity; useSortable mocked no-op for jsdom drag.
- [Phase 13 W1]: enhanced_items.sql applied to LIVE DB via Supabase MCP apply_migration (Phase 11-08 pattern) — note/position columns present, 0 null positions, items confirmed in supabase_realtime (A1). Append-only, no RLS change (D-02), no publication re-add.
- [Phase 13 W1]: position backfill via plpgsql DO loop with padded keys 'a'||lpad(i,4,'0') in created_at order — lexicographic == numeric to 9999 rows, sorts before future generateKeyBetween appends (A3).
- [Phase 13 W1]: ordering.ts pure helpers (computeReorderKey/parseQuantity/byPosition); position sort is a SINGLE chokepoint inside groupItemsByCategory (CategorySection/ListPage stay sort-free); null positions fall back to created_at.
- [Phase 13 W1]: Item type extension forced note:null,position:null into addItem optimistic literal (tsc restore); real insert-key generateKeyBetween(currentMax,null) deferred to Plan 02. reorderItem RED tests stay red by design (Plan 02 scope).
- [Phase ?]: [Phase 13 W2]: itemsStore.reorderItem = single optimistic {category, position} write (D-09 cross-category adopt) + per-item rollback; pendingReorders one-shot UPDATE echo-skip (D-10) mirrors pendingTempIds; updateItem Pick widened note|position (D-03); addItem appends computeReorderKey(currentMax,null) so new rows never null-position (D-11). itemsStore 29/29 GREEN, tsc clean.
- [Phase ?]: 13-03: ItemRow stepper wired to existing onSave (not onStep) per Wave-0 contract; note as escaped JSX text (no raw-HTML, T-13-V5a); handle-only useSortable + hand-rolled swipe-to-delete (clamp -96, threshold -64)
- [Phase ?]: [Phase 13 W4]: ListPage mounts single list-wide DndContext (PointerSensor distance:8 + KeyboardSensor) + one SortableContext over flat item ids; handleDragEnd -> reorderItem (cross-category MOVE in onDragEnd, D-09); handleStep -> updateItem({quantity}) via CategorySection onStep
- [Phase ?]: [Phase 13 W4]: cross-category drop-target header hover left STATIC -- single-context model has no per-section over-state; cross-category MOVE still works via onDragEnd compute (visual-only, per plan allowance)
- [Phase ?]: [Phase 13 W4]: AddItemBar dupExists = unchecked-only case-insensitive match against live store items (D-14); role=status amber warning, escaped JSX (T-13-V5); Add stays enabled, handleSubmit ungated (D-15)
- [Phase 13 13-05]: ItemRow swipe press-gated via isPressed ref + (e.buttons&1) early-return; pointercancel/pointerleave snaps a stray SUB-THRESHOLD offset back to 0 but leaves a committed reveal intact; setPointerCapture kept but the gate (not capture) decides if a move counts (Defect A).
- [Phase 13 13-05]: revealed Delete wrapper z-10 + foreground pointer-events-none when revealed, pointer-events-auto on drag handle/checkbox/stepper — structural fix so the translated opaque foreground no longer steals the Delete click (Defect B). Gap-1 check-off resolved via checkbox; row-tap KEEPS open-edit (Warning 4). jsdom tests anchor the mechanism; on-device 13-HUMAN-UAT tests 2 & 3 are the final gate.
- [Phase ?]: [Phase 13 13-07]: AddItemBar clears input synchronously BEFORE await addItem (quantity/category captured into locals first) so the optimistic insert never coincides with a populated name; closes UAT gap 6 dup-warning flash. dupExists/warning render unchanged, D-14/D-15 preserved. Regression test uses deferred-addItem observable-flash form (React 19 batching defers the DOM input clear).
- [Phase 13 13-06]: ItemRow capture-on-swipe-only — setPointerCapture moved OUT of pointerdown INTO pointermove behind slop+delta<0 guard (single capture/gesture via pointerCaptured ref); root-cause fix for UAT gaps 2+4 (a plain tap stays uncaptured → checkbox/stepper get native activation; no separate stepper hack). handleRowTap guarded by interactiveOrigin ref (data-row-interactive closest() match on pointerdown e.target) as belt-and-suspenders. Gap 7: dxAtStart baseline unifies left/right swipe so delta>0 from revealed reduces |dx| and clears revealed crossing above -64; sibling z-0 pointer-events-auto tap-catcher restores tap-dismiss while foreground stays pointer-events-none (13-05 Defect-B Test D mechanism preserved). 27/27 ItemRow + 269/269 full suite green, tsc clean. On-device UAT tests 2/4/7 are the FINAL gate.

## Operator Next Steps

- [x] PR #1 MERGED 2026-06-07 (squash 5f4e1cd) — v2.1 phases 11–13 + code-review fixes; branch deleted; local main reconciled (-s ours)
- Next: /gsd-discuss-phase 14 (Shopping Flow & QoL) — first unplanned phase
- Doc-debt (non-blocking): write 11-09-SUMMARY.md; flip 11-HUMAN-UAT.md status diagnosed→complete
