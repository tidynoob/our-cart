# Phase 2: List Management - Research

**Researched:** 2026-05-25
**Domain:** CRUD operations, Supabase Postgres + RLS, React state management, UI components
**Confidence:** HIGH

## Summary

Phase 2 adds the core grocery list functionality: adding items with name/quantity/category, editing items inline, deleting items with confirmation, displaying items grouped by category with attribution badges showing who added each item. The technical challenge is straightforward CRUD operations against Supabase with optimistic UI updates, plus a localStorage-based identity system for the two-person attribution feature.

The existing codebase already has the Supabase client singleton, Zustand store pattern, shadcn Button/Input components, and a ListPage with a placeholder div ready for item content. The primary new work is: (1) a schema migration adding `added_by` column + UPDATE/DELETE RLS policies, (2) a new Zustand items store managing item state + edit mode, (3) UI components for the add bar, category sections, item rows, edit mode, and name prompt dialog, (4) installing shadcn Dialog and Select components.

**Primary recommendation:** Build vertically — schema migration first (human action), then items store + fetch, then add item, then display with categories, then edit/delete, then attribution (name prompt + badges). Each slice delivers testable functionality.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single text field + Add button at top of list, always visible. Enter/tap submits with name only.
- **D-02:** "More details" expand link reveals quantity (text input) and category (dropdown) fields below the name field.
- **D-03:** Input pinned above items list. Standard top-of-list placement (like Todoist, Apple Reminders).
- **D-04:** Predefined dropdown with ~8 grocery categories: Produce, Dairy, Meat, Bakery, Frozen, Beverages, Snacks, Other.
- **D-05:** Category is optional — items without category go to "Uncategorized" section at bottom.
- **D-06:** Items displayed grouped under bold section headers per category. Empty categories hidden. Sort order follows the predefined category list order.
- **D-07:** Small colored initials badge shown to the left of each item name (e.g., [M] for Mitch). One consistent color per person.
- **D-08:** `added_by` column needed in items table (schema migration). Stores the person's display name.
- **D-09:** Tap an item row to enter inline edit mode — name, quantity, category fields become editable in place. Save on blur or Enter.
- **D-10:** Trash icon appears only while in edit mode. Keeps default view clean.
- **D-11:** Delete requires brief confirmation — row highlights with "Delete?" and cancel/confirm buttons before removal.

### Claude's Discretion
- **Attribution identity mechanism:** Name prompt dialog on first list visit. Stored in localStorage per list. Written to `added_by` column on each item insert.
- **Schema changes:** Add `added_by` (text, nullable) column to items table. Add UPDATE and DELETE RLS policies scoped via list_id foreign key.
- **Color assignment:** Deterministic color from name hash — same name always gets same color.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIST-01 | User can add item with name (required), quantity (optional), and category (optional) | Supabase .insert() with .select() pattern; AddItemBar component; items store addItem action |
| LIST-02 | User can edit an existing item's name, quantity, or category | Supabase .update().eq('id', id).select() pattern; inline edit mode state in store |
| LIST-03 | User can delete an item from the list | Supabase .delete().eq('id', id) pattern; confirmation UI state in store |
| LIST-04 | Items display who added them (initials or color indicator per device/person) | localStorage name prompt; `added_by` column; deterministic color hash; attribution badge component |
| LIST-06 | Items auto-sort by category in the list view | Client-side grouping with predefined category order array; CategorySection component |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Item CRUD operations | API / Backend (Supabase) | Browser (optimistic UI) | Supabase Postgres is source of truth; browser provides instant feedback |
| RLS enforcement (UPDATE/DELETE) | Database (Postgres RLS) | -- | Security enforcement must live at the database layer, not client |
| Category grouping/sorting | Browser / Client | -- | Pure UI concern — data comes flat from DB, grouped on render |
| Attribution identity | Browser / Client (localStorage) | Database (stored on insert) | Identity is device-local; persisted to DB per item for display |
| Edit mode state | Browser / Client (Zustand) | -- | Ephemeral UI state — which item is being edited |
| Name prompt (first visit) | Browser / Client | -- | localStorage detection + Dialog component |

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.106.1 | Database CRUD + RLS | Already configured; .insert/.update/.delete/.select chain API |
| zustand | 5.0.13 | Items store + edit mode state | Existing pattern in uiStore.ts; minimal boilerplate for CRUD state |
| react | 19.2.6 | UI framework | Already installed; use useState for form state |
| lucide-react | 1.16.0 | Icons (Plus, Trash2) | Already installed; referenced in UI spec |
| @base-ui/react | 1.5.0 | Headless UI primitives | Already installed via shadcn; Dialog and Select built on this |

