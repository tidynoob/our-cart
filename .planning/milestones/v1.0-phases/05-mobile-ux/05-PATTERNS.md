# Phase 5: Mobile UX - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 7 (2 new, 4 modified, 1 new binary asset)
**Analogs found:** 6 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/AutocompleteSuggestions.tsx` | component | request-response | `src/components/AttributionBadge.tsx` + `src/components/ItemRow.tsx` | role-match (display) + exact (onMouseDown pattern) |
| `src/components/AddItemBar.tsx` | component | CRUD + request-response | `src/components/AddItemBar.tsx` (self — modification) | exact |
| `src/components/ItemRow.tsx` | component | CRUD | `src/components/ItemRow.tsx` (self — modification) | exact |
| `src/components/AddItemBar.test.tsx` | test | — | `src/pages/ListPage.test.tsx` + `src/components/CreateListForm.test.tsx` | role-match (Supabase mock pattern) |
| `index.html` | config | — | `index.html` (self — modification) | exact |
| `vercel.json` | config | — | `vercel.json` (self — already correct) | exact |
| `public/apple-touch-icon.png` | static asset | — | `public/favicon.svg` | no analog (binary generation) |

---

## Pattern Assignments

### `src/components/AutocompleteSuggestions.tsx` (component, request-response)

**Analogs:**
- `src/components/ItemRow.tsx` — `onMouseDown={(e) => e.preventDefault()` pattern (lines 185, 203, 211)
- `src/components/AttributionBadge.tsx` — minimal display component structure

**Imports pattern** — copy from `src/components/ItemRow.tsx` lines 1-17:
```typescript
import { cn } from '@/lib/utils'
// Plus the specific types needed:
import type { Item } from '@/types/item'
```

**Component interface pattern** — model after `src/components/ItemRow.tsx` lines 19-31 (prop interface shape):
```typescript
interface AutocompleteSuggestionsProps {
  suggestions: Array<{ name: string; category: string | null; quantity: string | null }>
  focusedIndex: number
  onSelect: (item: { name: string; category: string | null; quantity: string | null }) => void
}
```

**Critical: onMouseDown preventDefault pattern** — from `src/components/ItemRow.tsx` lines 185, 203, 211:
```typescript
// Used on every interactive element inside the focus-scope to prevent
// input blur firing before onClick. This exact pattern is in ItemRow for
// SelectTrigger, Button (trash), and Button (cancel).
onMouseDown={(e) => e.preventDefault()}
```
Apply to every `<li>` suggestion item: `onMouseDown={(e) => e.preventDefault()}`.

**ARIA listbox pattern** — from RESEARCH.md Pattern 2:
```typescript
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
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(item)}
    >
      <span className="flex-1 text-base">{item.name}</span>
      {item.category && (
        <span className="text-sm text-muted-foreground">{item.category}</span>
      )}
    </li>
  ))}
