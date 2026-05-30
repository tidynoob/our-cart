---
phase: 10
slug: list-sharing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.3 (jsdom, globals: true) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run src/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite green + manual UAT table complete
- **Max feedback latency:** ~5 seconds (unit); RLS/realtime are manual UAT

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-00-01 | 00 | 0 | SHARE-02 | — | N/A | unit (stub) | `npx vitest run src/pages/InvitePage` | ❌ W0 | ⬜ pending |
| 10-00-02 | 00 | 0 | SHARE-02 | — | N/A | unit (stub) | `npx vitest run src/components/ShareBanner` | ❌ W0 | ⬜ pending |
| 10-xx-RLS | xx | 1 | SHARE-01 | T-10-01 | Non-member SELECT on another user's list returns empty (RLS blocks) | manual/integration | two-browser UAT | N/A | ⬜ pending |
| 10-xx-REDEEM | xx | 1 | SHARE-01 | T-10-02 | `redeem_invite` idempotent; unknown code → null; owner self-redeem no-op | manual/integration | Supabase RPC UAT | N/A | ⬜ pending |
| 10-xx-RT | xx | 2 | SHARE-01 | — | Member receives partner's item inserts/checks via realtime | manual/integration | two-browser UAT | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/pages/InvitePage.test.tsx` — stubs for SHARE-02 (mock `supabase.rpc('redeem_invite')`: spinner → redirect on valid code; "invalid invite" on null return)
- [ ] `src/components/ShareBanner.test.tsx` — stubs for SHARE-02 (assert copied URL has `/invite/` prefix, not `/list/`)

---

## Manual-Only Verifications

> RLS + Realtime require a live Supabase instance — not reproducible in Vitest jsdom. These are mandatory UAT items.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Member reads items on shared list | SHARE-01 | Needs live RLS + 2 auth users | User B redeems invite → query `items` filtered by `list_id` → returns all items (not empty) |
| Non-member blocked | SHARE-01 | Live RLS boundary | User C (not member/owner) queries that list's items → empty array |
| Idempotent redeem | SHARE-01 | Live DB constraint | Same user redeems same code 3× → single `list_members` row; redirects each time |
| Owner self-redeem | SHARE-01 | Live RPC | Owner opens own invite link → no-op insert → redirects to list |
| Realtime cross-user | SHARE-01 | Live WebSocket + RLS broadcast | User A adds/checks item → User B (member, other tab) sees it within ~2s |
| Unknown code | SHARE-02 | Live RPC null path | `/invite/NOTEXIST` → "Invalid invite" UI |
| Unauthenticated invite flow | SHARE-02 | OAuth round-trip + returnTo | Open `/invite/:code` signed out → sign in → land on `/list/:code` with items visible |

---

## Validation Sign-Off

- [ ] Wave 0 stubs created for both SHARE-02 unit-testable behaviors
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify OR a documented manual UAT row
- [ ] RLS/realtime behaviors all captured as manual UAT rows (no false-green from jsdom)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s for unit suite
- [ ] `nyquist_compliant: true` set in frontmatter after plan-checker confirms coverage

**Approval:** pending