### New (to be installed via shadcn CLI)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn dialog | latest (CLI) | Name prompt modal | First-visit name entry; controlled open state |
| shadcn select | latest (CLI) | Category dropdown | Add bar expanded state + edit mode category field |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Select | Native HTML select | Native select works better on mobile (OS picker) but lacks styling consistency. UI spec says "native select on mobile, styled dropdown on desktop" — shadcn Select renders a native-like experience via @base-ui |
| Zustand items store | useState in ListPage | useState would work for a simple list but becomes unwieldy when edit mode, optimistic updates, and name prompt state are added. Store keeps ListPage clean |
| localStorage for name | Supabase auth | Auth is explicitly out of scope (project constraint). localStorage is appropriate for 2-person private app |

**Installation (shadcn components only):**
```bash
npx shadcn@latest add dialog select
```

No new npm packages required — shadcn components use already-installed @base-ui/react.

## Package Legitimacy Audit

> No new npm packages are being installed. The shadcn CLI copies component source files into `src/components/ui/` using the already-installed `@base-ui/react` primitives. All runtime dependencies (`@supabase/supabase-js`, `zustand`, `lucide-react`, `@base-ui/react`) were installed and verified in Phase 1.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @supabase/supabase-js | npm | 4+ yrs | 2M+/wk | github.com/supabase/supabase-js | N/A (Phase 1) | Already installed |
| zustand | npm | 6+ yrs | 5M+/wk | github.com/pmndrs/zustand | N/A (Phase 1) | Already installed |
| lucide-react | npm | 4+ yrs | 4M+/wk | github.com/lucide-icons/lucide | N/A (Phase 1) | Already installed |
| @base-ui/react | npm | 1+ yr | 200K+/wk | github.com/mui/base-ui | N/A (Phase 1) | Already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No new registry installs in this phase. All dependencies resolved through existing packages + shadcn CLI file copies.*

## Architecture Patterns

### System Architecture Diagram

```
[User taps "Add"] → AddItemBar component
      │
      ├─→ itemsStore.addItem(name, qty, category, addedBy)
      │         │
      │         ├─→ Optimistic: append to store.items[]
      │         └─→ supabase.from('items').insert({...}).select()
      │                    │
      │                    ├─→ Success: replace optimistic item with DB row
      │                    └─→ Failure: remove optimistic item, show error
      │
[User taps item row] → enters edit mode (editingItemId in store)
      │
      ├─→ [Blur/Enter] → itemsStore.updateItem(id, changes)
      │         │
      │         ├─→ Optimistic: merge changes into store item
      │         └─→ supabase.from('items').update({...}).eq('id', id)
      │
      ├─→ [Tap trash] → confirmation state (deletingItemId in store)
      │         │
      │         └─→ [Confirm] → itemsStore.deleteItem(id)
      │                   │
      │                   ├─→ Optimistic: filter item from store
      │                   └─→ supabase.from('items').delete().eq('id', id)
      │
[ListPage mount] → itemsStore.fetchItems(listId)
      │
      └─→ supabase.from('items').select('*').eq('list_id', listId).order('created_at')
                │
                └─→ store.items = data (grouped by category on render)
```

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/                    # shadcn components (button, input, dialog, select)
│   ├── AddItemBar.tsx         # D-01, D-02, D-03 — input + expand + category
���   ├── CategorySection.tsx    # D-06 — section header + item list for one category
│   ├── ItemRow.tsx            # D-07, D-09 — display mode + edit mode
│   ├── DeleteConfirmation.tsx # D-11 — inline confirmation row
│   ├── NamePromptDialog.tsx   # Name entry modal on first visit
│   └── AttributionBadge.tsx   # D-07 — colored initials circle
├── stores/
│   ├── uiStore.ts             # Existing — banner dismiss state
│   └── itemsStore.ts          # NEW — items array, editingItemId, CRUD actions
├── lib/
│   ├── supabase.ts            # Existing — client singleton
│   ├── categories.ts          # NEW — category list + ordering constants
│   └── attribution.ts         # NEW — name hash → color, initials extraction
├── pages/
│   └── ListPage.tsx           # Existing — orchestrates all components
└── types/
    └── item.ts                # NEW — Item interface matching DB schema
