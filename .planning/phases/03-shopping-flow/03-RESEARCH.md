# Phase 3: Shopping Flow - Research

**Researched:** 2026-05-25
**Domain:** Checkbox toggle, bulk delete, modal confirmation, gesture separation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Check off via a dedicated checkbox/circle control on the row, NOT by tapping the row body. Tapping the row body still enters inline edit mode (Phase 2 behavior preserved).
- **D-02:** Row layout left-to-right: `[checkbox] [attribution badge] name … quantity`. Checkbox leads; badge stays immediately after. Checkbox must keep a ≥44px effective tap target.
- **D-03:** Toggling the checkbox flips `checked` both directions (same control for check and uncheck).
- **D-04:** Checked items stay exactly in place within their category section — no reordering, no sinking, no separate "Done" section.
- **D-05:** A checked item shows a filled checkbox, name with `line-through`, and reduced opacity.
- **D-06:** "Clear completed (N)" button appears below the list ONLY when at least one checked item exists. Hidden otherwise.
- **D-07:** Tapping Clear opens a modal confirmation dialog ("Remove N checked items?" → Cancel / Clear) using the already-installed shadcn Dialog. Bulk destructive action — modal, not inline.

### Claude's Discretion

- **Store actions:** Add `toggleChecked(id)` and `clearChecked(listId)` to `itemsStore.ts`, following the existing optimistic-update + per-item rollback + `error` state pattern. `clearChecked` is a bulk delete of all rows where `checked = true`, with rollback restoring removed items on failure.
- **Checked count:** Derive `N` from the existing `items` array in the store — no new state field needed.
- **Checkbox component:** Use the shadcn Checkbox primitive if installed; otherwise install via `npx shadcn@latest add checkbox` or use an accessible custom toggle. Planner decides.
- **Edit-mode interaction:** Checkbox is part of display mode only; edit mode (Phase 2) is unchanged.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-01 | User can check off an item (item stays visible, shown crossed out/dimmed) | `toggleChecked(id)` optimistic UPDATE; conditional `line-through opacity-50` classes on display mode |
| SHOP-02 | User can uncheck a previously checked item | Same `toggleChecked(id)` action — idempotent toggle, no special path needed |
| SHOP-03 | User can clear all checked items (removes from both views) | `clearChecked(listId)` bulk DELETE via Supabase `.delete().eq().eq()` chain |
| SHOP-04 | Clear action requires confirmation before executing | Base UI Dialog `open` / `onOpenChange` controlled pattern — already in codebase |

</phase_requirements>

---

## Summary

Phase 3 layers a check-off shopping flow on top of the fully-working Phase 2 item CRUD. The scope is narrow: toggle a `checked` boolean, apply a visual dim/strikethrough, and bulk-delete checked items behind a confirmation modal. The `checked` column and RLS policies already exist; no schema work is needed.

The key discovery is that the project does NOT use Radix UI or the canonical shadcn/ui Checkbox. It uses **Base UI (`@base-ui/react` 1.5.0)**, the same underlying library backing the existing Dialog and other primitives. A `Checkbox` primitive ships inside the already-installed `@base-ui/react` package at `@base-ui/react/checkbox` — no install command is needed. The planner should create a `src/components/ui/checkbox.tsx` wrapper around it, matching the pattern of the existing `dialog.tsx`.

The Dialog is already installed and already used in a controlled manner (`open` + `onOpenChange`) by `NamePromptDialog`. The `clearChecked` modal reuses that exact pattern.

