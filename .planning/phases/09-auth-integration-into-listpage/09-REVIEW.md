---
phase: 09-auth-integration-into-listpage
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/types/item.ts
  - src/stores/authStore.ts
  - src/stores/uiStore.ts
  - src/components/AttributionBadge.tsx
  - src/components/ItemRow.tsx
  - src/components/Sidebar.tsx
  - src/components/AppShell.tsx
  - src/components/CategorySection.tsx
  - src/components/AddItemBar.tsx
  - src/pages/ListPage.tsx
  - src/stores/authStore.test.ts
  - src/stores/uiStore.test.ts
  - src/components/AttributionBadge.test.tsx
  - src/components/ItemRow.test.tsx
  - src/components/Sidebar.test.tsx
  - src/components/AddItemBar.test.tsx
  - src/pages/ListPage.test.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 9 adds live attribution (own-item display name/avatar vs. frozen `added_by`), profile management in the sidebar (display name edit, Google avatar, sign-out), and removes the legacy NamePromptDialog. The architecture is sound — Zustand optimistic update + rollback pattern is correct, the `restoreBanner` Set immutability is handled properly, and the referrerPolicy/onError avatar fallback is correctly applied in both `AttributionBadge` and `Sidebar`.

Two critical issues found: `user_id` is never written to the database when an item is added, so the live attribution check (`item.user_id === currentUserId`) will always evaluate to `false` for new items; and `resolveDisplayName` is called with a non-null assertion (`user!`) at the point where `user` could still be `null`, causing a runtime crash on the `AddItemBar` render. Four warnings cover input length validation, a stale closure in `handleSave`, a misleading test assertion, and an avatar URL falling back through an extra metadata key unnecessarily.

## Critical Issues

### CR-01: `user_id` never written to Supabase — live attribution permanently broken

**File:** `src/stores/itemsStore.ts:92-98`
**Issue:** The `addItem` insert payload omits `user_id`. The `Item` type declares `user_id: string | null`, and the live attribution path in `ItemRow` depends on `item.user_id === currentUserId`. Because `user_id` is never set, every item created after Phase 9 will have `user_id = null`, so `isOwnItem` is always `false`. The own-item branch (live display name + live avatar) is dead code in production for all new items.

The `addItem` signature already accepts `addedBy` but was never extended to accept/forward the current user's ID. `AddItemBar` does not have access to the user ID either — it receives only `addedBy: string`.

**Fix:** Thread `userId` through the call chain.

In `itemsStore.ts`, extend `addItem`:
```ts
addItem: async (listId, name, quantity, category, addedBy, userId?) => {
  const optimisticItem: Item = {
    ...
    added_by: addedBy || null,
    user_id: userId || null,   // ← add
  }
  // insert payload:
  .insert({
    list_id: listId,
    name,
    quantity: quantity || null,
    category: category || null,
    added_by: addedBy || null,
    user_id: userId || null,   // ← add
  })
```

In `AddItemBar`, accept and forward `userId`:
```tsx
interface AddItemBarProps {
  listId: string
  addedBy: string
  userId?: string | null   // ← add
}
// in handleSubmit:
await addItem(listId, trimmedName, quantity.trim() || undefined, category || undefined, addedBy, userId)
```

In `ListPage.tsx` line 382:
```tsx
<AddItemBar
  listId={list.id}
  addedBy={resolveDisplayName(user!)}
  userId={user?.id ?? null}   // ← add
/>
```

---

### CR-02: `user!` non-null assertion on `AddItemBar` — runtime crash when `user` is null

**File:** `src/pages/ListPage.tsx:383`
**Issue:** `resolveDisplayName(user!)` is called unconditionally inside the render path that is reached whenever the list loads (line 285+). `user` is typed `User | null` from `useAuthStore`. Although the app requires auth, Supabase's `onAuthStateChange` may fire with `null` before the first `INITIAL_SESSION` event resolves, meaning `user` can be `null` during initial hydration. Calling `resolveDisplayName(null!)` will immediately throw `Cannot read properties of null (reading 'user_metadata')`, crashing the entire page.

The loading guard at line 266 only guards `loading` (the list fetch), not `authStore.isLoading`. So the component can reach line 383 with `list` populated but `user` still null.

**Fix:** Guard the `AddItemBar` render against a null user, or provide a safe fallback:
```tsx
{user && (
  <AddItemBar
    listId={list.id}
    addedBy={resolveDisplayName(user)}
    userId={user.id}
  />
)}
```
Or, if the app guarantees auth before ListPage renders, add a top-level auth loading guard earlier in the render tree (preferred, so the rest of the page is also protected).

---

## Warnings

### WR-01: No length cap on `display_name` input — unbounded string written to Supabase

**File:** `src/components/Sidebar.tsx:65-80`
**Issue:** The display name `Input` has no `maxLength` attribute and `updateDisplayName` only trims whitespace. A user can submit a name of arbitrary length, which Supabase will store (or reject with a cryptic error) against the user's `user_metadata`. There is also no sanitization guard against control characters or unusual Unicode sequences that could cause rendering glitches in the badge and sidebar.

**Fix:** Add `maxLength` to the input and a length guard in `updateDisplayName`:
```tsx
<Input
  value={editName}
  maxLength={50}
  ...
/>
```
In `authStore.ts` `updateDisplayName`:
```ts
const trimmed = name.trim().slice(0, 50)
if (!trimmed) return
```

---

### WR-02: `handleSave` in `ProfileSection` reads stale `error` from store via `getState()` race

