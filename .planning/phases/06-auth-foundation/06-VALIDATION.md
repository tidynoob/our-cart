---
phase: 6
slug: auth-foundation
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-27
validated: 2026-05-28
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.3 + @testing-library/react 16.3.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Plan | Requirement | Threat Ref | Tests | Automated Command | File Exists | Status |
|------|-------------|------------|-------|-------------------|-------------|--------|
| 02 | AUTH-01, AUTH-02 | T-06-03/04/05 | 9 (initialize ×7, signInWithGoogle ×2) | `npx vitest run src/stores/authStore.test.ts` | ✅ | ✅ green |
| 03 | AUTH-03 | T-06-06/07/08 | 4 (spinner, redirect, returnTo, Outlet) | `npx vitest run src/components/auth/ProtectedRoute.test.tsx` | ✅ | ✅ green |
| 04 | AUTH-01 | T-06-09/10 | 6 (heading, subtitle, button, click, error ×2) | `npx vitest run src/components/auth/LoginPage.test.tsx` | ✅ | ✅ green |
| 04 | AUTH-01 | — | 3 (login, authenticated, loading) | `npx vitest run src/pages/LandingPage.test.tsx` | ✅ | ✅ green |
| 05 | AUTH-01/02/03 (DB) | T-06-11..14 | — (SQL migration, manual-only) | N/A | ✅ files | manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · manual = no automated path*

**Total automated: 22 tests, all green.** signInWithGoogle assertion updated 2026-05-28 to match D-13 `redirectTo: window.location.origin`.

---

## Wave 0 Requirements

- [x] `src/stores/authStore.test.ts` — covers AUTH-01, AUTH-02 (9 tests green)
- [x] `src/components/auth/ProtectedRoute.test.tsx` — covers AUTH-03 (4 tests green)
- [x] `src/pages/LandingPage.test.tsx` — covers AUTH-01 UI conditional rendering (3 tests green)
- [x] `src/components/auth/LoginPage.test.tsx` — covers AUTH-01 login UI (6 tests green, added Plan 04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth redirect flow end-to-end | AUTH-01 | Requires browser + Google account | 1. Click "Sign in with Google" 2. Complete Google consent 3. Verify redirect back to app |
| Session persistence across browser close/reopen | AUTH-02 | Browser lifecycle not testable in Vitest | 1. Sign in 2. Close browser 3. Reopen and navigate to app 4. Verify still signed in |
| Supabase Dashboard OAuth provider configuration | AUTH-01 | Dashboard config not code | Verify Google provider enabled in Supabase Dashboard → Authentication → Providers |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-05-28

---

## Validation Audit 2026-05-28

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Gap:** `authStore.test.ts` signInWithGoogle assertion (`{ provider: 'google' }`) went stale after commit `4eaa26e fix(06): add redirectTo option to signInWithOAuth (D-13)` added `options.redirectTo` to the implementation. Test was RED; impl was correct (confirmed in 06-VERIFICATION.md truth #1). **Resolved** by updating the test assertion to `{ provider: 'google', options: { redirectTo: window.location.origin } }`. No implementation files modified. 22/22 auth tests green.