**Primary recommendation:** No new packages. Write `toggleChecked` and `clearChecked` into `itemsStore.ts` following the existing `updateItem`/`deleteItem` pattern verbatim. Wrap `@base-ui/react/checkbox` as `src/components/ui/checkbox.tsx`. Wire checkbox into `ItemRow` display mode with `e.stopPropagation()` on click to prevent row-body edit trigger.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Toggle checked state | Client (Zustand store) | Supabase (Postgres persistence) | Optimistic update pattern established in Phase 2 — UI updates instantly, DB syncs async |
| Visual checked styling | Client (React component) | — | Pure CSS/Tailwind on `item.checked` boolean — no server involvement |
| Clear completed (bulk delete) | Client (Zustand store) | Supabase (Postgres DELETE) | Store removes items optimistically; DB row deletion is the source of truth |
| Confirmation modal | Client (ListPage ephemeral state) | — | Ephemeral UI state lives in ListPage per established pattern (editingItemId, deletingItemId) |
| Checked count derivation | Client (derived from store) | — | `items.filter(i => i.checked).length` — no new state field |

---

## Standard Stack

### Core (all already installed — NO new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` (Checkbox) | 1.5.0 (installed) | Accessible checkbox primitive | Already ships in the installed package; powers the existing Dialog. `Checkbox.Root` + `Checkbox.Indicator` API |
| `@base-ui/react` (Dialog) | 1.5.0 (installed) | Confirmation modal | Already used by `NamePromptDialog` — controlled `open` + `onOpenChange` pattern |
| Zustand (`useItemsStore`) | 5.0.13 (installed) | `toggleChecked` and `clearChecked` actions | Extends existing store — same optimistic-update pattern |
| Supabase JS | 2.106.1 (installed) | `.update()` for toggle, `.delete().eq().eq()` for bulk clear | Already connected; RLS policies in place |
| Tailwind v4 | 4.3.0 (installed) | `line-through`, `opacity-50`, `min-h-[44px]` | Same utility classes already used in ItemRow |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 1.16.0 (installed) | Check icon for filled checkbox indicator | Already used in ItemRow (Trash2). Use `Check` icon inside Checkbox.Indicator |

**Installation:** None required. All dependencies are present.

---

## Package Legitimacy Audit

> No new packages are installed in this phase. All components come from `@base-ui/react` 1.5.0 which is already installed and in `package.json`. Audit is not applicable.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| `@base-ui/react` | npm | Already installed v1.5.0 | Pre-existing — no install needed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User tap on checkbox
        │
        ▼
ItemRow onClick (checkbox area)
   e.stopPropagation()          ← prevents row-body onTap → edit mode
        │
        ▼
onToggle(item.id)  [prop from CategorySection → ListPage]
        │
        ▼
itemsStore.toggleChecked(id)
   optimistic: flip item.checked in items[]
        │
        ├─── Supabase UPDATE items SET checked=!prev WHERE id=id
        │         ├── success: no-op (state already correct)
        │         └── error: rollback item.checked to prev value, set error
        │
        ▼
ItemRow re-renders with item.checked=true
   → filled Checkbox.Indicator
   → name: "line-through opacity-50"

─────────────────────────────────────────────

User taps "Clear completed (N)"  [rendered in ListPage below category list]
        │
        ▼
setClearDialogOpen(true)  [ListPage local useState]
        │
        ▼
Dialog open=true renders
"Remove N checked items?" → [Cancel] [Clear]
        │
        ├── Cancel: setClearDialogOpen(false)
        └── Clear:
              setClearDialogOpen(false)
              itemsStore.clearChecked(list.id)
                   optimistic: remove all checked items from items[]
                   │
                   Supabase DELETE FROM items
                     WHERE list_id = listId AND checked = true
                   │
                   ├── success: no-op
                   └── error: restore removed items, set error
```

### Recommended Project Structure (changes only)

```
src/
├── components/
│   ├── ui/
│   │   └── checkbox.tsx       ← NEW: Base UI Checkbox wrapper (mirrors dialog.tsx pattern)
│   └── ItemRow.tsx             ← MODIFIED: display mode adds checkbox + checked styling
├── components/
│   └── CategorySection.tsx    ← MODIFIED: add onToggle prop, pass through
├── pages/
│   └── ListPage.tsx           ← MODIFIED: add clearDialogOpen state, Clear button, Dialog
└── stores/
    └── itemsStore.ts          ← MODIFIED: add toggleChecked + clearChecked actions