**File:** `src/components/Sidebar.tsx:49-55`
**Issue:** `handleSave` calls `await useAuthStore.getState().updateDisplayName(editName)`, then immediately reads `useAuthStore.getState().error` to decide whether to close the dialog. This works only because `updateDisplayName` is `async` and `set({ error })` is synchronous inside it. However, if a future refactor makes `updateDisplayName` defer its final `set` (e.g., via a queued microtask or secondary await), `getState().error` will be read before the state is written and the dialog will close on failure.

More critically, the reactive subscription `authError = useAuthStore((state) => state.error)` (line 39) is used only for the error *display*, but the close-decision is made via the non-reactive `getState()` snapshot. These two reads are not guaranteed to be in sync in all timing scenarios.

**Fix:** Return the error from `updateDisplayName` directly so `handleSave` doesn't need to re-read store state:
```ts
// authStore.ts
updateDisplayName: async (name: string): Promise<string | null> => {
  ...
  if (error) {
    const { data: { user } } = await supabase.auth.getUser()
    set({ user, error: error.message })
    return error.message
  }
  return null
}

// Sidebar.tsx handleSave
async function handleSave() {
  const err = await useAuthStore.getState().updateDisplayName(editName)
  if (!err) setEditOpen(false)
}
```

---

### WR-03: `AppShell` `useEffect` dep array suppressed with `eslint-disable` — stale closure risk

**File:** `src/components/AppShell.tsx:18-22`
**Issue:** The `useEffect` that calls `fetchLists(user.id)` excludes `fetchLists` and `lists` from its dependency array, justified by "prevent refetch loop", and suppresses the exhaustive-deps lint rule with a comment. This is a known risk pattern: if `fetchLists` ever captures stale state from a closure (e.g., if it is recreated with new `userId` after account switch), the suppressed lint warning will prevent the toolchain from catching it. The current implementation is safe only because `fetchLists` is a stable Zustand-created function reference. Any future change to `listsStore` that creates a new function reference on each `getState()` call would silently break this.

**Fix:** Use `useItemsStore.getState().fetchLists` inside the effect body (the same pattern used in `ListPage.tsx` line 125) to avoid the dep-array problem entirely:
```ts
useEffect(() => {
  const { lists, fetchLists } = useListsStore.getState()
  if (user && lists.length === 0) {
    fetchLists(user.id)
  }
}, [user])
```
This removes the need for the eslint-disable comment.

---

### WR-04: Sidebar test asserts `referrerPolicy` attribute as a property, not lowercase HTML attribute

**File:** `src/components/Sidebar.test.tsx:163`
**Issue:** The test asserts `img.toHaveAttribute('referrerPolicy', 'no-referrer')`. HTML attributes are case-insensitive and the DOM normalizes `referrerpolicy` to lowercase. `toHaveAttribute` does a case-sensitive string comparison of the attribute *name*. In JSDOM this test may pass by accident (JSDOM accepts camelCase for some attributes), but it is not reliable across test environments. The `AttributionBadge.test.tsx` line 25 correctly uses lowercase `'referrerpolicy'` — the Sidebar test is inconsistent.

**Fix:**
```ts
// Sidebar.test.tsx line 163
expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
```

---

## Info

### IN-01: Duplicated `resolveDisplayName` function — ListPage and Sidebar both define it

**File:** `src/pages/ListPage.tsx:256-264` and `src/components/Sidebar.tsx:20-28`
**Issue:** `resolveDisplayName` is defined twice with nearly identical logic (only the final fallback string differs: `'Unknown'` vs `'User'`). This violates DRY and means a future change to the resolution priority (e.g., adding a new metadata key) must be applied in two places.

**Fix:** Extract to `src/lib/attribution.ts` (already the home for attribution utilities) and import it in both files. Normalize the fallback string to one value (e.g., `'You'` or `'User'`).

---

### IN-02: `onToggle` prop in `ItemRow` / `CategorySection` ignores the `id` argument it receives

**File:** `src/components/CategorySection.tsx:67` / `src/components/ItemRow.tsx:252`
**Issue:** `CategorySection` passes `onToggle={() => onToggle(item.id)}` (wrapping the `id` in a closure), and `ItemRow` calls `onToggle(item.id)` — then `ListPage.handleToggle(id)` receives the `id`. The call works correctly, but `ItemRow`'s prop is typed `onToggle: (id: string) => void` while `CategorySection.onToggle` is also `(id: string) => void` yet the lambda passed *into* `ItemRow` is `() => onToggle(item.id)` — a zero-arity function assigned to a prop expecting one argument. TypeScript accepts this (functions are contra-variant on parameters), but it creates confusion: `ItemRow` calls `onToggle(item.id)` but the `id` argument is silently dropped by the wrapper.

**Fix:** Either make `ItemRow.onToggle` zero-arity (since ItemRow knows its own item.id):
```ts
onToggle: () => void
// inside ItemRow:
onCheckedChange={() => onToggle()}
```
Or remove the wrapper in `CategorySection` and let ItemRow pass the id directly (would require `CategorySection.onToggle` to accept the id, which it already does).

---

### IN-03: `checkedItem` and `uncheckedItem` in `ListPage.test.tsx` are missing `user_id` field

**File:** `src/pages/ListPage.test.tsx:23-42`
**Issue:** The test fixture items are declared without `user_id`. The `Item` type requires `user_id: string | null`. TypeScript will not error here because the mock items are typed as plain object literals (not `Item`), but if the store ever validates item shape, or if the attribution path in `ItemRow` is exercised in future tests using these fixtures, the missing field could cause subtle `undefined` vs `null` comparison differences (since `undefined === 'user-test-id'` is `false` but for a different reason than `null === 'user-test-id'`).

**Fix:** Add `user_id: null` to both `checkedItem` and `uncheckedItem` fixtures:
```ts
const checkedItem = {
  ...
  user_id: null,
  ...
}
```

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
