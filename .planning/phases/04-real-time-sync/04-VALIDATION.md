---
phase: 4
slug: real-time-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.x + @testing-library/react 16 (jsdom) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose` (full suite)
- **Before `/gsd-verify-work`:** Full suite green AND manual 2-device test completed
- **Max feedback latency:** ~10 seconds (automated); manual reconnect test is the phase gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-xx | 01 | 1 | SYNC-01 | T-04-V4 | Realtime stream scoped to subscriber's list_id (RLS + channel filter) | manual | Supabase Dashboard → Replication shows `items` in `supabase_realtime`; events arrive on 2nd device | ❌ W0 (DB step) | ⬜ pending |
| 04-01-xx | 01 | 1 | SYNC-01 | — | INSERT from partner adds item to store | unit | `npx vitest run src/stores/itemsStore.test.ts -t "mergeReducer"` | ❌ W0 | ⬜ pending |
| 04-01-xx | 01 | 1 | SYNC-01 | — | Own-write INSERT echo is a no-op (id-dedup) | unit | `npx vitest run src/stores/itemsStore.test.ts -t "mergeReducer"` | ❌ W0 | ⬜ pending |
| 04-01-xx | 01 | 1 | SYNC-01 | — | UPDATE from partner replaces item by id | unit | `npx vitest run src/stores/itemsStore.test.ts -t "mergeReducer"` | ❌ W0 | ⬜ pending |
| 04-01-xx | 01 | 1 | SYNC-01 | — | DELETE removes item keyed off `payload.old.id` only | unit | `npx vitest run src/stores/itemsStore.test.ts -t "mergeReducer"` | ❌ W0 | ⬜ pending |
| 04-01-xx | 01 | 1 | SYNC-01 | — | clearChecked bulk = multiple DELETE events remove correct rows | unit | `npx vitest run src/stores/itemsStore.test.ts -t "mergeReducer"` | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 2 | SYNC-02 | — | fetchItems called on SUBSCRIBED status | unit | `npx vitest run src/stores/itemsStore.test.ts -t "subscribeToList"` | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 2 | SYNC-02 | — | fetchItems called on visibilitychange→visible | unit | `npx vitest run src/pages/ListPage.test.tsx -t "visibilitychange"` | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 2 | SYNC-02 | — | fetchItems called on window `online` event | unit | `npx vitest run src/pages/ListPage.test.tsx -t "online"` | ❌ W0 | ⬜ pending |
| 04-02-xx | 02 | 2 | SYNC-02 | — | unsubscribe calls supabase.removeChannel (StrictMode-safe cleanup) | unit | `npx vitest run src/stores/itemsStore.test.ts -t "unsubscribe"` | ❌ W0 | ⬜ pending |
| 04-03-xx | 03 | 2 | SYNC-03 | — | syncStatus connecting→live on SUBSCRIBED | unit | `npx vitest run src/stores/itemsStore.test.ts -t "syncStatus"` | ❌ W0 | ⬜ pending |
| 04-03-xx | 03 | 2 | SYNC-03 | — | syncStatus→reconnecting on CHANNEL_ERROR/TIMED_OUT/CLOSED | unit | `npx vitest run src/stores/itemsStore.test.ts -t "syncStatus"` | ❌ W0 | ⬜ pending |
| 04-03-xx | 03 | 2 | SYNC-03 | — | SyncStatus pill renders correct text+color per state | unit | `npx vitest run src/components/SyncStatus.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders (`04-PP-TT`) — planner assigns concrete IDs; rows map to behaviors, not final numbering.*

---

## Wave 0 Requirements

- [ ] `src/stores/itemsStore.test.ts` — extend (vi.mock channel API) to cover `subscribeToList`, `unsubscribe`, `syncStatus` transitions, and the merge reducer (INSERT add, INSERT echo no-op, UPDATE replace, DELETE-by-id, DELETE-only-id payload)
- [ ] `src/pages/ListPage.test.tsx` — add tests for `visibilitychange`→visible and `online` handlers calling `fetchItems`
- [ ] `src/components/SyncStatus.test.tsx` — new file; assert three state renders (live / connecting / reconnecting)
- [ ] DB step (manual): `alter publication supabase_realtime add table items;` — no automated coverage; verified via Dashboard + 2-device smoke test

*Existing Vitest + Testing Library infrastructure covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Realtime publication includes `items` | SYNC-01 | DB-side config, not code | Supabase Dashboard → Database → Replication → confirm `items` toggled ON in `supabase_realtime` |
| Change appears on 2nd device within 2 s | SYNC-01 | Real WebSocket + 2 clients + wall-clock timing | Open same list in two browsers; add/check/delete an item in one; confirm it appears in the other within 2 s |
| Mobile Safari screen-lock → wake resync | SYNC-02 | Requires real device backgrounding the JS timers | Lock phone with list open; partner adds an item; unlock; confirm item appears (visibilitychange path) |
| Network-drop reconnect resync | SYNC-02 | Requires real socket drop | Toggle airplane mode with list open; partner adds an item; re-enable network; confirm item appears and pill returns to Live |
| Indicator reflects live vs reconnecting | SYNC-03 | Visual + real connection state | Observe green "Live" when connected; observe amber "Reconnecting…" during the network-drop window |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (manual-only items documented above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (using `vitest run`, not `vitest`)
- [ ] Feedback latency < 10s (automated)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 stubs land

**Approval:** pending