```

### Pattern 1: Base UI Checkbox Wrapper

The project wraps Base UI primitives into `src/components/ui/` (see `dialog.tsx`, `button.tsx`, `input.tsx`). The Checkbox follows the same convention. [VERIFIED: codebase inspection]

```tsx
// src/components/ui/checkbox.tsx
// Source: @base-ui/react/checkbox/root/CheckboxRoot.d.ts (local node_modules)
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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

**Key API facts** [VERIFIED: local node_modules type definitions]:
- `Checkbox.Root` props: `checked?: boolean`, `onCheckedChange?: (checked: boolean, eventDetails) => void`, `disabled?: boolean`
- `Checkbox.Indicator` renders only when checked (unless `keepMounted` is set)
- The Root renders a `<span>` + hidden `<input>` — NOT a native `<button>` or `<input type="checkbox">`
- State attribute for styling: `data-[checked]` (not `data-[state="checked"]` — that is Radix convention)

### Pattern 2: toggleChecked Store Action

Follows `updateItem` exactly — snapshot prev, optimistic update, rollback on error. [VERIFIED: codebase inspection of itemsStore.ts]

```typescript
// Extends ItemsState interface:
toggleChecked: (id: string) => Promise<void>

// Implementation:
toggleChecked: async (id) => {
  const prev = get().items.find((i) => i.id === id)
  if (!prev) return

  const nextChecked = !prev.checked

  // Optimistic update
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
    // Per-item rollback: restore to prev state
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? prev : i)),
      error: 'Failed to update item',
    }))
  }
},
```

### Pattern 3: clearChecked Store Action

Follows `deleteItem` but captures multiple items for rollback. [VERIFIED: codebase inspection + Supabase JS v2 API]

```typescript
// Extends ItemsState interface:
clearChecked: (listId: string) => Promise<void>

// Implementation:
clearChecked: async (listId) => {
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
    // Rollback: restore all removed items
    set((state) => ({
      items: [...state.items, ...checkedItems],
      error: 'Failed to clear items',
    }))
  }
},
```

**Supabase JS v2 chained `.eq()` fact** [VERIFIED: local node_modules + confirmed Supabase JS v2 pattern]:
Multiple `.eq()` calls chain as AND conditions. `.delete().eq('list_id', listId).eq('checked', true)` deletes all rows in this list where `checked = true`. This is the correct v2 syntax — no `.match()` required.

### Pattern 4: Controlled Dialog (Clear Confirmation)

The `NamePromptDialog` shows the exact pattern for the clear confirmation dialog. [VERIFIED: codebase inspection of NamePromptDialog.tsx and dialog.tsx]

```tsx
// In ListPage.tsx — add alongside existing state:
const [clearDialogOpen, setClearDialogOpen] = useState(false)

// Derived from store — no new state field:
const checkedCount = items.filter((i) => i.checked).length

// Controlled Dialog — same props as NamePromptDialog uses:
<Dialog open={clearDialogOpen} onOpenChange={(open) => setClearDialogOpen(open)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Remove {checkedCount} checked item{checkedCount !== 1 ? 's' : ''}?</DialogTitle>
    </DialogHeader>
    <DialogFooter>
      <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
      <Button
        variant="destructive"
        onClick={() => {
          setClearDialogOpen(false)
          clearChecked(list.id).catch(() => {})
        }}
      >
        Clear
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Base UI Dialog controlled API** [VERIFIED: local node_modules DialogRoot.d.ts]:
- `open?: boolean` — controlled open state
- `onOpenChange?: (open: boolean, eventDetails) => void` — called on Escape, backdrop click, or close button press
- `disablePointerDismissal?: boolean` — set `true` to prevent backdrop dismiss (optional for this dialog)
- The `eventDetails` second parameter in `onOpenChange` is typed but can be ignored: `(open) => setClearDialogOpen(open)`

### Pattern 5: Display Mode ItemRow Integration

The existing display mode div has `onClick={onTap}` which triggers edit mode. The checkbox must intercept its own tap without propagating. [VERIFIED: codebase inspection ItemRow.tsx lines 215-243]

```tsx
// In ItemRow display mode — add checkbox BEFORE attribution badge:
<div
  className={cn(
    'flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-border px-3 py-2 hover:bg-secondary active:bg-secondary',
    item.checked && 'opacity-50'
  )}
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
  {/* Checkbox FIRST — stops propagation so row-body onClick does not fire */}
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

  {/* Attribution badge (position unchanged per D-02) */}
  {item.added_by ? (
    <AttributionBadge name={item.added_by} />
  ) : (
    <div className="flex h-7 w-7 shrink-0 ..." aria-label="Unknown person added this">?</div>
  )}

  {/* Name — conditional strikethrough per D-05 */}
  <span className={cn('flex-1 text-base', item.checked && 'line-through')}>
    {item.name}
  </span>

  {item.quantity && (
    <span className="text-sm text-muted-foreground">{item.quantity}</span>
  )}
