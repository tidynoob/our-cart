---
phase: "04"
slug: real-time-sync
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-26
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Supabase Realtime WS -> Zustand store | Incoming postgres_changes events cross from Supabase WebSocket to client merge reducer | Item rows (id, name, checked, list_id) |
| RLS + channel filter -> subscriber | anon subscriber only receives events scoped to their list_id | Filtered item events |
| Browser event listeners -> store actions | visibilitychange, online, offline events trigger store mutations | No external data; browser-provided signals only |
| SyncStatus component -> store | Component reads syncStatus string enum | Connection state string (no server data) |
| test runner -> source files | Vitest reads test and source files on disk (Wave 0 only) | No network boundary |
| Browser API (navigator.onLine) -> store | Read-only browser API informs mutation error handlers | Boolean connectivity state |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-W0-01 | Tampering | vi.mock factory shape | accept | Wave 0 test stubs only; mock shape validated by test run exit 0 | closed |
| T-04-W0-SC | Tampering | npm/pip/cargo installs | accept | No new packages installed in Plan 01 | closed |
| T-04-02-01 | Information Disclosure | Realtime stream cross-list leakage | mitigate | Channel filter `list_id=eq.${listId}` + RLS `anon_select_items` policy; events scoped server-side per D-01 | closed |
| T-04-02-02 | Information Disclosure | DELETE events bypass RLS | accept | Both users legitimately own the 2-person list; DELETE payload contains only primary key (no PII) | closed |
| T-04-02-03 | Information Disclosure | Channel name guessing | accept | Channel name embeds list UUID (122-bit random); publishable key scoped to anon+RLS provides defense-in-depth | closed |
| T-04-02-04 | Spoofing | Malformed event payload clobbering store | mitigate | Merge reducer uses typed cast `(newRow as Item)` for INSERT/UPDATE; DELETE uses `(oldRow as {id?:string}).id` with null guard — invalid payloads produce no-ops | closed |
| T-04-02-SC | Tampering | npm/pip/cargo installs | accept | No new packages in Plan 02; supabase-js already in package.json | closed |
| T-04-03-01 | Information Disclosure | SyncStatus revealing connection metadata | accept | Exposes only client's own connection state ('live'/'connecting'/'reconnecting'); no server-side data or partner presence revealed | closed |
| T-04-03-02 | Denial of Service | Rapid visibilitychange/online events causing fetchItems storm | mitigate | fetchInFlight module-level guard in store prevents concurrent duplicate fetchItems calls; guard cleared in .finally() | closed |
| T-04-03-03 | Tampering | ListPage useEffect cleanup fails to remove event listeners | mitigate | Cleanup explicitly calls removeEventListener for visibilitychange, online, and offline with same handler references; verified by ListPage.test.tsx | closed |
| T-04-03-04 | Spoofing | supabase_realtime cross-list events reaching wrong subscriber | mitigate | Channel filter `list_id=eq.${listId}` server-side + RLS `anon_select_items` — double defense per D-01 | closed |
| T-04-03-SC | Tampering | npm/pip/cargo installs | accept | No new packages in Plan 03 | closed |
| T-04-04-01 | Tampering | navigator.onLine | accept | Read-only browser API; spoofing requires code execution in same origin — outside threat model for 2-person app | closed |
| T-04-04-02 | Denial of Service | 'online' handler re-subscribes | accept | subscribeToList is idempotent (D-09 guard removes prior channel before creating new one); repeated online events cannot stack channels | closed |
| T-04-04-SC | Tampering | npm/pip/cargo installs | accept | No new packages in Plan 04 | closed |

*Status: open / closed*
*Disposition: mitigate (implementation required) / accept (documented risk) / transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-04-W0-01 | Test-only mock shape; validated by test suite green | plan-author | 2026-05-26 |
| AR-02 | T-04-W0-SC | No new packages installed | plan-author | 2026-05-26 |
| AR-03 | T-04-02-02 | DELETE payload contains only PK; both users own the shared list | plan-author | 2026-05-26 |
| AR-04 | T-04-02-03 | UUID channel names are 122-bit random; not guessable | plan-author | 2026-05-26 |
| AR-05 | T-04-02-SC | No new packages; existing deps audited | plan-author | 2026-05-26 |
| AR-06 | T-04-03-01 | SyncStatus shows only own connection state; no PII | plan-author | 2026-05-26 |
| AR-07 | T-04-03-SC | No new packages | plan-author | 2026-05-26 |
| AR-08 | T-04-04-01 | navigator.onLine is read-only browser API; same-origin only | plan-author | 2026-05-26 |
| AR-09 | T-04-04-02 | subscribeToList idempotent via D-09 channel cleanup guard | plan-author | 2026-05-26 |
| AR-10 | T-04-04-SC | No new packages | plan-author | 2026-05-26 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-26 | 15 | 15 | 0 | gsd-secure-phase (short-circuit: all plan-time threats verified closed) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-26
