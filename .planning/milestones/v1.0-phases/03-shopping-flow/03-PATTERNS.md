# Phase 3: Shopping Flow — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 5 (1 new, 4 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ui/checkbox.tsx` | ui-primitive wrapper | request-response | `src/components/ui/dialog.tsx` | exact (same Base UI wrap convention) |
| `src/stores/itemsStore.ts` | store (extend) | CRUD | `src/stores/itemsStore.ts` itself — `updateItem` (toggle) + `deleteItem` (clear) | exact |
| `src/components/ItemRow.tsx` | component (modify) | request-response | `src/components/ItemRow.tsx` display mode (lines 214-243) | exact (in-place edit) |
| `src/components/CategorySection.tsx` | component (modify) | request-response | `src/components/CategorySection.tsx` itself — existing prop-drill pattern | exact |
| `src/pages/ListPage.tsx` | page (modify) | request-response | `src/pages/ListPage.tsx` itself — `editingItemId`/`deletingItemId` + Dialog pattern from `NamePromptDialog.tsx` | exact |

---

## Pattern Assignments

### `src/components/ui/checkbox.tsx` (new — ui-primitive wrapper, request-response)

**Analog:** `src/components/ui/dialog.tsx`

**Why this analog:** `dialog.tsx` is the canonical pattern for wrapping a Base UI primitive into a named export with Tailwind classes and `cn()`. The checkbox wrapper mirrors it exactly: import the primitive subpath, thin-wrap with no additional state, export named functions.

**Imports pattern** (`dialog.tsx` lines 1-8):
```typescript
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
```

**Checkbox imports to copy (mirror this exactly with checkbox subpath):**
```typescript
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
```

**Wrapper function pattern** (`dialog.tsx` lines 10-12 — thin Root wrapper):
```typescript
function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}
```

**Checkbox wrapper to write (same shape, two-part: Root + Indicator):**
```typescript
function Checkbox({
  className,
  checked,
  onCheckedChange,
  ...props
}: CheckboxPrimitive.Root.Props & { className?: string }) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'flex h-[44px] w-[44px] items-center justify-center',
        className
      )}
      {...props}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-input bg-background data-[checked]:bg-primary data-[checked]:border-primary">
        <CheckboxPrimitive.Indicator>
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
```

**Critical data attribute note:** Base UI uses `data-[checked]` (presence attribute), NOT Radix's `data-[state="checked"]`. The existing `dialog.tsx` uses `data-open` / `data-closed` — same Base UI presence-attribute convention (lines 34, 56). Apply the same pattern: `data-[checked]:bg-primary`, `data-[checked]:border-primary`.

**Close-button render prop pattern** (`dialog.tsx` lines 63-77 — shows how Base UI render prop works):
```typescript
<DialogPrimitive.Close
  data-slot="dialog-close"
  render={
    <Button
      variant="ghost"
      className="absolute top-2 right-2"
      size="icon-sm"
    />
  }
>
  <XIcon />
  <span className="sr-only">Close</span>
</DialogPrimitive.Close>
```
The `Checkbox.Indicator` follows the same convention: it is a child of `Checkbox.Root` (not a render prop), renders only when `checked=true` (unless `keepMounted` is set).

**Export pattern** (`dialog.tsx` lines 149-160 — named exports, no default):
```typescript
export {
  Dialog,
  DialogClose,
  DialogContent,
  ...
}
```
Checkbox is simpler (single export): `export { Checkbox }`.

---

### `src/stores/itemsStore.ts` — `toggleChecked` action (modify, CRUD)

**Analog:** `updateItem` in `src/stores/itemsStore.ts` (lines 88-110)

**Why this analog:** `toggleChecked` is a boolean field update on a single item — identical to `updateItem` but with a predetermined field (`checked`) and a computed value (`!prev.checked`). Copy the snapshot → optimistic-update → Supabase call → rollback pattern verbatim.

**Interface addition (copy `updateItem` signature shape, lines 19-22):**
```typescript
interface ItemsState {
  // ... existing fields ...
  toggleChecked: (id: string) => Promise<void>
  clearChecked: (listId: string) => Promise<void>
}
```

