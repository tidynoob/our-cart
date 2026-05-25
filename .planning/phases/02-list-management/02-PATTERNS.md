# Phase 2: List Management - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/itemsStore.ts` | store | CRUD | `src/stores/uiStore.ts` | role-match |
| `src/components/AddItemBar.tsx` | component | request-response | `src/components/CreateListForm.tsx` | exact |
| `src/components/CategorySection.tsx` | component | transform | `src/components/ShareBanner.tsx` | role-match |
| `src/components/ItemRow.tsx` | component | CRUD | `src/components/CreateListForm.tsx` | role-match |
| `src/components/DeleteConfirmation.tsx` | component | event-driven | `src/components/ShareBanner.tsx` | role-match |
| `src/components/NamePromptDialog.tsx` | component | event-driven | `src/components/CreateListForm.tsx` | role-match |
| `src/components/AttributionBadge.tsx` | component | transform | `src/components/ui/button.tsx` | partial |
| `src/lib/categories.ts` | utility | transform | `src/lib/extractShareCode.ts` | exact |
| `src/lib/attribution.ts` | utility | transform | `src/lib/extractShareCode.ts` | exact |
| `src/types/item.ts` | model | N/A | (inline interface in `src/pages/ListPage.tsx`) | role-match |
| `src/pages/ListPage.tsx` (modify) | page | CRUD | self | exact |
| `src/lib/categories.test.ts` | test | N/A | `src/lib/generateCode.test.ts` | exact |
| `src/lib/attribution.test.ts` | test | N/A | `src/lib/generateCode.test.ts` | exact |

## Pattern Assignments

### `src/stores/itemsStore.ts` (store, CRUD)

**Analog:** `src/stores/uiStore.ts`

**Imports pattern** (lines 1):
```typescript
import { create } from 'zustand'
```

**Core store pattern** (lines 1-14):
```typescript
import { create } from 'zustand'

interface UIState {
  dismissedBanners: Set<string>
  dismissBanner: (listCode: string) => void
}

export const useUIStore = create<UIState>()((set) => ({
  dismissedBanners: new Set(),
  dismissBanner: (listCode) =>
    set((state) => ({
      dismissedBanners: new Set([...state.dismissedBanners, listCode]),
    })),
}))
```

**Key conventions to replicate:**
- Named export with `use` prefix: `export const useItemsStore = create<ItemsState>()((set, get) => ({...}))`
- Double invocation pattern: `create<State>()((set) => ({...}))`
- Interface defined above store creation
- `set((state) => ({...}))` for immutable updates
- Add `get` parameter for actions that need to read current state (updateItem, deleteItem)

**Additional import needed for itemsStore:**
```typescript
import { supabase } from '@/lib/supabase'
```
Source: `src/lib/supabase.ts` line 10 — the singleton export pattern.

---

### `src/components/AddItemBar.tsx` (component, request-response)

**Analog:** `src/components/CreateListForm.tsx`

**Imports pattern** (lines 1-6):
```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
```

**Form submission pattern** (lines 14-37):
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()

  if (!name.trim()) {
    setError('Please enter a list name.')
    return
  }

  setLoading(true)
  setError(null)

  const shareCode = nanoid(8)

  const { error: supabaseError } = await supabase
    .from('lists')
    .insert({ name: name.trim(), share_code: shareCode })

  if (supabaseError) {
    setError('Could not create list. Please try again.')
    setLoading(false)
    return
  }

  navigate(`/list/${shareCode}`)
}
```

**Form JSX pattern** (lines 43-65):
```typescript
<form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm">
  <label htmlFor="list-name" className="text-sm font-medium">
    List name
  </label>
  <Input
    id="list-name"
    type="text"
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="e.g. Weekly groceries"
    disabled={loading}
    aria-describedby={error ? 'create-error' : undefined}
  />
  {error && (
    <p id="create-error" className="text-sm text-red-600" role="alert">
      {error}
    </p>
  )}
  <Button type="submit" disabled={loading}>
    {loading ? 'Creating...' : 'Create list'}
  </Button>