</ul>
```

**cn() usage** — from `src/lib/utils.ts` lines 1-6 — import and use `cn()` for conditional class merging:
```typescript
import { cn } from '@/lib/utils'
// Applied on aria-selected items:
className={cn(
  'flex min-h-[44px] cursor-pointer items-center ...',
  index === focusedIndex && 'bg-accent text-accent-foreground'
)}
```

---

### `src/components/AddItemBar.tsx` (component, CRUD — modification)

**Analog:** `src/components/AddItemBar.tsx` (self) + `src/stores/itemsStore.ts` (Supabase query pattern)

**Current imports** (lines 1-13 of `AddItemBar.tsx`) — extend with:
```typescript
import { useState, useRef, useEffect } from 'react'
// Add useRef, useEffect to the existing React import
// supabase client:
import { supabase } from '@/lib/supabase'
// New component:
import { AutocompleteSuggestions } from '@/components/AutocompleteSuggestions'
```

**Supabase one-time fetch pattern** — from `src/stores/itemsStore.ts` lines 51-71 (fetchItems structure):
```typescript
// On mount, fetch distinct names. Pattern mirrors fetchItems() in itemsStore:
useEffect(() => {
  async function loadDistinctItems() {
    const { data } = await supabase
      .from('items')
      .select('name, category, quantity')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
    if (data) {
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
}, [listId])
```

**Local filter pattern** — no existing analog (net-new logic). Per RESEARCH.md Pattern 1:
```typescript
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

**ARIA combobox on existing Input** — extend line 76-83 of `AddItemBar.tsx`:
```typescript
// Current:
<Input
  type="text"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="Add an item..."
  disabled={isInert}
  className="min-h-[48px] flex-1 text-base"
/>
// Add:
  role="combobox"
  aria-expanded={suggestions.length > 0}
  aria-controls="autocomplete-listbox"
  aria-activedescendant={focusedIndex >= 0 ? `suggestion-${focusedIndex}` : undefined}
  aria-autocomplete="list"
  onKeyDown={handleKeyDown}
  onChange={(e) => handleNameChange(e.target.value)}
  onBlur={() => { setSuggestions([]); setFocusedIndex(-1) }}
```

**SelectTrigger height fix** — line 116 of `AddItemBar.tsx`:
```typescript
// Current:
<SelectTrigger className="h-8 flex-1" disabled={isInert}>
// Change to:
<SelectTrigger className="h-11 flex-1" disabled={isInert}>
```

**"More details" toggle tap target fix** — lines 94-100 of `AddItemBar.tsx`:
```typescript
// Current:
<button
  type="button"
  onClick={() => setExpanded(!expanded)}
  className="self-start text-sm text-muted-foreground hover:text-foreground"
>
// Change to:
<button
  type="button"
  onClick={() => setExpanded(!expanded)}
  className="self-start min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground"
>
```

**Keyboard navigation handler** — from RESEARCH.md Code Examples:
```typescript
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

**Suggestion selection — D-04 no-auto-submit** — from RESEARCH.md Code Examples:
```typescript
function handleSuggestionSelect(item: { name: string; category: string | null; quantity: string | null }) {
  setName(item.name)
  if (item.category) setCategory(item.category)
  if (item.quantity) setQuantity(item.quantity)
  setSuggestions([])
  setFocusedIndex(-1)
  // D-04: Do NOT call handleSubmit here — user must confirm
}
```

**Dropdown positioning** — wrap the name input in a `relative` container so `AutocompleteSuggestions` absolute-positions below it:
```typescript
// The existing flex row becomes:
<div className="relative flex items-center gap-2">
  <Input ... />  {/* the combobox input */}
  {suggestions.length > 0 && (
    <AutocompleteSuggestions
      suggestions={suggestions}
      focusedIndex={focusedIndex}
      onSelect={handleSuggestionSelect}
    />
  )}
  <button type="submit" ...>  {/* Add button */}
</div>
```

**State additions** — new `useState` calls following existing state block (lines 36-40):
```typescript
const [distinctItems, setDistinctItems] = useState<Array<{name: string; category: string | null; quantity: string | null}>>([])
const [suggestions, setSuggestions] = useState<Array<{name: string; category: string | null; quantity: string | null}>>([])
const [focusedIndex, setFocusedIndex] = useState(-1)
```

---

### `src/components/ItemRow.tsx` (component, CRUD — modification)

**Analog:** `src/components/ItemRow.tsx` (self) — single line change at line 184.

**SelectTrigger height fix** — line 183-186 of `ItemRow.tsx`:
```typescript
// Current (line 184):
<SelectTrigger
  className="h-8 flex-1"
  onMouseDown={(e) => e.preventDefault()}
>
// Change className to:
<SelectTrigger
  className="h-11 flex-1"
  onMouseDown={(e) => e.preventDefault()}
>
```

Note: The `onMouseDown={(e) => e.preventDefault()}` on the SelectTrigger is already present in the focus-scope pattern — do not remove it.

---

### `src/components/AddItemBar.test.tsx` (test — new file)

**Analog:** `src/pages/ListPage.test.tsx` (Supabase mock with chained query builder) + `src/components/CreateListForm.test.tsx` (simpler component test structure)

**File-level imports and mock structure** — from `src/pages/ListPage.test.tsx` lines 1-90:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddItemBar } from './AddItemBar'

// Mock Supabase — match the chained query builder shape from ListPage.test.tsx.
// The distinct-names query is: supabase.from('items').select(...).eq(...).order(...)
const mockOrder = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table)
      return {
        select: (cols: string) => {
          mockSelect(cols)
          return {
            eq: (col: string, val: string) => {
              mockEq(col, val)
              return {
                order: (...args: unknown[]) => {
                  mockOrder(...args)
                  return Promise.resolve({ data: mockSuggestionData, error: null })
                },
              }
            },
          }
        },
      }
    },
  },
}))
```

**itemsStore mock** — from `src/pages/ListPage.test.tsx` line 6-7 pattern:
```typescript
// Mock the store so AddItemBar doesn't need a real Supabase connection for addItem
vi.mock('@/stores/itemsStore', () => ({
  useItemsStore: (selector: (state: { addItem: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ addItem: mockAddItem }),
}))
```

**beforeEach pattern** — from `src/pages/ListPage.test.tsx` lines 105-107:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockSuggestionData = []
})
```

**userEvent interaction pattern** — from `src/pages/ListPage.test.tsx` lines 224-232:
```typescript
// Use userEvent (not fireEvent) for realistic browser-like typing
const user = userEvent.setup()
await user.type(input, 'mi')
// Then assert dropdown appears
```

**Test cases to cover** (per RESEARCH.md Validation Architecture):
- Suggestions appear after typing prefix (LIST-05)
- Selecting suggestion populates name/category/qty fields
- Selecting suggestion does NOT auto-submit (D-04) — `mockAddItem` must not be called
- Escape key dismisses dropdown
- No suggestions shown when input is empty

---

### `index.html` (config — modification)

**Analog:** `index.html` (self) — current state at lines 1-13.

**Current state** (all 13 lines):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>temp-scaffold</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Required changes** (D-07, D-08):
```html
<!-- Line 7: fix title -->
<title>Our Cart</title>

