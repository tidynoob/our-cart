---
phase: 6
slug: auth-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AUTH-01 | — | N/A | unit | `npx vitest run src/stores/authStore.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | AUTH-02 | — | N/A | unit | `npx vitest run src/stores/authStore.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | AUTH-03 | — | N/A | unit | `npx vitest run src/components/auth/ProtectedRoute.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | AUTH-01 | — | N/A | unit | `npx vitest run src/pages/LandingPage.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/authStore.test.ts` — covers AUTH-01, AUTH-02
- [ ] `src/components/auth/ProtectedRoute.test.tsx` — covers AUTH-03
- [ ] New tests in `src/pages/LandingPage.test.tsx` — covers AUTH-01 UI conditional rendering

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