**`updateItem` pattern to copy** (`itemsStore.ts` lines 88-110):
```typescript
updateItem: async (id, changes) => {
  const prev = get().items.find((i) => i.id === id)
  if (!prev) return

  // Per-item optimistic update: merge changes into the single item
  set((state) => ({
    items: state.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
  }))

  const { error } = await supabase
    .from('items')
    .update(changes)
    .eq('id', id)

  if (error) {
    // Per-item rollback: restore only the single item to its previous state
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? prev : i)),
      error: 'Failed to update item',
    }))
  }
},
```

**`toggleChecked` implementation (adapt `updateItem` exactly):**
```typescript
toggleChecked: async (id) => {
  const prev = get().items.find((i) => i.id === id)
  if (!prev) return

  const nextChecked = !prev.checked

  set((state) => ({
    items: state.items.map((i) =>
      i.id === id ? { ...i, checked: nextChecked } : i
    ),
  }))

  const { error } = await supabase
    .from('items')
    .update({ checked: nextChecked })
    .eq('id', id)

  if (error) {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? prev : i)),
      error: 'Failed to update item',
    }))
  }
},
```

---

### `src/stores/itemsStore.ts` — `clearChecked` action (modify, CRUD)

**Analog:** `deleteItem` in `src/stores/itemsStore.ts` (lines 112-131)

**Why this analog:** `clearChecked` is a bulk delete — same pattern as `deleteItem` but snapshot-then-remove multiple items and use a chained `.eq().eq()` Supabase filter. Error string matches the error surface pattern in lines 126-129.

**`deleteItem` pattern to copy** (`itemsStore.ts` lines 112-131):
```typescript
deleteItem: async (id) => {
  const prev = get().items.find((i) => i.id === id)
  if (!prev) return

  // Per-item optimistic delete: remove only this item
  set((state) => ({
    items: state.items.filter((i) => i.id !== id),
  }))

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) {
    // Per-item rollback: re-insert only the deleted item
    set((state) => ({ items: [...state.items, prev], error: 'Failed to delete item' }))
  }
},
```

**`clearChecked` implementation (adapt `deleteItem` for bulk):**
```typescript
clearChecked: async (listId) => {
  // Snapshot BEFORE optimistic removal (Pitfall 4 — read before set())
  const checkedItems = get().items.filter((i) => i.checked)
  if (checkedItems.length === 0) return

  // Optimistic bulk remove
  set((state) => ({
    items: state.items.filter((i) => !i.checked),
  }))

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('list_id', listId)
    .eq('checked', true)

  if (error) {
    // Rollback: restore all removed items + error in same set() call
    set((state) => ({
      items: [...state.items, ...checkedItems],
      error: 'Failed to clear items',
    }))
  }
},
```

**Key rule (from `deleteItem`):** rollback `items` and `error` in the SAME `set()` call (line 129 — single `set()` with both keys). Never split into two `set()` calls.

**Supabase chained `.eq()` pattern** (existing usage in `fetchItems`, lines 33-36):
```typescript
const { data, error } = await supabase
  .from('items')
  .select('*')
  .eq('list_id', listId)
  .order('created_at', { ascending: true })
```
Multiple `.eq()` calls chain as AND conditions. `clearChecked` extends this: `.delete().eq('list_id', listId).eq('checked', true)`.

---

### `src/components/ItemRow.tsx` — display mode (modify, request-response)

**Analog:** `src/components/ItemRow.tsx` display mode, lines 214-243

**Why this analog:** This is an in-place modification of the existing display branch. The analog IS the existing code — insert checkbox before the attribution badge, add conditional classes to the row div and name span, add an `onToggle` prop.

**Existing display mode layout to modify** (lines 214-243):
```typescript
// Display mode
return (
  <div
    className="flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-border px-3 py-2 hover:bg-secondary active:bg-secondary"
    onClick={onTap}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onTap()
      }
    }}
  >
    {item.added_by ? (
      <AttributionBadge name={item.added_by} />
    ) : (
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
        aria-label="Unknown person added this"
      >
        ?
      </div>
    )}
    <span className="flex-1 text-base">{item.name}</span>
    {item.quantity && (
      <span className="text-sm text-muted-foreground">{item.quantity}</span>
    )}
  </div>
)
```

**Changes to make:**

1. Add `onToggle: (id: string) => void` to `ItemRowProps` interface (lines 17-27).

