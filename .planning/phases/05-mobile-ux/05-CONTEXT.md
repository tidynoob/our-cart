# Phase 5: Mobile UX - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers phone-first polish, fast item entry, autocomplete from history, and deployment readiness. The app must be fast and frictionless on a phone — adding an item takes under 3 taps and works one-handed in a store. The layout is phone-first and fully usable on desktop. All tap targets meet the 44px minimum. Previously added items surface as autocomplete suggestions during name entry. The app ships with proper meta tags, title, and Vercel hosting config.

Requirements: UX-01, UX-02, UX-03, LIST-05.

**Out of scope:** PWA / offline mode (explicitly excluded), push notifications (excluded), multiple lists (v2), user accounts (excluded), aisle mapping (excluded).

</domain>

<decisions>
## Implementation Decisions

### Autocomplete Suggestions (LIST-05)
- **D-01:** Source data from the same list — `SELECT DISTINCT name, category, quantity FROM items WHERE list_id = ?`. Query on component mount and cache in local state. No cross-list suggestions.
- **D-02:** Case-insensitive prefix match. Filter locally from the cached distinct-names list as the user types. No server-side search per keystroke.
- **D-03:** Show top 5-8 matches in a dropdown below the name input. Each suggestion shows the item name and category (if set). Tap a suggestion to populate the name field and pre-fill category/quantity from the most recent matching item.
- **D-04:** Selecting a suggestion populates fields but does NOT auto-submit. User confirms with the Add button or Enter key. This preserves the ability to adjust quantity before adding.

### Entry Speed & Focus (UX-03)
- **D-05:** No auto-focus on page load. On mobile, auto-showing the keyboard is jarring — especially on first visit when the NamePromptDialog is displayed. Manual tap to focus is intentional.
- **D-06:** Current entry path is already under 3 taps: tap input (1) → type name → press Enter or tap Add (1) = 2 taps. With autocomplete: tap input (1) → type prefix → tap suggestion (2) = 2 taps. No structural change needed — autocomplete just reduces typing.

### Deploy & Ship Polish
- **D-07:** Fix `<title>` from "temp-scaffold" to "Our Cart" in `index.html`.
- **D-08:** Add `<meta name="theme-color">` matching the app's primary background color. Add `<link rel="apple-touch-icon">` with an appropriate icon for iOS home screen bookmarks.
- **D-09:** Create `vercel.json` with SPA rewrite rule — all paths serve `index.html` so client-side routing (`/list/:code`) works on direct URL access and page refresh.
- **D-10:** No PWA manifest or service worker — offline mode is explicitly out of scope. Keep it simple.

### Tap Target Audit (UX-02)
- **D-11:** ItemRow display mode (48px), AddItemBar name input (48px), Add button (48px) — already compliant. No changes.
- **D-12:** Category Select triggers in AddItemBar and ItemRow edit mode are `h-8` (32px) — bump to `h-11` (44px) minimum.
- **D-13:** Checkbox wrapper in ItemRow — ensure 44px effective tap area via min-width/min-height and padding on the wrapper div, even if the visual checkbox remains smaller.
- **D-14:** "More details" toggle in AddItemBar — add vertical padding to reach 44px min touch target.

### Claude's Discretion
- **Autocomplete debounce:** Whether to debounce the local filter (probably unnecessary for a small cached list, but planner decides).
- **Autocomplete dismiss behavior:** How the dropdown closes (blur, Escape, selection). Standard combobox patterns apply.
- **Icon assets:** Whether to generate a simple SVG icon for apple-touch-icon or reuse/adapt the existing `favicon.svg`.
- **Desktop layout:** The `max-w-md` centered column works for a phone-first app used on desktop. Planner decides if any desktop-specific adjustments are warranted beyond what's already there.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value (real-time shared list), $0-budget / 2-user constraints, mobile-first
- `.planning/REQUIREMENTS.md` — UX-01, UX-02, UX-03, LIST-05 (the requirements for this phase)
- `.planning/ROADMAP.md` §Phase 5 — Goal ("under 3 taps", "one-handed in a store") and success criteria
- `.planning/STATE.md` §Accumulated Context — locked decisions from prior phases

### Prior Phases
- `.planning/phases/02-list-management/02-CONTEXT.md` — D-01/02/03 (input at top, expandable details, always visible), D-04/05/06 (category system), D-07 (attribution badge layout)
- `.planning/phases/03-shopping-flow/03-CONTEXT.md` — D-01 (checkbox separate from row tap), D-02 (row layout order), D-05 (checked visual style)
- `.planning/phases/04-real-time-sync/04-CONTEXT.md` — D-09 (subscription lifecycle in itemsStore)

### Technology
- `CLAUDE.md` §Technology Stack — React 19, Vite 8, Supabase, Tailwind v4, Zustand, shadcn/ui
- `index.html` — Current meta tags (viewport set, title needs fix, no theme-color/apple-touch-icon)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/AddItemBar.tsx` — Entry form with name input, expandable qty/category. Autocomplete dropdown attaches below the name `<Input>`. Select triggers need height bump.
- `src/components/ItemRow.tsx` — Display mode already 48px min-height. Checkbox wrapper div needs 44px tap area enforcement. Edit mode Select triggers need height bump.
- `src/components/ui/input.tsx` — shadcn Input, already `text-base` (prevents iOS zoom).
- `src/components/ui/select.tsx` — shadcn Select; trigger height controlled via className override.
- `src/stores/itemsStore.ts` — Has `items` array. Autocomplete can derive distinct names from current items or query Supabase for historical (deleted) items too.
- `src/lib/supabase.ts` — Client for querying distinct item names.
- `src/pages/ListPage.tsx` — Container is `max-w-md p-4` centered. Owns AddItemBar + CategorySection rendering.

### Established Patterns
- Store owns server data + mutation logic; ListPage owns ephemeral UI state.
- Tailwind v4 utility classes; `min-h-[48px]` / `min-h-[44px]` for tap targets.
- shadcn/ui primitives + className overrides for sizing.
- `text-base` (16px) on all text inputs to prevent iOS auto-zoom.

### Integration Points
- `AddItemBar.tsx` — autocomplete dropdown mounts below the name input; needs access to suggestion data (passed as prop or fetched internally).
- `index.html` — meta tags, title, apple-touch-icon link.
- Project root — `vercel.json` for SPA rewrite config.
- All Select triggers across components — height class override from `h-8` to `h-11`.

</code_context>

<specifics>
## Specific Ideas

- "Under 3 taps" is already met by current design (2 taps: focus + submit). Autocomplete reduces typing, not taps.
- Autocomplete pre-filling category/qty from history is the key UX win — users buy the same staples weekly.
- Deploy polish is minimal but critical: the app still says "temp-scaffold" in the browser tab.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Mobile UX*
*Context gathered: 2026-05-26*