```

### Pattern 1: Items Zustand Store with Optimistic Updates
**What:** A Zustand store managing the items array, loading/error state, editing state, and CRUD actions that optimistically update the array then sync with Supabase.
**When to use:** For all item state management in this phase.
**Example:**
```typescript
// Source: Zustand docs pattern + Supabase JS client API
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface Item {
  id: string
  list_id: string
  name: string
  quantity: string | null
  category: string | null
  checked: boolean
  added_by: string | null
  created_at: string
}

interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
  editingItemId: string | null
  deletingItemId: string | null

  fetchItems: (listId: string) => Promise<void>
  addItem: (listId: string, name: string, quantity?: string, category?: string, addedBy?: string) => Promise<void>
  updateItem: (id: string, changes: Partial<Pick<Item, 'name' | 'quantity' | 'category'>>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  setEditingItemId: (id: string | null) => void
  setDeletingItemId: (id: string | null) => void
}

export const useItemsStore = create<ItemsState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,
  editingItemId: null,
  deletingItemId: null,

  fetchItems: async (listId) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (error) {
      set({ error: 'Failed to load items', loading: false })
    } else {
      set({ items: data ?? [], loading: false })
    }
  },

  addItem: async (listId, name, quantity, category, addedBy) => {
    const tempId = crypto.randomUUID()
    const optimisticItem: Item = {
      id: tempId,
      list_id: listId,
      name,
      quantity: quantity || null,
      category: category || null,
      checked: false,
      added_by: addedBy || null,
      created_at: new Date().toISOString(),
    }

    // Optimistic add
    set((state) => ({ items: [...state.items, optimisticItem] }))

    const { data, error } = await supabase
      .from('items')
      .insert({
        list_id: listId,
        name,
        quantity: quantity || null,
        category: category || null,
        added_by: addedBy || null,
      })
      .select()
      .single()

    if (error) {
      // Rollback optimistic add
      set((state) => ({ items: state.items.filter((i) => i.id !== tempId) }))
    } else if (data) {
      // Replace temp item with real DB row
      set((state) => ({
        items: state.items.map((i) => (i.id === tempId ? data : i)),
      }))
    }
  },

  updateItem: async (id, changes) => {
    const prev = get().items.find((i) => i.id === id)
    if (!prev) return

    // Optimistic update
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
      editingItemId: null,
    }))

    const { error } = await supabase
      .from('items')
      .update(changes)
      .eq('id', id)

    if (error) {
      // Rollback
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? prev : i)),
      }))
    }
  },

  deleteItem: async (id) => {
    const prev = get().items.find((i) => i.id === id)
    if (!prev) return

    // Optimistic delete
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      deletingItemId: null,
      editingItemId: null,
    }))

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)

    if (error) {
      // Rollback
      set((state) => ({ items: [...state.items, prev] }))
    }
  },

  setEditingItemId: (id) => set({ editingItemId: id, deletingItemId: null }),
  setDeletingItemId: (id) => set({ deletingItemId: id }),
}))
```

### Pattern 2: Category Grouping (Client-Side)
**What:** A utility that takes a flat items array and groups it into ordered category sections, with empty categories omitted.
**When to use:** In the list display layer between store data and rendered components.
**Example:**
```typescript
// Source: D-04, D-05, D-06 decisions
export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat',
  'Bakery',
  'Frozen',
  'Beverages',
  'Snacks',
  'Other',
  'Uncategorized',
] as const