2. Row div `className` — add `opacity-50` when checked (via `cn()`):
```typescript
className={cn(
  'flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-border px-3 py-2 hover:bg-secondary active:bg-secondary',
  item.checked && 'opacity-50'
)}
```

3. Insert checkbox wrapper as the first child of the row div (before the attribution badge block). The wrapper div carries `e.stopPropagation()` to prevent row's `onClick={onTap}` from firing:
```typescript
<div
  onClick={(e) => e.stopPropagation()}
  onKeyDown={(e) => e.stopPropagation()}
>
  <Checkbox
    checked={item.checked}
    onCheckedChange={() => onToggle(item.id)}
    aria-label={`Mark ${item.name} as ${item.checked ? 'not bought' : 'bought'}`}
  />
</div>
```

4. Name span — add `line-through` when checked:
```typescript
<span className={cn('flex-1 text-base', item.checked && 'line-through')}>
  {item.name}
</span>
```

**`cn()` import:** already used throughout ItemRow edit mode — import from `@/lib/utils`.

**Tap target convention (existing):** Row itself uses `min-h-[48px]`. Checkbox's 44px tap target is enforced by the `h-[44px] w-[44px]` classes on `Checkbox.Root` inside the wrapper (see checkbox.tsx pattern above). Both use the `min-h-[XX]` / `h-[XX]` inline size convention already in this file.

---

### `src/components/CategorySection.tsx` (modify, request-response)

**Analog:** `src/components/CategorySection.tsx` lines 1-64 — existing `onDelete`/`onConfirmDelete`/`onCancelDelete` prop-drill pattern.

**Why this analog:** `onToggle` is a new handler that follows the exact same prop-drilling shape as the existing delete/edit handlers. Copy the pattern: add to `CategorySectionProps`, destructure, pass through to each `ItemRow`.

**Existing handler prop-drill pattern** (lines 4-15, 36, 53-59):
```typescript
interface CategorySectionProps {
  category: string
  items: Item[]
  editingItemId: string | null
  deletingItemId: string | null
  onItemTap: (id: string) => void
  onCancelEdit: () => void
  onSave: (id: string, changes: Partial<Pick<Item, 'name' | 'quantity' | 'category'>>) => void
  onDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}
```

**ItemRow prop pass-through pattern** (lines 47-59):
```typescript
<ItemRow
  key={item.id}
  item={item}
  isEditing={item.id === editingItemId}
  isDeleting={item.id === deletingItemId}
  onTap={() => onItemTap(item.id)}
  onCancelEdit={onCancelEdit}
  onSave={onSave}
  onDelete={() => onDelete(item.id)}
  onCancelDelete={onCancelDelete}
  onConfirmDelete={() => onConfirmDelete(item.id)}
/>
```

**Changes to make:**

1. Add to `CategorySectionProps`:
```typescript
onToggle: (id: string) => void
```

2. Destructure in function params:
```typescript
export function CategorySection({
  ...existing params...,
  onToggle,
}: CategorySectionProps) {
```

3. Pass to `ItemRow` (same inline lambda pattern as `onDelete`/`onConfirmDelete`):
```typescript
onToggle={() => onToggle(item.id)}
// or equivalently (same as onSave which is passed directly):
onToggle={onToggle}
```

---

### `src/pages/ListPage.tsx` (modify, request-response)

**Analogs:**
- Ephemeral state pattern: `src/pages/ListPage.tsx` lines 32-33 (`editingItemId`/`deletingItemId`)
- Dialog wire-up: `src/components/NamePromptDialog.tsx` lines 38-59 (controlled Dialog pattern)
- Store action subscription: `ListPage.tsx` lines 38-40 (`updateItem`/`deleteItem` from store)
- Handler pattern: `ListPage.tsx` lines 79-120 (`handleDelete`/`handleConfirmDelete`)
- Error + Retry pattern: `ListPage.tsx` lines 185-196

**Ephemeral state pattern to copy** (lines 32-33):
```typescript
// Edit/delete state managed locally in ListPage (not Zustand)
// Per review: these are ephemeral UI state for this page only
const [editingItemId, setEditingItemId] = useState<string | null>(null)
const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
```

