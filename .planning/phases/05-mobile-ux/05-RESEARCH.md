# Phase 5: Mobile UX - Research

**Researched:** 2026-05-26
**Domain:** React combobox autocomplete, mobile tap-target enforcement, Vercel SPA deployment, HTML meta tag hardening
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Autocomplete Suggestions (LIST-05)**
- D-01: Source data from `SELECT DISTINCT name, category, quantity FROM items WHERE list_id = ?`. Query on component mount and cache in local state. No cross-list suggestions.
- D-02: Case-insensitive prefix match. Filter locally from the cached distinct-names list as the user types. No server-side search per keystroke.
- D-03: Show top 5-8 matches in a dropdown below the name input. Each suggestion shows the item name and category (if set). Tap a suggestion to populate the name field and pre-fill category/quantity from the most recent matching item.
- D-04: Selecting a suggestion populates fields but does NOT auto-submit. User confirms with the Add button or Enter key.

**Entry Speed & Focus (UX-03)**
- D-05: No auto-focus on page load. Manual tap to focus is intentional.
- D-06: Current entry path is already under 3 taps (2 taps: focus input + press Enter or tap Add). No structural change needed — autocomplete just reduces typing.

**Deploy & Ship Polish**
- D-07: Fix `<title>` from "temp-scaffold" to "Our Cart" in `index.html`.
- D-08: Add `<meta name="theme-color" content="#ffffff">` and `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.
- D-09: Create `vercel.json` with SPA rewrite rule (`"source": "/(.*)"` → `"destination": "/index.html"`).
- D-10: No PWA manifest or service worker.

**Tap Target Audit (UX-02)**
- D-11: ItemRow display mode (48px), AddItemBar name input (48px), Add button (48px) — already compliant. No changes.
- D-12: Category Select triggers in AddItemBar and ItemRow edit mode are `h-8` (32px) — bump to `h-11` (44px minimum).
- D-13: Checkbox wrapper already 44x44px (confirmed in `src/components/ui/checkbox.tsx` line 12: `h-[44px] w-[44px]`). No change needed.
- D-14: "More details" toggle in AddItemBar — add `min-h-[44px] flex items-center` to reach 44px min touch target.

### Claude's Discretion
- Autocomplete debounce: Whether to debounce the local filter (probably unnecessary for a small cached list, but planner decides).
- Autocomplete dismiss behavior: How the dropdown closes (blur, Escape, selection). Standard combobox patterns apply.
- Icon assets: Whether to generate a simple SVG icon for apple-touch-icon or reuse/adapt the existing `favicon.svg`.
- Desktop layout: The `max-w-md` centered column works for a phone-first app used on desktop. Planner decides if any desktop-specific adjustments are warranted beyond what's already there.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Layout is phone-first and responsive (works on desktop too) | Existing `max-w-md p-4` container is already phone-first. No structural change needed. Desktop resolution: centered narrow column is intentional. |
| UX-02 | Tap targets are large enough for one-handed use while walking (min 44px) | Audit complete: 3 elements need fixing (SelectTrigger h-8→h-11, "More details" toggle min-h-[44px]). Checkbox wrapper already compliant. |
| UX-03 | Adding an item takes fewer than 3 taps from app open | Already met: tap input (1) + type + Enter/Add (2) = 2 taps. Autocomplete path: tap input (1) + type prefix + tap suggestion (2) = 2 taps. No structural change needed. |
| LIST-05 | Previously added items appear as autocomplete suggestions during entry | Requires new AutocompleteSuggestions component in AddItemBar, Supabase distinct-names query on mount, local prefix-filter state, ARIA combobox attributes. |
</phase_requirements>

---

## Summary

Phase 5 is a focused polish phase operating on an already-functional codebase. Four distinct work tracks exist: (1) autocomplete for the name input in AddItemBar, (2) tap-target fixes for two elements, (3) HTML meta tag and title hardening, and (4) Vercel deployment config. The largest new feature is the autocomplete dropdown — a custom combobox built directly in AddItemBar using local state and a one-time Supabase query.

No new npm packages are required. The autocomplete is built with React local state and the Supabase client already in the project. The deploy polish work is configuration-only: editing `index.html`, generating a 180x180 PNG from the existing `favicon.svg`, and creating `vercel.json`. The tap-target fixes are Tailwind class changes on two existing components.

The UI-SPEC (05-UI-SPEC.md, approved 2026-05-26) has already resolved all Claude's Discretion items. The planner should treat those resolutions as locked: autocomplete uses no debounce, dropdown dismisses on blur/Escape/selection, apple-touch-icon is adapted from `favicon.svg`, and no desktop layout changes are needed.

**Primary recommendation:** Build the autocomplete as inline state within `AddItemBar.tsx` (not a new store action), fetch distinct names once on mount via Supabase, and filter locally. This is the simplest approach that satisfies all decision points.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Autocomplete suggestions | Browser / Client | Database / Storage | Filtering is local (client); distinct-names query is a one-time DB read on mount |
| Tap target enforcement | Browser / Client | — | Pure CSS/Tailwind class changes on existing components |
| HTML meta tags / title | Browser / Client | CDN / Static | `index.html` is a static asset served by Vite/Vercel |
| Apple touch icon | CDN / Static | — | 180x180 PNG placed in `public/` — served as a static file |
| Vercel SPA rewrite | CDN / Static | — | `vercel.json` rewrite rule handled by Vercel edge layer |
| Entry speed (UX-03) | Browser / Client | — | Already satisfied by existing form structure; autocomplete improves it |
| Phone-first layout | Browser / Client | — | Existing `max-w-md` container; no change needed |

---

## Standard Stack

### Core (no new packages — all already installed)

| Library | Current Version | Purpose in Phase | Confirmed |
|---------|----------------|-----------------|-----------|
| React | 19.2.6 | Local state for autocomplete (`useState`, `useRef`, `useEffect`) | [VERIFIED: package.json] |
| @supabase/supabase-js | 2.106.1 | One-time `SELECT DISTINCT name, category, quantity` query on mount | [VERIFIED: package.json] |
| Tailwind CSS | 4.3.0 | `h-11`, `min-h-[44px]`, `min-h-[44px] flex items-center` class changes | [VERIFIED: package.json] |
| Zustand | 5.0.13 | No new store actions needed for this phase | [VERIFIED: package.json] |

### No New Packages Required

This phase installs zero new npm dependencies. All required capabilities are covered by the existing stack:
- Autocomplete: React local state + existing Supabase client
- Dropdown positioning: absolute CSS positioning (no Floating UI needed — the input container is already in normal document flow)
- Icon conversion: browser-based or static tooling (SVG → PNG)

**Installation:** No `npm install` step needed for this phase.

---

## Package Legitimacy Audit

No external packages are being installed in this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
User types in AddItemBar name input
        |
        v
[Local prefix filter] <--- distinctNames[] (loaded once on mount from Supabase)
        |
        v (if matches exist and input non-empty)
[AutocompleteSuggestion dropdown]
  - role="listbox", z-50, absolute below input
  - max 8 items, min-h-[44px] per item
  - keyboard: ArrowDown/Up navigate, Enter selects, Escape closes
  - touch: tap selects
        |
        v (on selection)
[Populate name, category, quantity fields in AddItemBar]
        | (NOT auto-submit per D-04)
        v
[User confirms with Add button or Enter key]
        |
        v
[addItem() → Supabase INSERT → optimistic update]
```