</div>
```

### Pattern 6: Prop-Drilling onToggle Through CategorySection

CategorySection passes edit/delete handlers through via props. Add `onToggle` following the identical pattern. [VERIFIED: codebase inspection CategorySection.tsx]

```typescript
// Add to CategorySectionProps:
onToggle: (id: string) => void

// Add to CategorySection render, passed to ItemRow:
onToggle={(id) => onToggle(id)}
// or simply:
onToggle={onToggle}
```

```typescript
// Add to ItemRowProps:
onToggle: (id: string) => void
```

### Anti-Patterns to Avoid

- **Calling `onTap` from inside the checkbox click handler:** The checkbox click area and the row body are the same DOM ancestor. The ONLY safe separation is `e.stopPropagation()` on the checkbox's wrapping div. Do not attempt to distinguish via coordinates or event targets.
- **Using `Checkbox.Root` without a wrapping `min-h-[44px]` container:** The Root renders a `<span>`, not a button. Its visible size may be smaller than 44px unless the container enforces the tap target.
- **Storing checked count in Zustand:** Derive with `items.filter(i => i.checked).length` — a new state field would go stale and is unnecessary.
- **Calling `clearChecked` without capturing the pre-clear snapshot first:** The rollback array must be built BEFORE the optimistic removal `set()` call. The `deleteItem` pattern captures `prev` before `set()` — do the same for the array of checked items.
- **Setting `error` before rollback set in store:** The existing pattern sets both `items` (rollback) and `error` in the same `set()` call. Don't split them into two `set()` calls.
- **Importing Checkbox from a non-existent shadcn/ui checkbox.tsx:** The file does not exist yet. The planner must create it. Importing `@/components/ui/checkbox` before that file exists is a compile error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible checkbox | Native `<input type="checkbox">` with manual styling | `@base-ui/react/checkbox` | Handles focus, keyboard, ARIA state, indeterminate — already installed |
| Confirmation modal | Inline "are you sure?" with `confirm()` or custom overlay | Base UI Dialog (already in dialog.tsx) | `window.confirm()` is not styleable and blocks the thread; existing Dialog handles backdrop, focus trap, Escape key |
| Tap target enforcement | `pointer-events` hacks | `min-h-[44px]` + `min-w-[44px]` container | Existing ItemRow uses `min-h-[48px]` — apply same pattern to checkbox wrapper |
| Checked count state | Zustand state field | `.filter(i => i.checked).length` in render | Derived state is always correct; extra state field goes stale |

---

## Common Pitfalls

### Pitfall 1: Row-body tap triggers edit mode when checkbox is clicked
**What goes wrong:** Tapping the checkbox also fires the row's `onClick={onTap}`, opening inline edit mode. Confusing UX that contradicts D-01.
**Why it happens:** The checkbox is inside the row div. Click events bubble up.
**How to avoid:** Wrap the Checkbox in a `<div onClick={(e) => e.stopPropagation()}>`. Do not rely on checking `event.target` — this breaks on indirect clicks (label, indicator).
**Warning signs:** Edit mode activates immediately after checking an item.

### Pitfall 2: Checkbox data attribute for styling uses `data-[checked]` not `data-[state="checked"]`
**What goes wrong:** Tailwind classes like `data-[state="checked"]:bg-primary` have no effect. Checkbox never appears filled.
**Why it happens:** Radix UI uses `data-state="checked"`. Base UI uses `data-checked` (presence attribute, no value). They are different.
**How to avoid:** Use `data-[checked]:bg-primary` in Tailwind v4 class strings. [VERIFIED: @base-ui/react CheckboxRoot.d.ts — state attribute naming convention consistent with other Base UI components]
**Warning signs:** The indicator mounts (component logic works) but the surrounding box never changes color.

### Pitfall 3: Rollback for clearChecked restores items in wrong order
**What goes wrong:** On error, the rolled-back items append at the end of the list, displacing the category sort order until the next fetch.
**Why it happens:** `[...state.items, ...checkedItems]` appends to end; original sort order may differ.
**How to avoid:** This is acceptable for an error recovery path — a Retry re-fetch from the error banner will restore canonical sort order. Match the `deleteItem` rollback pattern: `set((state) => ({ items: [...state.items, prev], error: '...' }))`. Sort order is restored when the user retaps "Retry". Do NOT add complex re-insertion logic.
**Warning signs:** N/A — this is a known acceptable tradeoff documented in the existing error-handling pattern.

### Pitfall 4: `clearChecked` snapshot taken after optimistic removal
**What goes wrong:** Rollback array is empty because `get().items` was read after the optimistic `set()` removed checked items.
**Why it happens:** `get()` returns current state — after optimistic removal, checked items are gone.
**How to avoid:** Read `const checkedItems = get().items.filter(i => i.checked)` BEFORE calling `set()`. Same pattern as `deleteItem` which reads `const prev = get().items.find(...)` first.
**Warning signs:** Error banner appears but items do not come back.

### Pitfall 5: Dialog closes on backdrop click before user sees the action
**What goes wrong:** User accidentally dismisses the clear dialog by tapping outside it. This is especially likely on mobile while shopping (one-handed use).
**Why it happens:** Base UI Dialog default `disablePointerDismissal` is `false`, so clicking the backdrop closes the modal.
**How to avoid:** Consider passing `disablePointerDismissal={true}` to `<Dialog>` on the clear confirmation. This is Claude's discretion — the planner should decide based on the destructive nature of the action.
**Warning signs:** Hard to notice in testing (desktop click is precise); more likely on mobile.

### Pitfall 6: "Clear completed (N)" button count goes stale after error rollback
**What goes wrong:** User clears, error occurs, items are rolled back, but the count shown in the button does not update because it was computed before the rollback.
**Why it happens:** N/A if using `items.filter(i => i.checked).length` reactively in render — Zustand triggers re-render on every `set()` call including rollbacks.
**How to avoid:** Derive the count from `items` in the render function, not from a captured `const`. React/Zustand reactivity handles this automatically.

---

## Code Examples

### Verified Store Interface Extension

```typescript
// Add to ItemsState interface in itemsStore.ts:
toggleChecked: (id: string) => Promise<void>
clearChecked: (listId: string) => Promise<void>
```

### Verified Supabase Bulk Delete Syntax (v2)

```typescript
// Source: @supabase/supabase-js v2 — chained .eq() = AND conditions
const { error } = await supabase
  .from('items')
  .delete()
  .eq('list_id', listId)
  .eq('checked', true)