**New state to add (same pattern, same comment convention):**
```typescript
// Clear dialog state — ephemeral UI, not Zustand
const [clearDialogOpen, setClearDialogOpen] = useState(false)
```

**Store action subscription pattern** (lines 38-40):
```typescript
const updateItem = useItemsStore((state) => state.updateItem)
const deleteItem = useItemsStore((state) => state.deleteItem)
```

**New subscriptions to add (same pattern):**
```typescript
const toggleChecked = useItemsStore((state) => state.toggleChecked)
const clearChecked = useItemsStore((state) => state.clearChecked)
```

**Derived value (no new state, inline in render):**
```typescript
const checkedCount = items.filter((i) => i.checked).length
```

**Handler pattern to copy** (lines 109-115 — `handleConfirmDelete` calls store action with `.catch()`):
```typescript
function handleConfirmDelete(id: string) {
  // Store handles rollback + error state internally; .catch() guards
  // against unhandled rejections from network-level throws (WR-03).
  deleteItem(id).catch(() => {})
  setEditingItemId(null)
  setDeletingItemId(null)
}
```

**New handlers to add (same shape):**
```typescript
function handleToggle(id: string) {
  toggleChecked(id).catch(() => {})
}

function handleClearConfirm() {
  setClearDialogOpen(false)
  clearChecked(list.id).catch(() => {})
}
```

**CategorySection render with new prop** (existing lines 207-221 — add `onToggle`):
```typescript
{!itemsLoading && grouped.map((group) => (
  <CategorySection
    key={group.category}
    category={group.category}
    items={group.items}
    editingItemId={editingItemId}
    deletingItemId={deletingItemId}
    onItemTap={handleItemTap}
    onCancelEdit={handleCancelEdit}
    onSave={handleSave}
    onDelete={handleDelete}
    onConfirmDelete={handleConfirmDelete}
    onCancelDelete={handleCancelDelete}
    onToggle={handleToggle}   {/* NEW */}
  />
))}
```

**"Clear completed" button placement — after the `grouped.map()` block, before `</div>` on line 223:**
```typescript
{/* Clear completed button — only rendered when checked items exist (D-06) */}
{!itemsLoading && checkedCount > 0 && (
  <div className="px-4">
    <Button
      variant="outline"
      className="w-full mt-4"
      onClick={() => setClearDialogOpen(true)}
    >
      Clear completed ({checkedCount})
    </Button>
  </div>
)}
```

**Dialog wire-up — NamePromptDialog controlled pattern** (`NamePromptDialog.tsx` lines 38-59):
```typescript
<Dialog open={open} onOpenChange={() => {}}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>What's your name?</DialogTitle>
      ...
    </DialogHeader>
    ...
  </DialogContent>
</Dialog>
```

**Clear confirmation Dialog to add (copy NamePromptDialog shape, adapt content):**
```typescript
<Dialog open={clearDialogOpen} onOpenChange={(open) => setClearDialogOpen(open)} disablePointerDismissal>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>
        Remove {checkedCount} checked item{checkedCount !== 1 ? 's' : ''}?
      </DialogTitle>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
        Keep Items
      </Button>
      <Button variant="destructive" onClick={handleClearConfirm}>
        Clear Items
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Dialog import additions** (`dialog.tsx` exports, lines 149-160 — add `DialogFooter` to the existing Dialog import in ListPage):
```typescript
import {
  Dialog,
  DialogContent,
  DialogFooter,   // add this
  DialogHeader,
  DialogTitle,    // add this
} from '@/components/ui/dialog'
```

**Error + Retry pattern** (`ListPage.tsx` lines 185-196 — unchanged, covers toggle and clear errors via `itemsError`):
```typescript
{itemsError && (
  <div className="text-sm">
    <p className="text-red-600" role="alert">{itemsError}</p>
    <button
      type="button"
      onClick={() => fetchItems(list.id)}
      className="text-blue-600 underline mt-1"
    >
      Retry
    </button>
  </div>
)}
```
No changes needed — `toggleChecked` sets `error: 'Failed to update item'` and `clearChecked` sets `error: 'Failed to clear items'`, both of which surface through `itemsError`. The Retry re-fetches canonical state.

---

## Shared Patterns

### Optimistic Mutation + Rollback (applies to `toggleChecked` and `clearChecked`)

**Source:** `src/stores/itemsStore.ts` — all four existing actions follow this invariant.

**The invariant (3 steps, always in this order):**
1. Snapshot `prev` (or `checkedItems`) from `get().items` BEFORE calling `set()`
2. Call `set()` with the optimistic state change
3. Await Supabase; on error, call `set()` once with BOTH `items` (rollback) and `error` in the same object

**Error field convention** (`itemsStore.ts` lines 105-108 and 127-129):
```typescript
// Always both keys in the same set() call:
set((state) => ({
  items: state.items.map((i) => (i.id === id ? prev : i)),
  error: 'Failed to update item',
}))
```

### `cn()` Conditional Class Merging (applies to `checkbox.tsx` and `ItemRow.tsx`)

**Source:** `src/components/ui/button.tsx` line 53, `src/components/ui/dialog.tsx` lines 34, 56 — used throughout.

**Pattern:**
```typescript
import { cn } from "@/lib/utils"