### Recommended Project Structure

No new directories. All changes touch existing files plus two new files:

```
src/
  components/
    AddItemBar.tsx          # Modified: add autocomplete state + dropdown render
    ItemRow.tsx             # Modified: SelectTrigger h-8 → h-11 in edit mode
    AutocompleteSuggestions.tsx  # New: the dropdown component (extracted for testability)
index.html                  # Modified: title, theme-color, apple-touch-icon
public/
  apple-touch-icon.png      # New: 180x180 PNG adapted from favicon.svg
vercel.json                 # New: SPA rewrite rule
```

### Pattern 1: Autocomplete as Component-Local State (not store)

**What:** `AddItemBar` fetches distinct names once on mount, stores in `useState`, filters locally on each keystroke.

**When to use:** When suggestion data is a small, bounded list (in this case, at most a few dozen distinct item names per list). No server round-trip per keystroke, no debounce needed.

**Example:**
```typescript
// Source: React docs — useState for derived filtering
const [distinctItems, setDistinctItems] = useState<DistinctItem[]>([])
const [suggestions, setSuggestions] = useState<DistinctItem[]>([])

// Fetch once on mount
useEffect(() => {
  async function loadDistinctItems() {
    const { data } = await supabase
      .from('items')
      .select('name, category, quantity')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
    if (data) {
      // Deduplicate by name (case-insensitive), keeping most recent
      const seen = new Set<string>()
      const deduped = data.filter((item) => {
        const key = item.name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setDistinctItems(deduped)
    }
  }
  loadDistinctItems()
}, [listId]) // [ASSUMED] — standard React pattern; Supabase client already confirmed

// Filter on name change
function handleNameChange(value: string) {
  setName(value)
  if (value.trim().length === 0) {
    setSuggestions([])
    return
  }
  const lower = value.toLowerCase()
  const matches = distinctItems
    .filter((item) => item.name.toLowerCase().startsWith(lower))
    .slice(0, 8)
  setSuggestions(matches)
}
```

