---
status: complete
phase: 01-foundation
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-05-25T03:10:00Z
updated: 2026-05-25T03:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from scratch. Server boots without errors. Opening http://localhost:5173 shows the Landing Page with "Our Cart" heading and Create/Join sections. No console errors.
result: pass

### 2. Create a New List
expected: On the Landing Page, type a list name (e.g., "Groceries") in the Create section and submit. You are navigated to /list/XXXXXXXX (8-char code in URL). The page shows the list name you entered. A ShareBanner appears at the top showing the share code.
result: pass

### 3. Share Banner — Copy Link
expected: On the list page (after creating), click the "Copy link" button in the ShareBanner. Button text briefly changes to "Copied!" (~2 seconds). The share URL is now in your clipboard (paste to verify).
result: pass

### 4. Share Banner — Dismiss
expected: Click the dismiss button (X icon) on the ShareBanner. Banner disappears. Refreshing the page — banner stays hidden (Zustand persists in session). Note: banner reappears on hard reload since Zustand is in-memory only.
result: pass

### 5. Join a List via Code
expected: Go back to Landing Page (/). In the "Join a list" section, paste the 8-char share code from Test 2. Submit. You are navigated to /list/CODE and see the same list name from Test 2.
result: pass

### 6. Join via Full URL
expected: On the Landing Page, paste the full URL (e.g., http://localhost:5173/list/AbCd1234) into the Join input. Submit. You are navigated to the correct list page showing the list name.
result: pass

### 7. Invalid Share Code Rejected
expected: On the Landing Page Join section, type an invalid code (e.g., "abc" — too short, or "!!!!" — invalid chars). Submit. Nothing happens (no navigation). Form shows validation feedback or simply doesn't navigate.
result: pass

### 8. Direct URL to Non-Existent List
expected: Navigate to /list/ZZZZZZZZ (a code that doesn't exist in Supabase). Page shows "List not found" message — no crash, no raw error details exposed.
result: pass

### 9. 404 Page
expected: Navigate to a completely invalid URL like /foobar. A "Not Found" page appears with a link back to the home page. Clicking the link takes you to /.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