className={cn('base-classes', condition && 'conditional-class')}
```

### `.catch(() => {})` Store Action Guard (applies to all new handlers in `ListPage.tsx`)

**Source:** `src/pages/ListPage.tsx` lines 98-99, 112-113 — applied to every store action call from a handler.

```typescript
// Store handles rollback + error state internally; .catch() guards
// against unhandled rejections from network-level throws (WR-03).
deleteItem(id).catch(() => {})
```

### `e.stopPropagation()` Gesture Isolation (specific to checkbox wrapper in `ItemRow.tsx`)

**Source:** No existing example in codebase (this is the first nested interactive element inside a clickable row). The pattern is established in this phase.

**Rule:** Both `onClick` and `onKeyDown` on the wrapping div must stop propagation to prevent the row-body `onClick={onTap}` from triggering edit mode.

```typescript
<div
  onClick={(e) => e.stopPropagation()}
  onKeyDown={(e) => e.stopPropagation()}
>
  <Checkbox ... />
</div>
```

### Controlled Dialog with `disablePointerDismissal` (clear confirmation)

**Source:** `src/components/NamePromptDialog.tsx` lines 38-41 (controlled pattern), `src/components/ui/dialog.tsx` lines 10-11 (Root props passthrough).

`NamePromptDialog` uses `onOpenChange={() => {}}` (prevents all dismissal). The clear dialog uses `onOpenChange={(open) => setClearDialogOpen(open)}` (allows Escape) plus `disablePointerDismissal` (blocks backdrop tap on mobile). The `disablePointerDismissal` prop passes through `Dialog → DialogPrimitive.Root` via `{...props}`.

---

## Test Patterns

### Store test pattern — no existing `itemsStore.test.ts`

**Closest analog:** `src/pages/ListPage.test.tsx` (Supabase mock scaffold)

**Supabase mock shape from `ListPage.test.tsx` lines 6-35:**
```typescript
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockOrder = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table)
      return {
        select: (cols: string) => { ... },
      }
    },
  },
}))
```

**New `itemsStore.test.ts` must extend this mock to cover `.update()` and `.delete()` chains.** The mock needs to support: `.from().update().eq()` (toggleChecked) and `.from().delete().eq().eq()` (clearChecked).

**Component test pattern** (`src/pages/ListPage.test.tsx` lines 48-68):
```typescript
describe('ListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the list name when Supabase returns data (SHOP-01)', async () => {
    ...
    await waitFor(() => {
      expect(screen.getByRole(...)).toBeTruthy()
    })
  })
})
```
New `ItemRow.test.tsx` and extended `ListPage.test.tsx` follow the same `describe` + `beforeEach(vi.clearAllMocks)` + `it` + `await waitFor` structure.

---

## No Analog Found

None — all five files have exact analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/components/ui/`, `src/pages/`, `src/types/`
**Files read:** 10 (`itemsStore.ts`, `ItemRow.tsx`, `CategorySection.tsx`, `dialog.tsx`, `button.tsx`, `ListPage.tsx`, `NamePromptDialog.tsx`, `ListPage.test.tsx`, `item.ts`, `03-CONTEXT.md` / `03-RESEARCH.md` / `03-UI-SPEC.md`)
**Pattern extraction date:** 2026-05-25