**Key detail:** The CONTEXT.md D-01 says `SELECT DISTINCT name, category, quantity`. In practice, Supabase `.select()` with `.order('created_at', { ascending: false })` and client-side deduplication by lowercase name achieves the same result while retaining the most-recent category/quantity for pre-fill. Alternatively, a raw SQL query via `.rpc()` or a view could enforce true DISTINCT, but client-side dedup is simpler and sufficient for a list of at most ~50 items. [ASSUMED — approach choice for planner]

### Pattern 2: ARIA Combobox on the Name Input

**What:** Add `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` to the name `<Input>` to make the autocomplete screen-reader accessible.

**When to use:** Any input that controls a popup listbox.

**Example:**
```typescript
// Source: ARIA Authoring Practices Guide — Combobox Pattern
<Input
  type="text"
  value={name}
  onChange={(e) => handleNameChange(e.target.value)}
  onKeyDown={handleKeyDown}
  role="combobox"
  aria-expanded={suggestions.length > 0}
  aria-controls="autocomplete-listbox"
  aria-activedescendant={focusedIndex >= 0 ? `suggestion-${focusedIndex}` : undefined}
  aria-autocomplete="list"
  placeholder="Add an item..."
  className="min-h-[48px] flex-1 text-base"
/>
```

**Dropdown:**
```typescript
// The listbox container
<ul
  id="autocomplete-listbox"
  role="listbox"
  className="absolute left-0 right-0 z-50 mt-1 max-h-[280px] overflow-y-auto rounded-lg border border-border bg-popover shadow-md"
>
  {suggestions.map((item, index) => (
    <li
      key={item.name}
      id={`suggestion-${index}`}
      role="option"
      aria-selected={index === focusedIndex}
      className="flex min-h-[44px] cursor-pointer items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-accent hover:text-accent-foreground"
      onMouseDown={(e) => e.preventDefault()} // prevent input blur before onClick
      onClick={() => handleSuggestionSelect(item)}
    >
      <span className="flex-1 text-base">{item.name}</span>
      {item.category && (
        <span className="text-sm text-muted-foreground">{item.category}</span>
      )}
    </li>
  ))}
</ul>
```

**Critical detail:** `onMouseDown={(e) => e.preventDefault()` on each suggestion item is essential. Without it, clicking a suggestion fires `blur` on the input first, which clears the suggestions before the `onClick` can fire. This is the same pattern already used in `ItemRow.tsx` for Select and Button elements to prevent focus-scope conflicts. [VERIFIED: existing codebase pattern — ItemRow.tsx lines 185, 202, 211]

### Pattern 3: SelectTrigger Height Override

**What:** Pass `className="h-11 flex-1"` to override the shadcn SelectTrigger's default `data-[size=default]:h-8`.

**When to use:** Any SelectTrigger that needs to meet the 44px tap target minimum.

