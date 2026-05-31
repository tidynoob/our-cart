---
phase: 09-auth-integration-into-listpage
verified: 2026-05-29T12:47:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "PROF-02 sidebar avatar — open sidebar after Google sign-in; confirm 40px Google avatar photo renders (not an initials circle); check DevTools Network: avatar img has no Referer header"
    expected: "Circular 40px avatar photo from Google CDN, no Referer header on the img request"
    why_human: "referrerPolicy='no-referrer' behavior and actual Google CDN response require a live session with a real Google avatar URL"
  - test: "PROF-01 display name edit — tap pencil icon in sidebar; change name to 'Test Name'; tap Save name; verify (a) sidebar immediately shows 'Test Name', (b) own items update attribution live, (c) refresh page — name persists"
    expected: "Name updated optimistically, persisted in Supabase user_metadata, survives page refresh"
    why_human: "Supabase auth.updateUser persistence and cross-session durability require a live authenticated session"
  - test: "PROF-02 avatar on own items — add a new item while signed in; confirm 28px attribution badge shows your Google avatar, not an initials circle"
    expected: "Circular avatar image from Google CDN appears on own items"
    why_human: "Requires a real Google OAuth session with avatar_url populated in user_metadata"
  - test: "PROF-03 sign out — tap Sign out in sidebar; confirm (a) sidebar closes immediately, (b) redirect to login page /, (c) sidebar not visible over login screen"
    expected: "Drawer closes first, then redirect fires — no flash of open drawer over login page"
    why_human: "Redirect sequencing and visual correctness require a live browser session"
  - test: "NAV-03 re-expand — dismiss share code banner via x button; confirm Share2 icon appears in header; tap Share2; confirm banner reappears and Share2 icon disappears"
    expected: "Toggle is lossless — banner state restores correctly both directions"
    why_human: "Visual banner toggle correctness verified in browser; automated test covers click handler but not render fidelity"
  - test: "D-10 no-name-prompt — navigate to any list while signed in; confirm no name prompt dialog; AddItemBar input is active; added items show auth display name as attribution"
    expected: "No NamePromptDialog, AddItemBar active, auth name on items"
    why_human: "End-to-end flow combining auth state, AddItemBar, and attribution rendering requires a live session"
---

# Phase 9: Auth Integration into ListPage — Verification Report

**Phase Goal:** The list experience reflects who the user is — their name, avatar, and ability to sign out.
**Verified:** 2026-05-29T12:47:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User's Google avatar is visible in the sidebar and on items they have added | VERIFIED (code) / human for live rendering | `Sidebar.tsx:91-98` renders `<img referrerPolicy="no-referrer">` when `avatarUrl` present; `AttributionBadge.tsx:36-43` does same; `ItemRow.tsx:260-267` passes `currentUserAvatarUrl` to badge for own items |
| 2 | User can edit their display name and see it update on their existing item attributions | VERIFIED (code) / human for persistence | `authStore.ts:67-85` implements `updateDisplayName` with optimistic update + Supabase `updateUser` + rollback; `Sidebar.tsx:49-54` calls it on Save; `ItemRow.tsx:260-264` resolves live name for own items from `currentUserDisplayName` |
| 3 | User can sign out from within the app and is returned to the login page | VERIFIED (code) / human for redirect | `Sidebar.tsx:57-60` calls `onOpenChange(false)` THEN `signOut()` — drawer-first sequence correct; `authStore.ts:59-62` calls `supabase.auth.signOut()` |
| 4 | A dismissed share-code header can be re-expanded without refreshing the page | VERIFIED in code | `uiStore.ts:15-20` implements `restoreBanner` as inverse of `dismissBanner` with new Set reference; `ListPage.tsx:365-375` renders Share2 button conditioned on `dismissedBanners.has(list.share_code)`, onClick calls `restoreBanner(list.share_code)` |