</form>
```

**Key conventions to replicate:**
- `e.preventDefault()` at top of submit handler
- Trim input before validation/submission
- `aria-describedby` for error association
- `role="alert"` on error messages
- Generic user-facing error messages (never expose raw DB errors)
- `disabled={loading}` on inputs during async operations

---

### `src/components/CategorySection.tsx` (component, transform)

**Analog:** `src/components/ShareBanner.tsx`

**Props interface pattern** (lines 4-8):
```typescript
interface ShareBannerProps {
  listCode: string
  listName: string
  onDismiss: () => void
}
```

**Component signature pattern** (line 10):
```typescript
export function ShareBanner({ listCode, listName, onDismiss }: ShareBannerProps) {
```

**Key conventions to replicate:**
- Named export (not default) as primary export
- Props interface defined above component
- Destructured props in function signature
- Tailwind utility classes for layout (`flex flex-col gap-2`, `text-sm font-medium`)
- Conditional rendering with `&&` operator

---

### `src/components/ItemRow.tsx` (component, CRUD)

**Analog:** `src/components/CreateListForm.tsx` + `src/components/ShareBanner.tsx`

**From CreateListForm — inline form with state:**
```typescript
const [name, setName] = useState('')
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**From ShareBanner — conditional button rendering:**
```typescript
<Button variant="outline" size="sm" onClick={handleCopy}>
  {copied ? 'Copied!' : 'Copy link'}
</Button>
```

**Key conventions to replicate:**
- Use local `useState` for form field values in edit mode (initialized from item prop)
- Use store actions for save/delete (not local Supabase calls)
- Button variants: `variant="outline"` for secondary actions, `variant="ghost"` for tertiary
- Button sizes: `size="sm"` for inline row actions

---

### `src/components/DeleteConfirmation.tsx` (component, event-driven)

**Analog:** `src/components/ShareBanner.tsx`

**Button group pattern** (lines 46-65):
```typescript
<div className="flex items-center gap-2">
  <Button variant="outline" size="sm" onClick={handleCopy}>
    {copied ? 'Copied!' : 'Copy link'}
  </Button>

  <Button
    variant="ghost"
    size="sm"
    onClick={onDismiss}
    aria-label="Dismiss share banner"
  >
    Dismiss
  </Button>
</div>
```

**Key conventions to replicate:**
- `aria-label` on icon-only or terse buttons
- `variant="destructive"` available on Button (from button.tsx line 19) for delete confirm
- Flex row with gap for button groups

---

### `src/components/NamePromptDialog.tsx` (component, event-driven)

**Analog:** `src/components/CreateListForm.tsx`

**Form + validation pattern** (same as AddItemBar above — lines 14-37 of CreateListForm)

**Key conventions to replicate:**
- Same form submission pattern as CreateListForm
- `Input` component for name entry
- `Button` for save action
- Validation: trim + empty check before submission
- Dialog component from shadcn will wrap this form (install via `npx shadcn@latest add dialog`)

---

### `src/components/AttributionBadge.tsx` (component, transform)

**Analog:** `src/components/ui/button.tsx`

**Component with cn() utility pattern** (lines 43-56):
```typescript
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

**cn() import** (line 4 of button.tsx):
```typescript
import { cn } from "@/lib/utils"
```

**Key conventions to replicate:**
- Use `cn()` for conditional class composition
- Accept optional `className` prop for override capability
- Small presentational component with minimal logic

---

### `src/lib/categories.ts` (utility, transform)

**Analog:** `src/lib/extractShareCode.ts`

**Utility module pattern** (lines 1-17):
```typescript
/**
 * Extracts the share code from a user-supplied input string.
 * Handles three input formats:
 *   - Full URL:    "https://our-cart.vercel.app/list/ABC12345" → "ABC12345"
 *   - Path-style:  "our-cart.vercel.app/list/ABC12345"        → "ABC12345"
 *   - Raw code:    "ABC12345"                                  → "ABC12345"
 *
 * Case is preserved (Pitfall 6: never normalize the share code).
 */
export function extractShareCode(input: string): string {
  const trimmed = input.trim()
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean)
    return segments[segments.length - 1]
  }
  return trimmed
}
```

**Key conventions to replicate:**
- JSDoc comment block explaining purpose and edge cases
- Named export for each function
- Pure function with no side effects
- Input validation/normalization at boundary

---

### `src/lib/attribution.ts` (utility, transform)

**Analog:** `src/lib/extractShareCode.ts` (same pattern as categories.ts)

**Key conventions to replicate:**
- Pure functions with JSDoc
- Named exports
- No imports needed (pure logic)
- Export both `getAttributionColor` and `getInitials` from single module

---

### `src/types/item.ts` (model, N/A)

**Analog:** Interface in `src/pages/ListPage.tsx` (lines 7-12)

**Interface pattern:**
```typescript
interface List {
  id: string
  name: string
  share_code: string
  created_at: string
}
```

**Key conventions to replicate:**
- TypeScript interface (not type alias)
- Field names match Supabase column names (snake_case)
- All fields typed explicitly
- Export the interface for use across stores and components

---

### `src/pages/ListPage.tsx` (page, CRUD — modification)

**Self-analog** — existing file to be modified.

**Current integration point** (lines 77-84):
```typescript
<div className="w-full max-w-md p-4">
  <h1 className="text-2xl font-semibold">{list.name}</h1>
  <div className="mt-4">
    {/* Items area — Phase 2 will populate this */}
  </div>
</div>
```

**Supabase fetch + state pattern** (lines 23-44):
```typescript
async function fetchList() {
  const { data, error: supabaseError } = await supabase
    .from('lists')
    .select('id, name, share_code, created_at')
    .eq('share_code', code)
    .single()

  if (supabaseError || !data) {
    setError('List not found')
  } else {
    setList(data)
  }
  setLoading(false)
}
```

**Loading/error state rendering pattern** (lines 47-64):
```typescript
if (loading) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <p>Loading...</p>
    </div>
  )
}