export type Category = (typeof CATEGORIES)[number]

export function groupItemsByCategory(items: Item[]): { category: Category; items: Item[] }[] {
  const groups = new Map<Category, Item[]>()

  for (const item of items) {
    const cat = (CATEGORIES.includes(item.category as Category)
      ? item.category
      : 'Uncategorized') as Category
    const existing = groups.get(cat) || []
    groups.set(cat, [...existing, item])
  }

  // Return in predefined order, omitting empty categories
  return CATEGORIES
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ category: cat, items: groups.get(cat)! }))
}
```

### Pattern 3: Attribution Color Hash
**What:** Deterministic color assignment from a name string, producing consistent colors for the two-person use case.
**When to use:** For attribution badge background/text color.
**Example:**
```typescript
// Source: UI spec — charCodeAt(0) % 2 → slot A or B
const PERSON_COLORS = [
  { bg: 'oklch(0.75 0.15 250)', text: 'oklch(0.30 0.10 250)' }, // Blue (slot A)
  { bg: 'oklch(0.80 0.15 150)', text: 'oklch(0.35 0.10 150)' }, // Green (slot B)
] as const

export function getAttributionColor(name: string) {
  const slot = name.charCodeAt(0) % 2
  return PERSON_COLORS[slot]
}

export function getInitials(name: string): string {
  return name.charAt(0).toUpperCase()
}
```

### Pattern 4: localStorage Name Prompt
**What:** Check localStorage for stored name per list; if absent, show a mandatory dialog.
**When to use:** On ListPage mount, before user can interact with items.
**Example:**
```typescript
// Source: Claude's Discretion — localStorage key pattern from UI spec
const STORAGE_KEY_PREFIX = 'our-cart-name-'