**Score:** 4/4 truths verified in code. Six browser-level behaviors deferred to human UAT.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/item.ts` | Item type with `user_id: string \| null` | VERIFIED | Line 13: `user_id: string \| null` |
| `src/stores/authStore.ts` | `updateDisplayName` action | VERIFIED | Lines 67-85: trim guard, optimistic set, `supabase.auth.updateUser`, rollback via `getUser()` |
| `src/stores/uiStore.ts` | `restoreBanner` action | VERIFIED | Lines 15-20: new Set copy, `.delete()`, return new reference |
| `src/components/AttributionBadge.tsx` | Avatar + initials fallback | VERIFIED | Lines 22-43: `useState(imgError)`, `showImg` guard, `<img referrerPolicy="no-referrer">`, `onError` fallback |
| `src/components/ItemRow.tsx` | Live attribution for own items | VERIFIED | Lines 259-280: `isOwnItem = item.user_id != null && item.user_id === currentUserId`; three-branch ternary |
| `src/components/Sidebar.tsx` | Profile section with avatar/name/edit/sign-out | VERIFIED | Lines 35-132: `ProfileSection` component with all four elements; `resolveDisplayName` fallback chain at lines 20-28 |
| `src/components/AppShell.tsx` | `user={user}` passed to Sidebar | VERIFIED | Line 31: `<Sidebar ... user={user} ...>` |
| `src/components/CategorySection.tsx` | currentUser props threaded to ItemRow | VERIFIED | Lines 16-18 (interface), 41-43 (destructure), 68-70 (passed to ItemRow) |
| `src/pages/ListPage.tsx` | restoreBanner + Share2 + resolveDisplayName; no NamePromptDialog | VERIFIED | Line 42 restoreBanner selector; lines 365-375 Share2 JSX; lines 255-264 resolveDisplayName helper; no NamePromptDialog import or render |
| `src/components/AddItemBar.tsx` | No disabled prop | VERIFIED | Interface at lines 18-21 has only `listId` + `addedBy`; `isInert = submitting` only (line 114) |
| `src/components/NamePromptDialog.tsx` | Deleted | VERIFIED | Glob search returns no results; grep finds only one reference in `ListPage.test.tsx` (a test asserting it does not render — expected) |
| `src/components/NamePromptDialog.test.tsx` | Deleted | VERIFIED | Glob search returns no results |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AppShell.tsx` | `Sidebar.tsx` | `user={user}` prop | WIRED | Line 31 of AppShell passes `user={user}` |
| `Sidebar.tsx` | `authStore.updateDisplayName` | Save button handler | WIRED | `handleSave()` at line 49 calls `useAuthStore.getState().updateDisplayName(editName)` |
| `Sidebar.tsx` | `authStore.signOut` | `handleSignOut` | WIRED | Line 59 calls `useAuthStore.getState().signOut()` after closing drawer |
| `ListPage.tsx` | `uiStore.restoreBanner` | Share2 button onClick | WIRED | Line 370: `onClick={() => restoreBanner(list.share_code)}` |
| `ListPage.tsx` | `CategorySection.tsx` | `currentUserId` prop | WIRED | Lines 431-433 pass all three current-user props |
| `CategorySection.tsx` | `ItemRow.tsx` | `currentUserId` prop | WIRED | Lines 68-70 pass all three props to each ItemRow in map |
| `ItemRow.tsx` | `AttributionBadge.tsx` | `avatarUrl` prop | WIRED | Line 265: `avatarUrl={currentUserAvatarUrl ?? undefined}` |
| `authStore.ts` | `supabase.auth.updateUser` | async call | WIRED | Line 79: `await supabase.auth.updateUser({ data: { display_name: trimmed } })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `Sidebar.tsx` ProfileSection | `resolvedDisplayName` | `user.user_metadata` (from authStore) | Yes — server-populated on OAuth | FLOWING |
| `Sidebar.tsx` ProfileSection | `avatarUrl` | `user.user_metadata.avatar_url` (from authStore) | Yes — Google CDN URL from OAuth | FLOWING |
| `ItemRow.tsx` attribution | `currentUserDisplayName` | `resolveDisplayName(user)` in ListPage | Yes — derived from authenticated user | FLOWING |
| `ItemRow.tsx` attribution | `currentUserAvatarUrl` | `user.user_metadata.avatar_url` in ListPage | Yes — same Google CDN URL | FLOWING |
| `ListPage.tsx` Share2 | `dismissedBanners` | `useUIStore` in-memory Set | Yes — toggled by real user interaction | FLOWING |

**Known observation (non-blocking):** An optimistically-added item in `itemsStore.addItem` omits `user_id` from the optimistic object, so a freshly-added item shows an initials badge for ~200ms before the DB round-trip returns the server-assigned `user_id` and the real-time subscription flips it to the avatar. Persisted, fetched, and real-time items correctly show the avatar. This is a cosmetic race condition with no data correctness impact.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| uiStore restoreBanner removes code | `npx vitest run src/stores/uiStore.test.ts` | All tests PASS | PASS |
| AttributionBadge avatar + fallback | `npx vitest run src/components/AttributionBadge.test.tsx` | All 5 tests PASS | PASS |
| ItemRow own-item attribution | `npx vitest run src/components/ItemRow.test.tsx` | All tests PASS | PASS |
| Sidebar profile section | `npx vitest run src/components/Sidebar.test.tsx` | All tests PASS | PASS |
| Share2 re-expand NAV-03 | `npx vitest run src/pages/ListPage.test.tsx` | 17 tests PASS (incl. NAV-03 describe block) | PASS |
| Full suite | `npx vitest run` | 161/161 PASS (21 files) | PASS |
| TypeScript | `npx tsc --noEmit` | No output — clean | PASS |

### Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| PROF-01 | Phase 9 | User can edit their display name | SATISFIED | `authStore.updateDisplayName` + Sidebar inline-edit UI + Save button wired |
| PROF-02 | Phase 9 | User's Google avatar displays in sidebar and item attribution | SATISFIED (code) | `AttributionBadge` with `avatarUrl` + `referrerPolicy`; Sidebar ProfileSection; ItemRow own-item path |
| PROF-03 | Phase 9 | User can sign out | SATISFIED (code) | Sidebar Sign out button → `handleSignOut` → drawer close → `authStore.signOut()` |
| NAV-03 | Phase 9 | User can re-expand dismissed share code header | SATISFIED | `uiStore.restoreBanner` + Share2 button in ListPage header |

All four requirements mapped to Phase 9 in REQUIREMENTS.md are covered. No orphaned Phase 9 requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No debt markers (TBD/FIXME/XXX), no stubs, no empty handlers found in any phase-modified file |

### Human Verification Required

Six items from the `checkpoint:human-verify` task in Plan 09-04 require a live Google-authenticated browser session. These were auto-deferred by the executor and recorded here for UAT.

#### 1. Sidebar Avatar (PROF-02)

**Test:** Sign in with Google, open the sidebar drawer. Confirm your Google avatar appears as a 40px circle (not initials). Check DevTools Network — the avatar `img` request must have no `Referer` header.
**Expected:** Circular avatar photo from Google CDN renders; no Referer header sent.
**Why human:** `referrerPolicy="no-referrer"` and Google CDN behavior require a live OAuth session.

#### 2. Display Name Edit + Persistence (PROF-01)

**Test:** Tap the pencil icon in the sidebar. Change name to "Test Name". Tap "Save name". Verify: (a) sidebar immediately shows "Test Name", (b) own items update attribution live, (c) refresh page — name persists.
**Expected:** Optimistic update visible immediately; persists in Supabase `user_metadata` across refreshes.
**Why human:** `supabase.auth.updateUser` persistence and cross-session durability require a live session.

#### 3. Avatar on Own Items (PROF-02)

**Test:** Add a new item while signed in. Confirm the 28px attribution badge shows your Google avatar (not an initials circle).
**Expected:** Circular avatar image from Google CDN appears on own items.
**Why human:** Requires real `avatar_url` in `user_metadata` from a Google OAuth session.

#### 4. Sign Out Sequence (PROF-03)

**Test:** Tap "Sign out" in the sidebar. Confirm: (a) sidebar closes immediately, (b) redirect to `/`, (c) sidebar is not visible over the login screen.
**Expected:** Drawer closes first; redirect fires after; no visual overlap with login page.
**Why human:** Redirect sequencing and visual correctness require a live browser session.

#### 5. Share Code Re-Expand (NAV-03)

**Test:** Dismiss the share code banner via the × button. Confirm Share2 icon appears in the header. Tap it — confirm banner reappears and Share2 icon disappears.
**Expected:** Toggle is lossless in both directions.
**Why human:** Visual banner toggle correctness and the full round-trip interaction require a live browser.

#### 6. No Name Prompt (D-10)

**Test:** Navigate to any list while signed in. Confirm: no name prompt dialog appears, AddItemBar input is active, added items show your auth display name as attribution.
**Expected:** Anonymous-name model fully retired; auth identity drives all attribution.
**Why human:** End-to-end flow combining auth state, AddItemBar, and attribution requires a live session.

### Gaps Summary

No automated gaps. All four success criteria are verified in the codebase. Status is `human_needed` because six browser-level behaviors — Google avatar rendering with `referrerPolicy`, display-name persistence to Supabase, sign-out redirect sequencing, and live UI toggle fidelity — cannot be verified without a real Google-authenticated session.

---

_Verified: 2026-05-29T12:47:00Z_
_Verifier: Claude (gsd-verifier)_
