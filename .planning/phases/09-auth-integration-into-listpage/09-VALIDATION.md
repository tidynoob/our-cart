---
phase: 9
slug: auth-integration-into-listpage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.3 + React Testing Library 16.3.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/stores/authStore.test.ts src/stores/uiStore.test.ts src/components/AttributionBadge.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/stores/authStore.test.ts src/stores/uiStore.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PROF-01 | `updateDisplayName` updates store optimistically | unit | `npx vitest run src/stores/authStore.test.ts` | ✅ add cases | ⬜ pending |
| PROF-01 | `updateDisplayName` calls `supabase.auth.updateUser` with trimmed name | unit | `npx vitest run src/stores/authStore.test.ts` | ✅ add cases | ⬜ pending |
| PROF-01 | Display-name edit UI save+cancel in Sidebar profile section | component | `npx vitest run src/components/Sidebar.test.tsx` | ✅ add cases | ⬜ pending |
| PROF-02 | `AttributionBadge` renders `<img>` when `avatarUrl` present | unit | `npx vitest run src/components/AttributionBadge.test.tsx` | ❌ W0 | ⬜ pending |
| PROF-02 | `AttributionBadge` falls back to initials on img error | unit | `npx vitest run src/components/AttributionBadge.test.tsx` | ❌ W0 | ⬜ pending |
| PROF-02 | `ItemRow` shows live display name for own items (user_id match) | unit | `npx vitest run src/components/ItemRow.test.tsx` | ✅ add cases | ⬜ pending |
| PROF-03 | Sign out calls `authStore.signOut()` and closes drawer | component | `npx vitest run src/components/Sidebar.test.tsx` | ✅ add cases | ⬜ pending |
| NAV-03 | `restoreBanner` removes code from `dismissedBanners` Set | unit | `npx vitest run src/stores/uiStore.test.ts` | ❌ W0 | ⬜ pending |
| NAV-03 | "Show share code" button visible when dismissed; calls restoreBanner | component | `npx vitest run src/pages/ListPage.test.tsx` | ✅ add cases | ⬜ pending |
| D-10 | `ListPage` does not render `NamePromptDialog` when authenticated | component | `npx vitest run src/pages/ListPage.test.tsx` | ✅ update/remove | ⬜ pending |
| D-10 | `AddItemBar` never disabled when auth user present | component | `npx vitest run src/components/AddItemBar.test.tsx` | ✅ update cases | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/AttributionBadge.test.tsx` — new file; PROF-02 avatar render + onError initials fallback
- [ ] `src/stores/uiStore.test.ts` — new file; NAV-03 `restoreBanner` + existing `dismissBanner`

*Existing files (`authStore.test.ts`, `Sidebar.test.tsx`, `ItemRow.test.tsx`, `ListPage.test.tsx`, `AddItemBar.test.tsx`) need new/updated cases but not new files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Google avatar image renders (not 403) with `referrerPolicy="no-referrer"` | PROF-02 | Real googleusercontent.com URL + browser referrer policy can't be asserted in jsdom | Sign in with Google on a real device; confirm avatar shows in sidebar + on own items (not the initials fallback) |
| Display-name edit propagates to existing item attributions live | PROF-01 | Requires real authed session + existing items with matching user_id | Edit name in sidebar; confirm all own items' badges update without refresh |
| Sign out returns to login page | PROF-03 | Requires real auth session + ProtectedRoute redirect | Tap Sign out; confirm redirect to `/` login screen |

---

## Security Sign-Off (ASVS L1, block on: high)

- [ ] `display_name` trimmed + non-empty validated before `updateUser` (V5 Input Validation)
- [ ] Display name rendered via JSX escaping only — no `dangerouslySetInnerHTML` (XSS / Tampering)
- [ ] Sign-out redirect is internal (`ProtectedRoute` → `/`), no user-supplied redirect URL (open-redirect / EoP)
- [ ] `user_metadata` write spreads server-controlled object; only `display_name` key set; no permission-granting keys (Tampering)

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers both MISSING test files (AttributionBadge, uiStore)
- [ ] No watch-mode flags (always `vitest run`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