export function getStoredName(listId: string): string | null {
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${listId}`)
}

export function storeName(listId: string, name: string): void {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${listId}`, name)
}
```

### Anti-Patterns to Avoid
- **Fetching items in every child component:** Fetch once in ListPage, pass data down or read from store. Do NOT call fetchItems in CategorySection or ItemRow.
- **Storing grouped items in Zustand:** Keep items flat in the store. Group on render via the utility function. This avoids sync bugs when an item's category changes.
- **Using `dangerouslySetInnerHTML`:** All item names, quantities, and categories come from user input and are rendered via JSX interpolation (auto-escaped by React).
- **Blocking UI on Supabase response:** Always optimistically update the store first, then sync. Rollback on error. The user should never wait for network to see their action reflected.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom overlay + portal | shadcn Dialog (@base-ui/react Dialog) | Focus trapping, escape handling, accessibility, backdrop click — many edge cases |
| Select/dropdown | Custom dropdown with popover | shadcn Select (@base-ui/react Select) | Keyboard navigation, mobile native rendering, scroll management |
| Unique IDs for optimistic items | Custom incrementing counter | crypto.randomUUID() | Built into browsers, guaranteed unique, no import needed |
| Color accessibility | Manual contrast calculation | Pre-computed oklch values from UI spec | UI spec already verified WCAG AA compliance |
| CSS utility composition | Manual className string building | cn() utility (clsx + tailwind-merge) | Already established in project; handles conditional classes cleanly |

**Key insight:** The shadcn/ui components are already configured in this project (`components.json` with base-nova style, neutral preset). Adding Dialog and Select via CLI is a single command that generates accessible, styled components matching existing Button/Input.

## Common Pitfalls

### Pitfall 1: RLS Policy Blocking UPDATE/DELETE
**What goes wrong:** Items can be inserted but not updated or deleted — Supabase returns permission errors.
**Why it happens:** Phase 1 only created SELECT and INSERT policies. Without explicit UPDATE and DELETE policies, RLS blocks those operations for anon role.
**How to avoid:** Run the ALTER TABLE + CREATE POLICY SQL before implementing update/delete features. The migration SQL must be executed in the Supabase SQL Editor as a human action task.
**Warning signs:** Supabase error code `42501` (insufficient_privilege) in console.

### Pitfall 2: Optimistic Update ID Mismatch
**What goes wrong:** After adding an item optimistically with a temp UUID, the real DB row has a different UUID. If the user edits/deletes the item before the insert response arrives, the operation targets the wrong ID.
**Why it happens:** The temp ID used for optimistic rendering differs from the Supabase-generated UUID.
**How to avoid:** Replace the temp ID with the real ID immediately on insert response. Disable edit/delete interactions on items that still have a temp ID (items in "syncing" state).
**Warning signs:** Delete/edit appears to work but item reappears on next fetch.

### Pitfall 3: Stale Closure in Event Handlers
**What goes wrong:** Inline edit save handler captures a stale reference to the item data, saving old values.
**Why it happens:** React closures in useEffect or event handlers capture state at render time, not current time.
**How to avoid:** Use Zustand store actions (they call `get()` for current state). For form state in edit mode, use local component state that's initialized from the item prop.
**Warning signs:** Edits are lost or partially applied.

### Pitfall 4: Dialog Not Blocking Item Interaction
**What goes wrong:** User can interact with items behind the name prompt dialog.
**Why it happens:** Dialog is rendered but not truly modal (backdrop doesn't prevent clicks, or dialog is non-modal).
**How to avoid:** Use shadcn Dialog component which uses @base-ui Dialog with `modal` behavior by default. Set `onOpenChange` to prevent closing without name entry. Do not render AddItemBar until name is stored.
**Warning signs:** Items appear without `added_by` values.

### Pitfall 5: Missing .select() After .update()
**What goes wrong:** Update succeeds in DB but response `data` is null, making it impossible to confirm the update.
**Why it happens:** Supabase `.update()` does not return data by default — you must chain `.select()`.
**How to avoid:** For operations where you need the response data, always chain `.select()`. For simple updates where you already know the result (optimistic), you can skip `.select()` and just check for `error`.
**Warning signs:** `data` is always null after update/delete operations.

### Pitfall 6: Category Matching Case Sensitivity
**What goes wrong:** Items saved as "produce" don't appear under "Produce" category heading.
**Why it happens:** String comparison is case-sensitive; category might be stored lowercase from a different source.
**How to avoid:** Always save category values using the exact strings from the CATEGORIES constant. In the grouping function, do a case-insensitive match or normalize to the canonical form.
**Warning signs:** Items appearing in "Uncategorized" that should be in a specific category.

## Code Examples

Verified patterns from official sources:

### Supabase Insert with Return (for addItem)
```typescript
// Source: https://supabase.com/docs/reference/javascript/insert
const { data, error } = await supabase
  .from('items')
  .insert({
    list_id: listId,
    name: name.trim(),
    quantity: quantity || null,
    category: category || null,
    added_by: addedBy || null,
  })
  .select()
  .single()
```

### Supabase Update (for editItem)
```typescript
// Source: https://supabase.com/docs/reference/javascript/update
const { error } = await supabase
  .from('items')
  .update({ name, quantity, category })
  .eq('id', itemId)
```

### Supabase Delete (for deleteItem)
```typescript
// Source: https://supabase.com/docs/reference/javascript/delete
const { error } = await supabase
  .from('items')
  .delete()
  .eq('id', itemId)
```

### Supabase Select with Order (for fetchItems)
```typescript
// Source: https://supabase.com/docs/reference/javascript/select
const { data, error } = await supabase
  .from('items')
  .select('*')
  .eq('list_id', listId)
  .order('created_at', { ascending: true })
```

### Schema Migration SQL (human action)
```sql
-- Add added_by column (nullable — existing items won't have it)
ALTER TABLE items ADD COLUMN added_by text;

-- UPDATE policy — anyone with access to the list can update its items
CREATE POLICY "anon_update_items" ON items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM lists WHERE lists.id = items.list_id))
  WITH CHECK (EXISTS (SELECT 1 FROM lists WHERE lists.id = items.list_id));

-- DELETE policy — anyone with access to the list can delete its items
CREATE POLICY "anon_delete_items" ON items FOR DELETE TO anon
  USING (EXISTS (SELECT 1 FROM lists WHERE lists.id = items.list_id));