```

No `.match()` object form is needed. Multiple `.eq()` calls are idiomatic supabase-js v2. [VERIFIED: codebase pattern in itemsStore.ts; consistent with existing `.select().eq('list_id', listId).order(...)` pattern]

### Verified Dialog Controlled Pattern (from NamePromptDialog.tsx)

```tsx
// Controlled open — identical to what ClearConfirmationDialog needs:
<Dialog open={open} onOpenChange={(open) => handleOpenChange(open)}>
  <DialogContent showCloseButton={false}>
    ...
  </DialogContent>
</Dialog>
```

`onOpenChange` receives `(open: boolean, eventDetails)`. For the clear dialog: `(open) => setClearDialogOpen(open)`.

### Verified Base UI Checkbox Import Path

```typescript
// Source: local node_modules — @base-ui/react ships checkbox as a subpath export
import { Checkbox } from '@base-ui/react/checkbox'
// Exposes: Checkbox.Root, Checkbox.Indicator
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Radix UI Checkbox (shadcn default) | Base UI Checkbox (`@base-ui/react`) | This project uses Base UI throughout. `data-[state="checked"]` Radix patterns do NOT apply — use `data-[checked]` |
| `window.confirm()` for destructive actions | Modal Dialog with controlled `open` state | Non-blocking, styleable, mobile-safe |