**Example:**
```typescript
// Source: existing codebase — same override pattern used for h-12 on Add button
// Change from: className="h-8 flex-1"
// Change to:   className="h-11 flex-1"
<SelectTrigger className="h-11 flex-1" disabled={isInert}>
  <SelectValue placeholder="Category" />
</SelectTrigger>
```

**Key detail:** The shadcn `SelectTrigger` in this project (`src/components/ui/select.tsx`) uses `data-[size=default]:h-8` as its default. A direct `h-11` className override wins in Tailwind v4 because the explicit class takes precedence via `tailwind-merge` (the project uses `tailwind-merge` via the `cn()` utility). [VERIFIED: src/components/ui/select.tsx line 42 — `data-[size=default]:h-8`; src/lib/utils.ts uses tailwind-merge]

### Pattern 4: "More Details" Toggle Tap Target Fix

**What:** Add `min-h-[44px] flex items-center` to the existing `<button>` for the "More details" toggle.

**Example:**
```typescript
// Source: CONTEXT.md D-14
// Change from:
<button type="button" onClick={...} className="self-start text-sm text-muted-foreground hover:text-foreground">
// Change to:
<button type="button" onClick={...} className="self-start min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground">
```

### Pattern 5: vercel.json SPA Rewrite

**What:** Single JSON file at project root. All paths serve `index.html` so `/list/:code` works on direct URL access and page refresh.