```

### shadcn Dialog (Name Prompt)
```typescript
// Source: https://ui.shadcn.com/docs/components/dialog
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Controlled dialog — cannot be dismissed without entering name
<Dialog open={!hasName} onOpenChange={() => {}}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>What's your name?</DialogTitle>
      <DialogDescription>So your partner knows who added what</DialogDescription>
    </DialogHeader>
    {/* Name input + Save button */}
  </DialogContent>
</Dialog>
```

### shadcn Select (Category Dropdown)
```typescript
// Source: https://ui.shadcn.com/docs/components/select
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

<Select value={category} onValueChange={setCategory}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Category" />
  </SelectTrigger>
  <SelectContent>
    {CATEGORIES.filter(c => c !== 'Uncategorized').map((cat) => (
      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn built on Radix UI | shadcn built on @base-ui/react (base-nova style) | 2025 | This project uses base-nova — Dialog/Select use @base-ui primitives, not Radix |
| Tailwind v3 with tailwind.config.js | Tailwind v4 CSS-first (no config file) | 2025 | All styling via CSS utilities; @theme block in index.css defines design tokens |
| Zustand v4 with middleware pattern | Zustand v5 with simplified API | 2024 | `create<State>()((set, get) => ({...}))` — double invocation pattern |

**Deprecated/outdated:**
- **Radix UI primitives for shadcn:** This project uses base-nova style which uses `@base-ui/react` (not `@radix-ui/react-*`). Do NOT import from Radix.
- **tailwind.config.js:** Tailwind v4 uses CSS-first configuration. No JS config file exists or should be created.

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `showCloseButton={false}` prop exists on shadcn Dialog to hide the X button | Code Examples (Dialog) | LOW — if prop doesn't exist, use CSS to hide or omit DialogClose; alternative is `onInteractOutside={(e) => e.preventDefault()}` |
| A2 | `crypto.randomUUID()` is available in all target browsers (Chrome, Safari mobile) | Don't Hand-Roll | LOW — widely supported since 2021; fallback to nanoid if needed |
| A3 | shadcn Select via CLI will generate a component compatible with @base-ui/react (matching existing button/input pattern) | Standard Stack | LOW — components.json already configured for base-nova; CLI reads this |

## Open Questions

1. **How does shadcn Dialog prevent dismiss without name?**
   - What we know: Setting `onOpenChange` to a no-op prevents state changes. The UI spec says "no X button, no backdrop close."
   - What's unclear: Exact prop name to disable close button varies between shadcn versions. May be `showCloseButton={false}` or may need to not render DialogClose.
   - Recommendation: After installing Dialog via CLI, inspect the generated source file to verify the close button mechanism. Worst case, conditionally render the close button based on a prop.

2. **Should optimistic items be visually distinct?**
   - What we know: Optimistic items appear instantly but haven't been confirmed by Supabase yet.
   - What's unclear: Whether to show a subtle "syncing" indicator or just render normally.
   - Recommendation: For a 2-person app on good connectivity, render normally. Add error handling that removes failed items and shows a toast. Keep it simple.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + dev server | Yes | 20.12.1 | -- |
| npm | Package management | Yes | 10.5.0 | -- |
| Supabase (cloud) | Database + RLS | Yes (provisioned in Phase 1) | -- | -- |
| shadcn CLI | Install Dialog + Select | Yes (npx) | 4.8.0 | -- |
| Vitest | Unit tests | Yes | 3.2.3 | -- |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.3 + @testing-library/react 16.3.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIST-01 | Add item with name → appears in store/DB | unit | `npx vitest run src/stores/itemsStore.test.ts -t "addItem"` | No — Wave 0 |
| LIST-01 | AddItemBar submits on Enter with name only | unit | `npx vitest run src/components/AddItemBar.test.tsx` | No — Wave 0 |
| LIST-02 | Edit item changes name/qty/category in store | unit | `npx vitest run src/stores/itemsStore.test.ts -t "updateItem"` | No — Wave 0 |
| LIST-02 | Tap item row → inline edit fields appear | unit | `npx vitest run src/components/ItemRow.test.tsx -t "edit"` | No — Wave 0 |
| LIST-03 | Delete item removes from store after confirmation | unit | `npx vitest run src/stores/itemsStore.test.ts -t "deleteItem"` | No — Wave 0 |
| LIST-04 | Attribution badge shows correct initials and color | unit | `npx vitest run src/lib/attribution.test.ts` | No — Wave 0 |
| LIST-04 | Name prompt appears when no localStorage entry | unit | `npx vitest run src/components/NamePromptDialog.test.tsx` | No — Wave 0 |
| LIST-06 | Items grouped by category in correct order | unit | `npx vitest run src/lib/categories.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/stores/itemsStore.test.ts` — covers LIST-01, LIST-02, LIST-03 (store actions)
- [ ] `src/components/AddItemBar.test.tsx` — covers LIST-01 (form submission)
- [ ] `src/components/ItemRow.test.tsx` — covers LIST-02 (edit mode toggle)
- [ ] `src/lib/categories.test.ts` — covers LIST-06 (grouping + ordering)
- [ ] `src/lib/attribution.test.ts` — covers LIST-04 (color hash + initials)
- [ ] `src/components/NamePromptDialog.test.tsx` — covers LIST-04 (localStorage detection)
- [ ] shadcn Dialog + Select installed: `npx shadcn@latest add dialog select`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — no auth; URL is credential (project decision) |
| V3 Session Management | No | N/A — no sessions |
| V4 Access Control | Yes | Supabase RLS policies on items table (UPDATE/DELETE scoped by list_id) |
| V5 Input Validation | Yes | React JSX auto-escaping; name/quantity/category are text fields with no HTML rendering |
| V6 Cryptography | No | N/A — no sensitive data encryption needed |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via item name/quantity | Tampering | React JSX auto-escapes all interpolated values; no dangerouslySetInnerHTML |
| Unauthorized item modification | Elevation of Privilege | RLS UPDATE policy checks list_id FK exists in lists table — same as SELECT/INSERT |
| Unauthorized item deletion | Elevation of Privilege | RLS DELETE policy checks list_id FK exists in lists table |
| localStorage name spoofing | Spoofing | Accepted risk for 2-person private app — name is cosmetic attribution only, not access control |
| Missing RLS for UPDATE/DELETE | Elevation of Privilege | Schema migration MUST add policies before code ships — checkpoint:human-action task |

## Sources

### Primary (HIGH confidence)
- Supabase JS .update() API: https://supabase.com/docs/reference/javascript/update [CITED]
- Supabase JS .delete() API: https://supabase.com/docs/reference/javascript/delete [CITED]
- Supabase JS .insert() API: https://supabase.com/docs/reference/javascript/insert [CITED]
- Supabase JS .select() + .order() API: https://supabase.com/docs/reference/javascript/select [CITED]
- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security [CITED]
- shadcn/ui Dialog component: https://ui.shadcn.com/docs/components/dialog [CITED]
- shadcn/ui Select component: https://ui.shadcn.com/docs/components/select [CITED]
- Existing codebase patterns: ListPage.tsx, uiStore.ts, CreateListForm.tsx, supabase.ts [VERIFIED: codebase]
- Phase 1 schema SQL: .planning/phases/01-foundation/01-01-PLAN.md [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Zustand CRUD patterns with TypeScript: https://github.com/pmndrs/zustand [CITED]

### Tertiary (LOW confidence)
- shadcn Dialog `showCloseButton` prop behavior [ASSUMED — needs verification after CLI install]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and proven in Phase 1; no new dependencies
- Architecture: HIGH — patterns directly extend existing codebase (Zustand store, Supabase queries, shadcn components)
- Pitfalls: HIGH — derived from official Supabase docs (RLS requirements, .select() chaining) and established React patterns
- Security: HIGH — RLS policies follow exact same pattern as Phase 1 SELECT/INSERT; threat model is minimal for cosmetic attribution

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable — no fast-moving dependencies)
