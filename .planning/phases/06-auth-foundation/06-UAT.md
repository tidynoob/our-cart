---
status: complete
phase: 06-auth-foundation
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md]
started: 2026-05-28T00:00:00Z
updated: 2026-05-28T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start fresh (npm run dev). App boots without console errors, the landing page loads, and auth state resolves (logged-out sign-in screen OR logged-in list view) without crash or hang.
result: pass

### 2. Logged-Out Landing Page
expected: While signed out, visiting / shows the "Our Cart" heading, "Your shared grocery list" subtitle, and a "Sign in with Google" button. No create/join list forms are visible.
result: pass

### 3. Google Sign-In Flow
expected: Clicking "Sign in with Google" redirects to Google's consent screen. After approving, you are returned to the app and land in the authenticated view.
result: pass

### 4. Authenticated Landing Page
expected: While signed in, visiting / shows the create-list / join-list forms (the original landing content), not the sign-in button.
result: pass

### 5. Protected Route Redirect
expected: While signed out, visiting a /list/:code URL directly redirects you to / (the sign-in screen). You never see protected list content while unauthenticated.
result: pass

### 6. Return-to-URL After Login
expected: While signed out, visit a /list/:code URL (redirects to /). Sign in with Google. After returning from OAuth, you land on that original /list/:code URL, not on /.
result: pass

### 7. Auth Loading State (no login flash)
expected: On a hard refresh while signed in, you see a brief loading spinner (not a flash of the sign-in screen) before the authenticated content appears.
result: pass

### 8. Database Auth Migrations Applied
expected: In Supabase Dashboard, items table has a user_id column and lists table has an owner_id column, with auth-aware RLS policies (items_select/insert/update/delete, lists_select/insert/update/delete). Existing anonymous items/lists still load (backward compatible).
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