**Example:**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Source:** [CITED: vercel.com/docs/projects/project-configuration#rewrites] — Vercel's official SPA fallback pattern for client-side routers.

### Anti-Patterns to Avoid

- **Auto-submitting on suggestion selection:** D-04 explicitly prohibits this. The user must confirm with Add or Enter. A mistake here would be a regression.
- **Debouncing the local filter:** Adds latency with no benefit. The cached list is at most ~50 items; prefix filtering is O(n) and imperceptible.
- **Fetching suggestions on every keystroke:** D-02 explicitly requires local filtering from the cached list. A Supabase query per keystroke would waste bandwidth and add latency.
- **Using `SELECT DISTINCT` via `.select()` column:** Supabase PostgREST does not support SQL `DISTINCT` via the column selector. Use `.order('created_at', { ascending: false })` with client-side deduplication by lowercase name instead. [ASSUMED — based on PostgREST behavior; planner should verify if a simpler approach exists, e.g., a database view]
- **Positioning the dropdown with `position: fixed`:** Using absolute positioning relative to the input container is simpler and avoids iOS Safari viewport bugs with fixed positioning on scroll.
- **forgetting `onMouseDown preventDefault` on suggestion items:** Without this, clicking a suggestion fires input blur first, closing the dropdown before onClick fires.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown positioning | Custom portal + coordinates | Absolute CSS relative to input container | The name input is in normal flow; no scroll-aware positioning needed for a fixed-top form |
| Combobox state machine | Custom keyboard nav logic | Simple `useState(focusedIndex)` with ArrowUp/Down handlers | For 5-8 static suggestions, a simple array index is sufficient |
| Distinct-names deduplication | SQL view or RPC | Client-side `Set` dedup on the fetched array | The list is small enough; no DB-side complexity needed |

**Key insight:** This phase's complexity ceiling is low. The codebase already handles the hard parts (Supabase integration, optimistic updates, focus management). Resist the temptation to reach for additional libraries.

---

## Common Pitfalls

### Pitfall 1: Suggestion Click Lost to Input Blur
**What goes wrong:** Clicking a suggestion item closes the dropdown before the click registers.
**Why it happens:** Clicking on the dropdown removes focus from the input, firing `onBlur` on the input. If the blur handler clears suggestions, the item's `onClick` never fires.
**How to avoid:** Add `onMouseDown={(e) => e.preventDefault()}` to each suggestion `<li>`. This prevents the mousedown from transferring focus away from the input before the click completes.
**Warning signs:** Dropdown flashes closed when tapping/clicking suggestions; no fields are populated.

### Pitfall 2: iOS Safari Keyboard Pushes Dropdown Off-Screen
**What goes wrong:** On mobile, the virtual keyboard reduces the viewport height. An absolutely positioned dropdown below the input may be clipped by the keyboard.
**Why it happens:** iOS Safari's viewport height shrinks when the keyboard appears. Elements positioned `absolute` with `top` offsets may fall outside the visible area.
**How to avoid:** The `max-h-[280px]` cap from the UI-SPEC limits height. The dropdown is below the input which is pinned at the top of the list — this position is naturally above the keyboard. Test on a real device or BrowserStack.
**Warning signs:** Suggestions visible in desktop browser but not visible on iOS when keyboard is open.

### Pitfall 3: SelectTrigger h-11 Class War with data-attribute Default
**What goes wrong:** Adding `h-11` to `SelectTrigger` has no effect because the data-attribute selector `data-[size=default]:h-8` has higher specificity.
**Why it happens:** In Tailwind v4 with arbitrary data-attribute variants, the specificity rules depend on how `tailwind-merge` resolves conflicts.
**How to avoid:** The project's `cn()` utility uses `tailwind-merge` which handles Tailwind class conflicts correctly. An explicit `h-11` in `className` will override the default `data-[size=default]:h-8` because tailwind-merge treats both as height utilities and the latter wins. Verify by inspecting computed styles after change.
**Warning signs:** Select trigger still renders at 32px after the class change.

### Pitfall 4: Apple Touch Icon Size
**What goes wrong:** iOS shows a blurry or cropped icon on home screen.
**Why it happens:** iOS requires exactly 180x180px for the apple-touch-icon. Smaller icons get upscaled; the SVG is 48x46.
**How to avoid:** Generate a 180x180 PNG. The SVG has a white-background canvas design — center the lightning bolt on a solid `#863bff` background (or white, consistent with the theme-color `#ffffff`) at 180x180.
**Warning signs:** Icon appears blurry or pixelated on iOS home screen.

### Pitfall 5: vercel.json Placement
**What goes wrong:** `vercel.json` in a subdirectory has no effect; SPA routes return 404.
**Why it happens:** Vercel only reads `vercel.json` from the project root.
**How to avoid:** Place `vercel.json` at the repo root (same level as `package.json`).
**Warning signs:** `/list/:code` returns 404 on direct URL access after deployment.

### Pitfall 6: `SELECT DISTINCT` via PostgREST
**What goes wrong:** Trying to use `.select('distinct name, category, quantity')` or `.select('name, category, quantity').distinct()` fails — PostgREST does not expose SQL DISTINCT through the column selector.
**Why it happens:** The PostgREST API surface doesn't map directly to all SQL operations.
**How to avoid:** Fetch all items with `.order('created_at', { ascending: false })` and deduplicate client-side using a `Set` keyed on lowercase name (keeping the first occurrence = most recent).
**Warning signs:** TypeScript error on the Supabase query or runtime error about invalid query parameters.

---

## Code Examples

### Supabase Distinct Names Query (client-side dedup approach)

```typescript
// Source: [ASSUMED] — PostgREST limitation; see Pitfall 6
async function loadDistinctItems(listId: string) {
  const { data, error } = await supabase
    .from('items')
    .select('name, category, quantity')
    .eq('list_id', listId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  // Deduplicate by name (case-insensitive), most-recent first
  const seen = new Set<string>()
  return data.filter((item) => {
    const key = item.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

### Keyboard Navigation Handler

```typescript
// Source: ARIA Authoring Practices Guide — Combobox Pattern [ASSUMED]
function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (suggestions.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setFocusedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setFocusedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1))
  } else if (e.key === 'Enter' && focusedIndex >= 0) {
    e.preventDefault()
    handleSuggestionSelect(suggestions[focusedIndex])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    setSuggestions([])
    setFocusedIndex(-1)
  }
}
```

### Suggestion Selection Handler

```typescript
// Source: CONTEXT.md D-03, D-04
function handleSuggestionSelect(item: { name: string; category: string | null; quantity: string | null }) {
  setName(item.name)
  if (item.category) setCategory(item.category)
  if (item.quantity) setQuantity(item.quantity)
  setSuggestions([])
  setFocusedIndex(-1)
  setShowSuggestions(false)
  // D-04: Do NOT call handleSubmit here — user must confirm
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `SELECT DISTINCT` via SQL | Client-side dedup of ordered results | Workaround for PostgREST limitation; no perf difference at this scale |
| PWA manifest + service worker for "installability" | `apple-touch-icon` only | Correct for this app — offline mode is explicitly out of scope |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 CSS-first config | No config file needed; `h-11` works identically |

**Deprecated/outdated:**
- `manifest.json` + service worker for icon on iOS home screen: Not needed. `<link rel="apple-touch-icon">` alone enables "Add to Home Screen" bookmark with a custom icon on iOS, no manifest required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST does not support `SELECT DISTINCT` through the `.select()` column parameter — client-side dedup required | Architecture Patterns, Common Pitfalls | If DISTINCT is supported, the query could be simpler; no functional risk |
| A2 | `h-11` className override wins over `data-[size=default]:h-8` via tailwind-merge in the existing `cn()` setup | Architecture Patterns / Pattern 3 | If override fails, SelectTrigger stays at 32px; easy to detect and fix |
| A3 | The distinct-names query can be resolved client-side for ≤50 items without perceptible performance impact | Standard Stack | Correct for this app; would need a DB view approach for hundreds of items |
| A4 | Keyboard navigation approach: simple `focusedIndex` integer state (not a full ARIA `activedescendant` focus-trap implementation) is sufficient | Code Examples | Screen-reader UX may be suboptimal; functional UX is fine |

**If this table is empty:** It is not — four assumptions are logged above.

---

## Open Questions

1. **Apple touch icon background color**
   - What we know: The favicon is a purple lightning bolt on a transparent background. The theme-color is `#ffffff`.
   - What's unclear: Should the 180x180 PNG have a white background (matching theme-color) or a purple background (matching the icon's primary color)?
   - Recommendation: White background (`#ffffff`) is consistent with the theme-color meta tag and looks better on iOS home screens with light backgrounds. Planner decides.