**Deprecated/outdated:**
- `shadcn/ui add checkbox` — installs a Radix-based checkbox. Do NOT run this command for this project. The project already has Base UI installed; creating a `checkbox.tsx` wrapper around `@base-ui/react/checkbox` is the correct path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Base UI `data-[checked]` attribute (not `data-state`) is used for checkbox styling | Architecture Patterns / Pitfall 2 | Visual checkbox appearance broken; mitigate by testing the wrapper component before wiring into ItemRow |
| A2 | `disablePointerDismissal` on the clear dialog should be `true` (prevent accidental dismiss) | Pitfall 5 | User accidentally clears; low risk since there is a retry path via re-add |

---

## Open Questions

1. **DialogClose render prop in footer**
   - What we know: `NamePromptDialog` uses `DialogClose` from Base UI directly. `DialogFooter` has a `showCloseButton` prop but it uses `<Button variant="outline">`. The Cancel button in the clear modal should behave as a close action.
   - What's unclear: Whether Cancel should use `DialogClose render={<Button variant="outline" />}` (Base UI pattern in dialog.tsx line 112) or a plain `<Button onClick={() => setClearDialogOpen(false)}>`.
   - Recommendation: Use the plain `<Button onClick>` approach — it's explicit, avoids relying on `DialogClose` imperative behavior, and is consistent with the `NamePromptDialog` pattern of controlling open state entirely from the parent.

2. **Checkbox wrapper: min-h-[44px] on Root vs wrapping div**
   - What we know: `Checkbox.Root` renders a `<span>`. The 44px tap target must come from somewhere.
   - What's unclear: Whether `className="min-h-[44px] ..."` on `Checkbox.Root` directly applies (it passes through via `BaseUIComponentProps`) or needs an outer `<div>`.
   - Recommendation: Use an outer `<div className="flex h-[44px] w-[44px] items-center justify-center">` wrapping `Checkbox.Root` — this is the safe approach regardless of how Base UI handles className prop forwarding.

---

## Environment Availability