<!-- Add after viewport meta (line 6): -->
<meta name="theme-color" content="#ffffff" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

No other changes to `index.html`. Do not add a manifest link (D-10 explicitly excludes PWA).

---

### `vercel.json` (config — already correct)

**Current state** (all 5 lines):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This file is already complete and correct (D-09). No changes needed. The planner should note this as a no-op task — verify existence and content only.

---

### `public/apple-touch-icon.png` (static asset — new)

**No analog** in codebase. Closest reference: `public/favicon.svg` (source SVG to adapt).

**Spec:** 180x180 PNG. White (`#ffffff`) background matching `theme-color`. Center the existing lightning bolt SVG from `favicon.svg` on the white canvas.

**Generation approach** (no new npm packages): Use a browser `<canvas>` script, an online SVG-to-PNG tool, or Node.js with a built-in approach. Place output at `public/apple-touch-icon.png`.

---

## Shared Patterns

### onMouseDown preventDefault (Focus-Scope Guard)
**Source:** `src/components/ItemRow.tsx` lines 185, 203, 211
**Apply to:** Every interactive element inside `AutocompleteSuggestions` (each `<li>`) and anywhere a click target shares a focus scope with the name input.
```typescript
onMouseDown={(e) => e.preventDefault()}
```
This is the single most critical pattern for this phase. Without it, clicking a suggestion fires `blur` on the input before `onClick`, closing the dropdown and losing the selection.

### cn() Utility
**Source:** `src/lib/utils.ts` lines 1-6
**Apply to:** `AutocompleteSuggestions.tsx` for conditional `aria-selected` highlight styling.
```typescript
import { cn } from '@/lib/utils'
// Usage:
className={cn('base classes', condition && 'conditional classes')}
```

### Supabase Chained Query Builder (read-only)
**Source:** `src/stores/itemsStore.ts` lines 51-71 (fetchItems), `src/pages/ListPage.test.tsx` lines 44-90 (mock shape)
**Apply to:** `AddItemBar.tsx` (the `loadDistinctItems` useEffect) and `AddItemBar.test.tsx` (the Supabase mock).

The chained shape for the distinct-names query is:
```
supabase.from('items').select('name, category, quantity').eq('list_id', listId).order('created_at', { ascending: false })
```
The test mock must match this exact chain (4 levels: `from → select → eq → order`).

### Tailwind h-11 SelectTrigger Override
**Source:** `src/components/ui/select.tsx` line 42 (`data-[size=default]:h-8` default)
**Apply to:** `AddItemBar.tsx` line 116 and `ItemRow.tsx` line 184.
```typescript
// Both locations: className="h-8 flex-1" → className="h-11 flex-1"
```
The `cn()` utility (via `tailwind-merge`) ensures `h-11` wins over `data-[size=default]:h-8`. No specificity workaround needed.

### Text Input iOS Zoom Prevention
**Source:** `src/components/AddItemBar.tsx` lines 82, 107, 164, 169 — `text-base` class on all `<Input>` elements
**Apply to:** Not new in this phase, but confirm the name `<Input>` in `AddItemBar.tsx` retains `text-base` after modification (line 82 currently has it).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `public/apple-touch-icon.png` | static asset | — | Binary PNG generation; no existing PNG assets in the project. Source: adapt from `public/favicon.svg`. |

---

## Metadata

**Analog search scope:** `src/components/`, `src/stores/`, `src/lib/`, `src/pages/`, project root config files
**Files read:** `AddItemBar.tsx`, `ItemRow.tsx`, `itemsStore.ts`, `supabase.ts`, `select.tsx`, `utils.ts`, `ListPage.test.tsx`, `CreateListForm.test.tsx`, `ItemRow.test.tsx`, `index.html`, `vercel.json`
**Pattern extraction date:** 2026-05-26