2. **Autocomplete initial state: show suggestions on focus if name is empty?**
   - What we know: D-02 says filter on typed characters. D-05 says no auto-focus on page load.
   - What's unclear: If user taps the input with empty text, should all history items be shown (up to 8)?
   - Recommendation: Only show suggestions when `name.trim().length > 0`. Showing all items on empty tap is unexpected behavior for this type of combobox. Planner decides.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | Yes | (npm present) | — |
| Vercel CLI | Optional local preview | Not checked | — | Deploy via Git push |
| SVG-to-PNG conversion tool | D-08 apple-touch-icon | Not checked | — | Generate PNG manually using browser canvas or online tool |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- SVG-to-PNG conversion: Can be done via browser `<canvas>` + `toDataURL()`, or a simple Node.js script using `sharp` (if available), or by hand-authoring a minimal 180x180 PNG. No tooling dependency is strictly required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + @testing-library/react 16.3.0 + jsdom 26.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/components/AddItemBar.test.tsx` |
| Full suite command | `npx vitest run` |

**Existing suite status:** 78 tests passing across 10 test files. Zero failures.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIST-05 | Suggestions appear after typing prefix | unit | `npx vitest run src/components/AddItemBar.test.tsx` | No — Wave 0 |
| LIST-05 | Selecting suggestion populates name/category/qty fields | unit | `npx vitest run src/components/AddItemBar.test.tsx` | No — Wave 0 |
| LIST-05 | Selecting suggestion does NOT auto-submit (D-04) | unit | `npx vitest run src/components/AddItemBar.test.tsx` | No — Wave 0 |
| LIST-05 | Escape key dismisses dropdown | unit | `npx vitest run src/components/AddItemBar.test.tsx` | No — Wave 0 |
| LIST-05 | No suggestions shown when input is empty | unit | `npx vitest run src/components/AddItemBar.test.tsx` | No — Wave 0 |
| UX-02 | SelectTrigger renders at h-11 (44px) in AddItemBar | unit | `npx vitest run src/components/AddItemBar.test.tsx` | No — Wave 0 |
| UX-02 | SelectTrigger renders at h-11 (44px) in ItemRow edit mode | unit | `npx vitest run src/components/ItemRow.test.tsx` | No — Wave 0 |
| UX-01 | Page title is "Our Cart" | smoke (manual) | Manual check in browser | N/A |
| D-09 | vercel.json exists with correct rewrite rule | unit (file assertion) | `npx vitest run src/config/vercel.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/AddItemBar.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (78+ tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/AddItemBar.test.tsx` — covers LIST-05 autocomplete behaviors (D-01 through D-04)
- [ ] `src/components/ItemRow.test.tsx` — covers UX-02 SelectTrigger height in edit mode (if not already present)
- [ ] `src/config/vercel.test.ts` — simple file-existence + JSON content assertion for vercel.json

*(The existing `src/pages/ListPage.test.tsx` already mocks Supabase — AddItemBar.test.tsx can follow the same mock pattern.)*

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not touched in this phase |
| V3 Session Management | No | Not touched in this phase |
| V4 Access Control | No | No new data access patterns; distinct-names query scoped by `list_id = ?` (RLS enforced) |
| V5 Input Validation | Yes | Autocomplete suggestion data comes from the user's own list — no XSS vector; item names are displayed via React's JSX (no `dangerouslySetInnerHTML`) |
| V6 Cryptography | No | Not touched in this phase |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via autocomplete suggestion display | Tampering | React JSX escapes all text content by default; `{item.name}` in JSX is safe |
| RLS bypass in distinct-names query | Information Disclosure | Query uses `.eq('list_id', listId)` — Supabase RLS policy already restricts rows to the authenticated list (established in Phase 1) |
| Vercel rewrite exposing internal routes | Spoofing | The `/(.*) → /index.html` rewrite only applies to HTML navigation; API routes and static assets are unaffected |

**Security assessment:** This phase has minimal security surface. The largest concern is the new Supabase query for distinct names — it is correctly scoped by `list_id` and benefits from existing RLS. No new authentication or authorization logic is introduced.

---

## Sources

### Primary (HIGH confidence)
- `src/components/AddItemBar.tsx` — existing form structure, confirmed state shape
- `src/components/ItemRow.tsx` — confirmed `h-8` on SelectTrigger (line 183), focus-scope pattern
- `src/components/ui/select.tsx` — confirmed `data-[size=default]:h-8` default (line 42)
- `src/components/ui/checkbox.tsx` — confirmed D-13 already complete (`h-[44px] w-[44px]` on line 12)
- `src/stores/itemsStore.ts` — confirmed Supabase client usage and query patterns
- `index.html` — confirmed missing `theme-color`, `apple-touch-icon`, and `title = "temp-scaffold"`
- `package.json` — confirmed all dependency versions
- `vitest.config.ts` — confirmed test environment (jsdom, globals: true)
- Vitest run output — confirmed 78 tests passing, no gaps in existing coverage
- `.planning/phases/05-mobile-ux/05-CONTEXT.md` — all locked decisions (D-01 through D-14)
- `.planning/phases/05-mobile-ux/05-UI-SPEC.md` — approved visual contract, component inventory

### Secondary (MEDIUM confidence)
- [CITED: vercel.com/docs/projects/project-configuration#rewrites] — Vercel SPA rewrite pattern
- [CITED: ARIA Authoring Practices Guide — Combobox Pattern] — `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` conventions

### Tertiary (LOW confidence)
- PostgREST DISTINCT limitation — [ASSUMED] based on known PostgREST behavior; if incorrect, the query approach simplifies (no functional risk)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json; no new installs
- Architecture: HIGH — all decisions locked in CONTEXT.md; UI-SPEC approved
- Autocomplete pattern: MEDIUM — keyboard nav and ARIA pattern are standard combobox conventions, but the specific PostgREST DISTINCT behavior is ASSUMED
- Tap target fixes: HIGH — SelectTrigger h-8 location confirmed at exact line numbers
- Deploy polish: HIGH — index.html and vercel.json requirements are fully specified in CONTEXT.md + UI-SPEC

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (stable stack; 30-day window)