if (error || !list) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <p>List not found</p>
      <Link to="/" className="text-blue-600 underline mt-2">
        Back to home
      </Link>
    </div>
  )
}
```

**Key conventions for modification:**
- Import new store: `import { useItemsStore } from '@/stores/itemsStore'`
- Call `fetchItems(list.id)` in existing useEffect after list is loaded
- Replace placeholder div with `<AddItemBar>` + `<CategorySection>` components
- Add `<NamePromptDialog>` conditionally when no stored name

---

### `src/lib/categories.test.ts` (test, utility)

**Analog:** `src/lib/generateCode.test.ts`

**Pure utility test pattern** (lines 1-21):
```typescript
import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'

describe('nanoid(8) share code generation', () => {
  it('returns exactly 8 characters', () => {
    const code = nanoid(8)
    expect(code).toHaveLength(8)
  })

  it('returns only characters from the URL-safe alphabet (A-Za-z0-9_-)', () => {
    const code = nanoid(8)
    expect(code).toMatch(/^[A-Za-z0-9_-]{8}$/)
  })

  it('produces different values on repeated calls (probabilistic — 5 attempts)', () => {
    const codes = Array.from({ length: 5 }, () => nanoid(8))
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBeGreaterThan(1)
  })
})
```

**Key conventions to replicate:**
- Import `{ describe, it, expect }` from `'vitest'`
- `describe` block named after the function/module
- Each `it` tests a single behavior
- Descriptive test names explaining expected outcome
- No mocking needed for pure utility functions

---

### `src/lib/attribution.test.ts` (test, utility)

**Analog:** `src/lib/generateCode.test.ts` (same as categories.test.ts)

Same pattern — pure function tests with no mocking.

---

## Shared Patterns

### Supabase Client Import
**Source:** `src/lib/supabase.ts` (line 10)
**Apply to:** `src/stores/itemsStore.ts`
```typescript
import { supabase } from '@/lib/supabase'
```

### Supabase Query Chain
**Source:** `src/pages/ListPage.tsx` (lines 30-34)
**Apply to:** All CRUD operations in itemsStore
```typescript
const { data, error: supabaseError } = await supabase
  .from('items')
  .select('*')
  .eq('list_id', listId)
  .order('created_at', { ascending: true })
```

### Supabase Insert with Return
**Source:** `src/components/CreateListForm.tsx` (lines 28-30)
**Apply to:** `addItem` action in itemsStore
```typescript
const { error: supabaseError } = await supabase
  .from('lists')
  .insert({ name: name.trim(), share_code: shareCode })
```
Note: For addItem, chain `.select().single()` to get the generated ID back.

### Error Handling (User-Facing)
**Source:** `src/components/CreateListForm.tsx` (lines 32-36)
**Apply to:** All components with error states
```typescript
if (supabaseError) {
  // Never expose the raw Supabase error message (T-03-02, V7)
  setError('Could not create list. Please try again.')
  setLoading(false)
  return
}
```

### shadcn Component Import Path
**Source:** `src/components/CreateListForm.tsx` (lines 5-6)
**Apply to:** All components using UI primitives
```typescript
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
```

### cn() Utility for Class Composition
**Source:** `src/lib/utils.ts` (lines 1-6)
**Apply to:** Any component needing conditional classes
```typescript
import { cn } from "@/lib/utils"
// Usage: className={cn("base-classes", conditional && "extra-classes")}
```

### Zustand Store Selector Pattern
**Source:** `src/pages/ListPage.tsx` (lines 4, 17-18)
**Apply to:** All components consuming itemsStore
```typescript
import { useUIStore } from '@/stores/uiStore'
// ...
const dismissedBanners = useUIStore((state) => state.dismissedBanners)
const dismissBanner = useUIStore((state) => state.dismissBanner)
```

### Component Test Pattern (with Supabase mock)
**Source:** `src/components/CreateListForm.test.tsx` (lines 1-27)
**Apply to:** AddItemBar.test.tsx, ItemRow.test.tsx, NamePromptDialog.test.tsx
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table)
      return {
        insert: mockInsert,
      }
    },
  },
}))

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  // tests...
})
```

### Accessibility Patterns
**Source:** `src/components/CreateListForm.tsx` (lines 44-64)
**Apply to:** All form components
- `<label htmlFor="id">` linked to input `id`
- `aria-describedby` pointing to error element
- `role="alert"` on dynamic error messages
- `aria-label` on icon-only buttons (from ShareBanner line 63)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have analogs in the existing codebase |

## Metadata

**Analog search scope:** `src/` directory (pages, components, stores, lib, components/ui)
**Files scanned:** 12 existing files examined
**Pattern extraction date:** 2026-05-25