> Step 2.6: SKIPPED — this phase is code-only changes with no new external dependencies. All tools and packages are already installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.3 + React Testing Library 16.3.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-01 | Checking an item calls `toggleChecked` and applies strikethrough/opacity | unit | `npx vitest run src/components/ItemRow.test.tsx -t "checked"` | ❌ Wave 0 |
| SHOP-02 | Unchecking calls `toggleChecked` again (toggle is idempotent both ways) | unit | `npx vitest run src/components/ItemRow.test.tsx -t "uncheck"` | ❌ Wave 0 |
| SHOP-03 | `clearChecked` removes all checked items optimistically | unit | `npx vitest run src/stores/itemsStore.test.ts -t "clearChecked"` | ❌ Wave 0 |
| SHOP-04 | Clear dialog opens on button click and only clears after confirm | unit | `npx vitest run src/pages/ListPage.test.tsx -t "clear"` | ❌ extends existing |
| SHOP-01/02 | Checkbox tap does NOT trigger edit mode (stopPropagation) | unit | `npx vitest run src/components/ItemRow.test.tsx -t "stopPropagation"` | ❌ Wave 0 |
| SHOP-03 | `clearChecked` rollback restores items on Supabase error | unit | `npx vitest run src/stores/itemsStore.test.ts -t "rollback"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/stores/itemsStore.test.ts src/components/ItemRow.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/stores/itemsStore.test.ts` — covers SHOP-01 toggle optimistic, SHOP-03 clearChecked optimistic + rollback
- [ ] `src/components/ItemRow.test.tsx` — covers SHOP-01 checked visual state, SHOP-02 uncheck, checkbox stopPropagation
- [ ] `src/components/ui/checkbox.test.tsx` — optional; covers checkbox wrapper renders with correct aria-label
- [ ] Extend `src/pages/ListPage.test.tsx` — covers SHOP-04 dialog open/close, clear action wiring

*(Existing `ListPage.test.tsx` has a Supabase mock scaffold — extend it rather than replace)*

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this app |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes | Supabase RLS — DELETE policy scoped to `list_id`; UPDATE policy scoped to `list_id`. Both already set in Phase 2. The `clearChecked` Supabase call is scoped to `list_id` in the query. |
| V5 Input Validation | no | No new user input — toggle is a boolean flip, clear is a bulk delete with no user-supplied filter |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Clearing another list's checked items | Tampering | Supabase RLS DELETE policy checks `list_id` against the authenticated list context — already enforced from Phase 2. The client always passes the correct `list_id` from the loaded list object. |
| Checked state visible across lists | Information Disclosure | Supabase RLS SELECT policy scoped to `list_id` — already enforced. No new query surfaces. |
| Optimistic UI shows wrong state to both users | Spoofing | Phase 3 has no real-time sync (Phase 4). Both users see their own optimistic state until next page load. Acceptable for this phase; documented for Phase 4. |

---

## Sources

### Primary (HIGH confidence — local codebase, verified via file inspection)
- `src/stores/itemsStore.ts` — exact store pattern for toggleChecked and clearChecked
- `src/components/ItemRow.tsx` — display mode structure lines 214-243; row onClick pattern
- `src/components/CategorySection.tsx` — prop-drilling pattern for new onToggle
- `src/pages/ListPage.tsx` — ephemeral state pattern (editingItemId, deletingItemId); Dialog wire-up location
- `src/components/NamePromptDialog.tsx` — controlled Dialog open/onOpenChange pattern
- `src/components/ui/dialog.tsx` — Dialog components API and DialogClose render prop pattern
- `node_modules/@base-ui/react/checkbox/root/CheckboxRoot.d.ts` — Checkbox.Root props: checked, onCheckedChange, disabled
- `node_modules/@base-ui/react/checkbox/indicator/CheckboxIndicator.d.ts` — Checkbox.Indicator: keepMounted
- `node_modules/@base-ui/react/dialog/root/DialogRoot.d.ts` — Dialog.Root: open, onOpenChange, disablePointerDismissal

### Secondary (MEDIUM confidence — npm registry)
- `npm view @base-ui/react version` → 1.5.0 confirmed as current published version

### Tertiary (LOW confidence)
- None — all claims verified from local codebase or official package type definitions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from installed node_modules and package.json
- Architecture: HIGH — patterns derived from actual codebase (itemsStore.ts, ItemRow.tsx)
- Base UI Checkbox API: HIGH — verified from local type definition files
- Dialog controlled pattern: HIGH — verified from NamePromptDialog.tsx (live usage)
- Pitfalls: HIGH — Pitfall 1, 2, 4 verified from codebase patterns; Pitfall 3, 5 from reasoning

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable stack — Base UI and Supabase JS v2 APIs are stable)
