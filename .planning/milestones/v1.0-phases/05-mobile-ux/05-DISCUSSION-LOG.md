# Phase 5: Mobile UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 05-mobile-ux
**Areas discussed:** Autocomplete suggestions, Entry speed & focus, Deploy & ship polish, Tap target audit
**Mode:** User deferred to Claude's recommendations for all areas

---

## Autocomplete Suggestions (LIST-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Same-list history | Query distinct names from current list's items table | ✓ |
| Cross-list history | Query from all lists the user has interacted with | |
| External suggestions | Pre-populated grocery item database | |

**User's choice:** Claude recommendation — same-list history with prefix match
**Notes:** Pre-fill category/qty from most recent match. Dropdown below input, 5-8 results. Select populates but doesn't auto-submit.

---

## Entry Speed & Focus (UX-03)

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-focus | User taps input to start — keyboard doesn't appear automatically | ✓ |
| Auto-focus on load | Keyboard appears immediately on page load | |
| Auto-focus after dialog | Focus input only after NamePromptDialog completes | |

**User's choice:** Claude recommendation — no auto-focus
**Notes:** Current 2-tap path (focus + submit) already meets the "under 3 taps" requirement. Auto-focus is jarring on mobile, especially with NamePromptDialog on first visit.

---

## Deploy & Ship Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal ship polish | Fix title, add theme-color, apple-touch-icon, vercel.json SPA rewrite | ✓ |
| Full PWA setup | Add manifest.json, service worker, offline support | |
| Title fix only | Just fix the temp-scaffold title, skip meta tags | |

**User's choice:** Claude recommendation — minimal ship polish (no PWA)
**Notes:** Offline mode is explicitly out of scope. Ship polish covers: title fix, theme-color, apple-touch-icon, vercel.json.

---

## Tap Target Audit (UX-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix non-compliant only | Bump Select triggers to 44px, enlarge checkbox tap area, pad "More details" | ✓ |
| Comprehensive 48px | Make ALL interactive elements 48px minimum (exceeds spec) | |
| Leave as-is | Current sizes are acceptable for secondary controls | |

**User's choice:** Claude recommendation — fix non-compliant controls to 44px minimum
**Notes:** ItemRow/AddItemBar/Add button already 48px. Category Select triggers (32px), checkbox wrapper, and "More details" toggle need bumping.

---

## Claude's Discretion

- Autocomplete debounce strategy (likely unnecessary for small cached list)
- Autocomplete dismiss behavior (standard combobox patterns)
- Icon asset generation for apple-touch-icon
- Desktop layout adjustments beyond max-w-md (likely none needed)

## Deferred Ideas

None — discussion stayed within phase scope.
