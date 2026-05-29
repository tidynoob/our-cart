# Phase 9: Auth Integration into ListPage - Research

**Researched:** 2026-05-29
**Domain:** Supabase Auth user_metadata, Google OAuth identity, React avatar rendering, Zustand optimistic updates, legacy code retirement
**Confidence:** HIGH (all critical API behaviors verified from official sources or codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Display name in Supabase auth `user_metadata` via `supabase.auth.updateUser({ data: { display_name } })`. No new `profiles` table this phase.
- **D-02:** Seed display name from `user.user_metadata.full_name` (fallback `name`, then email local-part); avatar from `user.user_metadata.avatar_url` (fallback `picture`).
- **D-03:** Add `updateDisplayName(name)` to `authStore` — calls `updateUser`, updates store optimistically.
- **D-04:** Own-item attribution derived LIVE from auth display name, matched by `item.user_id === user.id`. No bulk-rewrite of `added_by`, no backfill migration.
- **D-05:** Add `user_id: string | null` to the `Item` TS type. `select('*')` already returns it.
- **D-06:** Keep writing `added_by` (display-name snapshot) on insert as fallback. Attribution resolution: (1) own item → live auth name+avatar, (2) else frozen `added_by` + initial badge, (3) null → "?" badge.
- **D-07:** Extend `AttributionBadge` with optional `avatarUrl` — rounded img + colored-initial fallback.
- **D-08:** Profile section fills `data-slot="profile-slot"` at `Sidebar.tsx:82`. Pass `user` from `AppShell` to `Sidebar`.
- **D-09:** Sign out = `authStore.signOut()`. No confirm dialog. Close drawer on sign-out. `ProtectedRoute` redirects to `/`.
- **D-10:** Retire `NamePromptDialog` + per-list `localStorage` name + `AddItemBar` disabled guard. Auth display name replaces all.
- **D-11:** Add `restoreBanner(listCode)` to `uiStore`. `ListPage` shows "show share code" affordance when banner dismissed.

### Claude's Discretion

- Exact avatar fallback chain field names — confirmed below in §Google OAuth user_metadata Shape.
- Inline-edit vs compact dialog for display-name editing in sidebar — inline recommended, phone-first.
- Icon + placement of re-expand affordance (D-11) — minimal, within existing header row.
- Whether `AddItemBar` reads display name from `authStore` directly or via prop — prop-passing matches current pattern.
- Avatar image loading/error handling — graceful fallback to initials; instant-fallback (no spinner) recommended.
- Whether to keep `added_by` write on insert — keep it (D-06 seam for Phase 10).

### Deferred Ideas (OUT OF SCOPE)

- `profiles` table for cross-user name/avatar — Phase 10.
- Bulk-rewrite/backfill of `added_by` — explicitly rejected (D-04).
- Claim legacy anonymous items — Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | User can edit their display name | `auth.updateUser({ data: { display_name } })` + optimistic store update (D-03); USER_UPDATED event fires and re-sets the store — idempotent pattern documented below |
| PROF-02 | User's Google avatar displays in sidebar and item attribution | `user_metadata.avatar_url` confirmed present for Google OAuth; `<img>` with `referrerPolicy="no-referrer"` + onError fallback to initials |
| PROF-03 | User can sign out | `authStore.signOut()` already implemented; drawer must close before redirect fires |
| NAV-03 | User can re-expand the dismissed share code header | `restoreBanner` = Set deletion in `uiStore`; `Share2` icon affordance in `ListPage` header |
</phase_requirements>

---

## Summary

Phase 9 is a medium-complexity frontend wiring phase — no new DB tables, no new migrations, no new auth infrastructure. The work is: (1) plumbing Google identity data already in `authStore.user` into the UI; (2) adding `updateDisplayName` to `authStore`; (3) retiring the v1.0 anonymous-name model; (4) two small store additions (`updateDisplayName`, `restoreBanner`).

The key behavioral question — whether optimistic + USER_UPDATED listener causes a double-update — is answered: `USER_UPDATED` fires after `updateUser` succeeds and the `onAuthStateChange` callback receives the updated `User` object. Since `authStore`'s callback performs `set({ user })`, the second write is idempotent with the optimistic write (same value). No deduplication logic is needed, but the planner should confirm the callback's `set()` call won't overwrite an already-correct optimistic value with a stale one during network lag — writing `user: session?.user ?? null` in the listener is correct (session will carry the new metadata when USER_UPDATED fires).

The critical "no-async in `onAuthStateChange`" rule (STATE.md) remains intact — `updateDisplayName` is an async action called from UI, NOT from inside the listener.

**Primary recommendation:** Wire in order — types first (D-05), store actions (D-03, D-11), badge extension (D-07), sidebar profile slot (D-08), ListPage cleanup (D-10, D-11). No migrations. No new deps.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Display name persistence | Supabase Auth (user_metadata) | authStore (client cache) | `updateUser` writes to DB auth; authStore caches for render |
| Avatar URL resolution | Client (authStore.user) | — | Google URL already in user_metadata at login, no fetch needed |
| Own-item attribution | Client (ItemRow) | — | Live match `item.user_id === user.id` — no DB query |
| Sign-out + redirect | authStore + ProtectedRoute | Sidebar (close drawer) | Auth action in store; route guard handles redirect |
| Banner dismiss/restore | uiStore (client) | ListPage (render condition) | Ephemeral UI state — in-memory Set |

---

## Standard Stack

No new packages for this phase. All capabilities covered by existing deps.

### Existing Packages This Phase Uses Heavily

| Package | Current Version | Role in Phase 9 |
|---------|----------------|-----------------|
| `@supabase/supabase-js` | 2.106.1 | `auth.updateUser({ data })`, `onAuthStateChange` USER_UPDATED |
| `zustand` | 5.0.13 | `authStore.updateDisplayName`, `uiStore.restoreBanner` |
| `lucide-react` | 1.16.0 | `Share2` icon for re-expand affordance (D-11) |
| `@base-ui/react` | 1.5.0 | No new usage — existing Dialog primitive in Sidebar unchanged |

### No Package Installs Required

This phase requires zero new `npm install` calls. The Package Legitimacy Audit is therefore empty — no external packages to audit.

---

## Package Legitimacy Audit

No packages are being installed in this phase. All required capabilities (Supabase auth, Zustand, lucide-react) are already in `package.json`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Google OAuth identity (at login)
        │
        ▼
user_metadata.avatar_url / full_name / name
        │
        ▼
authStore.user ──────────────────────────────────────────────────────┐
   ├── .user_metadata.avatar_url (or picture)                        │
   ├── .user_metadata.full_name (or name, or email local-part)       │
   └── .id  ◄──── match key                                          │
                                                                      │
                ┌─────────────────────────────┐                      │
                │         AppShell            │                      │
                │  reads authStore.user       │                      │
                │  passes user prop ──────────┼──► Sidebar           │
                └─────────────────────────────┘     └── profile-slot │
                                                         avatar+name  │
                                                         edit-name    │
                                                         sign-out ────┘
                                                              │
                                                    authStore.signOut()
                                                              │
                                                    ProtectedRoute → /

ListPage
  ├── items (from itemsStore) — each has user_id (DB DEFAULT auth.uid())
  ├── currentUser (from authStore)
  └── ItemRow per item
        ├── item.user_id === currentUser.id ?
        │     YES → AttributionBadge(name=liveDisplayName, avatarUrl=liveAvatarUrl)
        │     NO  → AttributionBadge(name=item.added_by) [frozen snapshot]
        │     NULL added_by → "?" badge
        └── display is LIVE for own items — rename reflects instantly

uiStore.dismissedBanners: Set<string>
  ├── dismissBanner(code) → add to Set
  ├── restoreBanner(code) → remove from Set [NEW]
  └── ListPage renders ShareBanner if code NOT in Set
       └── if code IN Set → show Share2 icon button → calls restoreBanner
```

### Recommended File Touch Map

```
src/
├── types/
│   └── item.ts                  # Add user_id: string | null (D-05)
├── stores/
│   ├── authStore.ts             # Add updateDisplayName action (D-03)
│   └── uiStore.ts               # Add restoreBanner action (D-11)
├── components/
│   ├── AttributionBadge.tsx     # Add avatarUrl prop + img/fallback (D-07)
│   ├── ItemRow.tsx              # Pass avatarUrl when item.user_id === user.id (D-06)
│   ├── Sidebar.tsx              # Fill profile-slot: avatar, name, edit, sign-out (D-08)
│   ├── AppShell.tsx             # Pass user prop to Sidebar (D-08)
│   └── AddItemBar.tsx           # Remove disabled logic (D-10, prop change)
├── pages/
│   └── ListPage.tsx             # Remove NamePromptDialog, localStorage name,
│                                #   AddItemBar disabled guard (D-10)
│                                #   Add re-expand affordance (D-11)
│                                #   Feed AddItemBar.addedBy from auth display name
└── components/
    └── NamePromptDialog.tsx     # DELETE file (D-10)
```

### Pattern 1: `updateDisplayName` in authStore

**What:** Async Zustand action that calls `supabase.auth.updateUser` then optimistically updates the store.
**When to use:** User saves a new display name in the profile slot.

```typescript
// Source: authStore.ts pattern + Supabase auth.updateUser docs
// [CITED: https://supabase.com/docs/reference/javascript/auth-updateuser]
updateDisplayName: async (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return

  // Optimistic: update the store immediately so UI reflects change
  // USER_UPDATED will fire onAuthStateChange which repeats set({ user })
  // — idempotent because the listener sets the same value the server confirmed
  set((state) => ({
    user: state.user
      ? { ...state.user, user_metadata: { ...state.user.user_metadata, display_name: trimmed } }
      : null,
  }))

  const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } })
  if (error) {
    // On failure: rollback by re-fetching current user from session
    const { data: { user } } = await supabase.auth.getUser()
    set({ user, error: error.message })
  }
},
```

**Double-update analysis:** [VERIFIED: official Supabase auth-js source + community reports]
- `updateUser` fires `USER_UPDATED` in `onAuthStateChange` after server confirms.
- The existing listener (`set({ user: session?.user ?? null })`) will run again with the updated user.
- Since the USER_UPDATED session carries the **same** `display_name` the optimistic write applied, the second `set()` is a no-op render-wise (Zustand equality check on the `user` reference will cause re-render, but data is correct).
- **Risk:** `USER_UPDATED` event fires **across all open tabs** — other tabs get the updated user correctly via the listener with no extra code.
- **Do NOT** call `updateDisplayName` from inside `onAuthStateChange` callback — this would create an infinite loop. [CITED: https://github.com/supabase/auth-js/issues/275]

### Pattern 2: Attribution resolution in ItemRow

**What:** Derive own-item attribution from live auth state instead of frozen `added_by`. [ASSUMED: item.user_id arrives via select('*') — confirmed by codebase inspection below]
**When to use:** Any item render where `item.user_id` is non-null.

```typescript
// Source: ItemRow.tsx display section, to be updated
// item.user_id column confirmed present in DB (items_auth.sql) and returned by select('*')
// Item type needs user_id: string | null added (D-05)

// In ItemRow props: add currentUserId + currentUserName + currentUserAvatar
// OR: read authStore directly inside ItemRow (either approach is valid per D-08 discretion)

const isOwnItem = item.user_id !== null && item.user_id === currentUserId

{isOwnItem ? (
  <AttributionBadge
    name={currentUserDisplayName}
    avatarUrl={currentUserAvatarUrl}
  />
) : item.added_by ? (
  <AttributionBadge name={item.added_by} />
) : (
  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
    aria-label="Unknown person added this">?</div>
)}
```

### Pattern 3: AttributionBadge with avatar

**What:** Optional `avatarUrl` prop — renders `<img>` with `onError` fallback to initials badge.

```typescript
// Source: patterns from React img onError docs + Google referrer policy requirement
// [CITED: https://github.com/chakra-ui/chakra-ui/issues/5909] — referrerPolicy="no-referrer"
interface AttributionBadgeProps {
  name: string
  avatarUrl?: string  // NEW: optional Google avatar URL
  className?: string
}

export function AttributionBadge({ name, avatarUrl, className }: AttributionBadgeProps) {
  const [imgError, setImgError] = useState(false)
  const color = getAttributionColor(name)
  const showImg = avatarUrl && !imgError

  return (
    <div
      className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden', className)}
      style={!showImg ? { backgroundColor: color.bg, color: color.text } : undefined}
      aria-label={`${name} added this`}
    >
      {showImg ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover rounded-full"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}
```

**Key:** `referrerPolicy="no-referrer"` is REQUIRED on Google avatar `<img>` tags. Googleusercontent.com returns 403 when the default `origin` referrer policy is sent. [CITED: https://github.com/chakra-ui/chakra-ui/issues/5909] [ASSUMED - exact 403 behavior, but referrer-policy issue is widely confirmed across multiple sources]

### Pattern 4: `restoreBanner` in uiStore

**What:** Inverse of `dismissBanner` — removes a code from the `dismissedBanners` Set.

```typescript
// Source: uiStore.ts existing pattern
restoreBanner: (listCode: string) =>
  set((state) => {
    const next = new Set(state.dismissedBanners)
    next.delete(listCode)
    return { dismissedBanners: next }
  }),
```

**Note:** `new Set(state.dismissedBanners)` is required — Zustand requires a new Set reference to trigger reactivity. The existing `dismissBanner` uses `new Set([...state.dismissedBanners, listCode])` which also creates a new reference. The pattern is consistent.

### Pattern 5: Inline display-name edit in Sidebar (mirror of ListPage rename)

ListPage.tsx lines 314-333 shows the canonical inline-rename pattern used for list names. Profile section reuses this exact pattern:
- Local `useState` for edit open/name value
- Input + Save/Cancel buttons
- On Save: call `authStore.updateDisplayName(newName)`, exit edit mode
- On Cancel: discard, exit edit mode
- Pencil icon opens edit mode (same `Pencil` icon from lucide-react)

### Anti-Patterns to Avoid

- **Calling `updateDisplayName` inside `onAuthStateChange`:** Creates infinite loop of USER_UPDATED + SIGNED_IN events. Only call from UI event handlers (button click). [CITED: https://github.com/supabase/auth-js/issues/275]
- **`onAuthStateChange` callback as async function:** Locked project decision (STATE.md). The existing callback is already sync — keep it that way when extending it.
- **Rewriting `added_by` on all items when display name changes:** Explicitly rejected (D-04). Live attribution derivation is the design.
- **Setting `imgError` state from null/undefined `avatarUrl`:** `onError` never fires for empty src. Guard with `avatarUrl && !imgError` before rendering the img.
- **Deleting from the existing `dismissedBanners` Set mutably:** Zustand requires a new Set reference. Always `new Set(state.dismissedBanners)` then `.delete()` then return new set.
- **Passing `user` as prop through multiple intermediate components:** `AppShell` → `Sidebar` is one hop — fine. Don't thread it deeper. `ItemRow` should read `authStore` directly or receive current-user props from `ListPage` (one-hop OK).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User metadata storage | Custom `profiles` table (this phase) | `supabase.auth.updateUser({ data })` | Already in auth service; free; Phase 10 adds profiles when cross-user read is needed |
| Display name persistence | localStorage + onboarding flow | auth user_metadata | v2.0 identity model; localStorage is being retired (D-10) |
| Avatar loading with fallback | Complex image loading library | Plain `<img>` + `useState(false)` for error + `onError` | 10 lines total; no dep needed |
| Token refresh after metadata update | Manual `supabase.auth.refreshSession()` | `onAuthStateChange` USER_UPDATED event | Supabase emits USER_UPDATED with fresh user object after `updateUser` succeeds; the existing listener handles it |

**Key insight:** `user_metadata` is directly readable from `authStore.user` without any extra fetch — the Google identity data is baked in at OAuth login and the USER_UPDATED event keeps it fresh after edits. Zero extra Supabase calls for display.

---

## Common Pitfalls

### Pitfall 1: Google avatar 403 — missing `referrerPolicy="no-referrer"`
**What goes wrong:** `<img src={avatarUrl}>` on Google avatar URL returns 403 in some browsers, showing a broken image.
**Why it happens:** Googleusercontent.com blocks requests with a non-empty Referer header from non-Google origins. The browser's default referrer policy sends the page origin.
**How to avoid:** Add `referrerPolicy="no-referrer"` to every Google avatar `<img>` tag.
**Warning signs:** Avatar appears broken in Chrome but not in incognito (cached without header).
[CITED: https://github.com/chakra-ui/chakra-ui/issues/5909]

### Pitfall 2: `onError` not firing for empty `avatarUrl`
**What goes wrong:** `<img src={undefined}>` or `<img src="">` — `onError` never fires, the broken-image indicator shows, fallback initials never appear.
**Why it happens:** Browser doesn't treat empty/null src as a load error.
**How to avoid:** Gate `<img>` render with `avatarUrl && !imgError`. Always have the initials path as default.
[ASSUMED: standard React img behavior, widely documented]

### Pitfall 3: Calling `updateDisplayName` (or any `supabase.auth.*`) inside `onAuthStateChange`
**What goes wrong:** Infinite loop of USER_UPDATED + SIGNED_IN events, especially with multiple tabs open. Crashes the app.
**Why it happens:** `updateUser` triggers USER_UPDATED, which fires the callback, which calls `updateUser` again…
**How to avoid:** Only call `updateDisplayName` from UI event handlers (button click, form submit). Never from inside the auth state listener.
[CITED: https://github.com/supabase/auth-js/issues/275]

### Pitfall 4: `user_metadata.display_name` absent on first session (before D-03 ever runs)
**What goes wrong:** User signs in with Google for the first time — `user_metadata` has `full_name` and `avatar_url` from Google but no `display_name` key. Code reading `user.user_metadata.display_name` returns `undefined`.
**Why it happens:** `display_name` is only written by `updateUser` (D-03). It's not present until the user saves an edit or the app seeds it on first use.
**How to avoid:** Display name resolution must always fall back: `user_metadata.display_name ?? user_metadata.full_name ?? user_metadata.name ?? email.split('@')[0]`. The sidebar profile view should seed the input with this fallback. When writing `added_by` on insert, use the same fallback chain.

### Pitfall 5: Set mutation causes no reactivity in Zustand
**What goes wrong:** `state.dismissedBanners.delete(listCode); return { dismissedBanners: state.dismissedBanners }` — banner doesn't re-appear because Zustand sees the same Set reference.
**Why it happens:** Zustand uses shallow equality; mutating in place = same reference = no re-render.
**How to avoid:** `const next = new Set(state.dismissedBanners); next.delete(listCode); return { dismissedBanners: next }`.

### Pitfall 6: `user_metadata.avatar_url` vs `user_metadata.picture` — both exist in different contexts
**What goes wrong:** Code reads only `avatar_url` — `picture` is also set by Google OAuth and available in `identities[0].identity_data`. If the top-level `user_metadata` avatar_url is somehow absent, `picture` is the fallback.
**Why it happens:** Supabase copies Google's `picture` field into `user_metadata.avatar_url` at OAuth time, but both fields exist in `identities[0].identity_data`.
**How to avoid:** Fallback chain: `user.user_metadata.avatar_url ?? user.user_metadata.picture ?? null`. In practice `avatar_url` is reliably present for Google OAuth.
[CITED: https://github.com/orgs/supabase/discussions/4047]

### Pitfall 7: `NamePromptDialog` test still references component after deletion
**What goes wrong:** `src/components/NamePromptDialog.test.tsx` imports the deleted component — CI breaks.
**Why it happens:** Test file not removed alongside component.
**How to avoid:** When deleting `NamePromptDialog.tsx`, delete `NamePromptDialog.test.tsx` in the same commit.

### Pitfall 8: `AddItemBar.addedBy` receives empty string after D-10
**What goes wrong:** `addedBy` was `userName || ''` before — the `|| ''` guard passed an empty string. After D-10, the auth display name fallback chain (Pitfall 4) must be used consistently — never `undefined` or `''`.
**Why it happens:** `itemsStore.addItem` writes `added_by: addedBy || null` — empty string becomes `null` in DB, breaking legacy fallback attribution.
**How to avoid:** Always resolve the display name to a non-empty string before passing to `AddItemBar`. `authDisplayName` should be a derived const: `user_metadata.display_name ?? user_metadata.full_name ?? user_metadata.name ?? user.email.split('@')[0] ?? 'Unknown'`.

---

## Code Examples

### 1. Google `user_metadata` shape (confirmed Google OAuth)

```typescript
// Source: https://github.com/orgs/supabase/discussions/4047 [CITED]
// Fields reliably present after Google OAuth in user.user_metadata:
{
  avatar_url: "https://lh3.googleusercontent.com/...",  // Google photo
  full_name: "Mitchell Griffin",                          // Display name from Google
  email: "mitchellgriffin9@gmail.com",                   // NOT always here; check user.email
  // picture: same URL — in identities[0].identity_data, may also appear at top level
  // name: same as full_name — in identities[0].identity_data
}

// Robust display name resolver:
function resolveDisplayName(user: User): string {
  return (
    user.user_metadata?.display_name ??   // User-edited (D-03)
    user.user_metadata?.full_name ??       // Google-provided
    user.user_metadata?.name ??            // Google alt field
    user.email?.split('@')[0] ??           // Email local-part
    'User'
  )
}

// Avatar URL resolver:
function resolveAvatarUrl(user: User): string | null {
  return user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null
}
```

### 2. `authStore.updateDisplayName` action

```typescript
// Source: Supabase auth.updateUser docs + existing authStore.ts pattern
// [CITED: https://supabase.com/docs/reference/javascript/auth-updateuser]
updateDisplayName: async (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return

  // Optimistic update — USER_UPDATED will fire and repeat this set idempotently
  set((state) => ({
    user: state.user
      ? {
          ...state.user,
          user_metadata: { ...state.user.user_metadata, display_name: trimmed },
        }
      : null,
    error: null,
  }))

  const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } })
  if (error) {
    // Rollback: re-fetch from server
    const { data: { user } } = await supabase.auth.getUser()
    set({ user, error: error.message })
  }
},
```

### 3. `uiStore.restoreBanner`

```typescript
// Source: uiStore.ts existing dismissBanner pattern [VERIFIED: codebase]
restoreBanner: (listCode: string) =>
  set((state) => {
    const next = new Set(state.dismissedBanners)
    next.delete(listCode)
    return { dismissedBanners: next }
  }),
```

### 4. Re-expand affordance in ListPage header

```typescript
// Source: ListPage.tsx header pattern + ShareBanner.tsx [VERIFIED: codebase]
// Placed in the header row, after SyncStatus or co-located with title area
// Icon: Share2 from lucide-react (already a dep)
import { Share2 } from 'lucide-react'

// In header JSX, next to SyncStatus:
{dismissedBanners.has(list.share_code) && (
  <Button
    variant="ghost"
    size="icon"
    aria-label="Show share code"
    onClick={() => restoreBanner(list.share_code)}
    className="h-8 w-8 shrink-0"
  >
    <Share2 className="h-4 w-4" />
  </Button>
)}
```

### 5. Supabase `auth.updateUser` — shallow merge semantics

```typescript
// Source: DeepWiki/supabase-auth metadata docs [CITED]
// Shallow merge: updates only keys mentioned; preserves all other keys.
// Setting a key to null REMOVES it.
// Example:
// Existing: { full_name: "Mitchell", avatar_url: "https://..." }
// Update:   { data: { display_name: "Mitch" } }
// Result:   { full_name: "Mitchell", avatar_url: "https://...", display_name: "Mitch" }
// Google-provided keys (full_name, avatar_url) are NOT overwritten by updateUser.
await supabase.auth.updateUser({ data: { display_name: 'Mitch' } })
```

### 6. Confirming `item.user_id` in `select('*')` return

```typescript
// Source: items_auth.sql [VERIFIED: codebase] — column exists on items table
// Source: itemsStore.ts fetchItems [VERIFIED: codebase] — uses select('*')
// Conclusion: user_id is in every item returned by fetchItems.
// Only action needed: add `user_id: string | null` to Item type (src/types/item.ts).
// No fetchItems query change required.
```

### 7. Sign-out with drawer close

```typescript
// Source: Sidebar.tsx [VERIFIED: codebase] — onOpenChange prop controls drawer
// Source: authStore.ts signOut() [VERIFIED: codebase]
// Sidebar receives onOpenChange from AppShell.
// The sign-out handler in the profile section:
async function handleSignOut() {
  onOpenChange(false)         // Close drawer immediately (UX: don't show drawer over login)
  await authStore.signOut()   // signOut sets user: null → ProtectedRoute redirects to /
}
// Note: because signOut is async and ProtectedRoute watches authStore.user,
// closing drawer first prevents a frame where drawer is visible over the login screen.
```

---

## Retiring NamePromptDialog (D-10) — Exact Callsites

From codebase inspection [VERIFIED: codebase]:

**`src/pages/ListPage.tsx`:**
- Line 13: `import { NamePromptDialog } from '@/components/NamePromptDialog'`
- Line 45: `const [userName, setUserName] = useState<string | null>(null)`
- Lines 128-131: `const savedUserName = localStorage.getItem('our-cart-name-${list.id}'); if (savedUserName) { setUserName(savedUserName) }`
- Lines 293-298: `{userName === null && (<NamePromptDialog open={true} listId={list.id} onNameSaved={(name) => setUserName(name)} />)}`
- Lines 368-372: `<AddItemBar listId={list.id} addedBy={userName || ''} disabled={userName === null} />`

**Replacement (post D-10):**
- Remove: `userName` state, localStorage read, `NamePromptDialog` render, import
- Replace: `addedBy={resolveDisplayName(user!)}` — user is always non-null on a ProtectedRoute page
- Remove: `disabled={userName === null}` — AddItemBar is always enabled for authenticated users

**Files to delete:**
- `src/components/NamePromptDialog.tsx`
- `src/components/NamePromptDialog.test.tsx`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage per-list name prompt | Auth `user_metadata.display_name` | Phase 9 (this phase) | `NamePromptDialog` retired; no more anonymous items |
| One-way banner dismiss | Two-way dismiss/restore via `uiStore` | Phase 9 (this phase) | NAV-03 satisfied without page refresh |
| Frozen `added_by` for attribution | Live auth name for own items (matched by `user_id`) | Phase 9 (this phase) | Name edits propagate instantly |

**Deprecated/outdated after this phase:**
- `NamePromptDialog`: REMOVED — replaced by auth identity
- `localStorage.getItem('our-cart-name-${listId}')`: REMOVED — no longer written or read
- `AddItemBar disabled={userName === null}` guard: REMOVED — auth always provides a name

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google avatar 403 with default referrer policy — `referrerPolicy="no-referrer"` required | Pitfall 1, Code Examples §3 | If not required, just a harmless extra attribute; no functional risk |
| A2 | `item.user_id` returned by existing `select('*')` without query change | Architecture Patterns §2 | Confirmed by codebase inspection of `items_auth.sql` (column exists) and `itemsStore.ts` (`select('*')`); risk is effectively nil |
| A3 | USER_UPDATED event does NOT require `realtime.setAuth` refresh | Security Domain | If user_metadata is embedded in JWT claims, a stale JWT after `updateUser` could cause Realtime permission issues — but items RLS policies use `auth.uid()` not `user_metadata`, so this is safe; items channel auth is by identity, not metadata |

**If this table is empty:** All claims were verified — see Source annotations inline.

---

## Open Questions

1. **Should `ItemRow` read `authStore` directly or receive current-user data as props?**
   - What we know: Both patterns work. Direct store read avoids prop-drilling. Prop-passing keeps `ItemRow` pure/testable.
   - What's unclear: The CONTEXT.md discretion area doesn't lock this.
   - Recommendation: Pass props from `ListPage` — `currentUserId`, `currentUserDisplayName`, `currentUserAvatarUrl`. Keeps `ItemRow` store-independent and test-friendly (existing `ItemRow.test.tsx` mocks no stores).

2. **Display-name edit — inline in sidebar vs compact dialog?**
   - What we know: D-08 recommends inline (mirrors list rename pattern). Sidebar `profile-slot` is `p-4` with `border-t` — limited vertical space on small screens.
   - What's unclear: Whether a slide-out or compact `@base-ui/react` Dialog is better on 375px screens.
   - Recommendation: Inline, same as list rename. The slot is at the bottom of the drawer; vertical expansion is fine (nav scrolls).

3. **Does `updateDisplayName` need error feedback in the sidebar UI?**
   - What we know: `authStore.error` exists. `signInWithGoogle` and `signOut` don't surface errors in the current sidebar (they don't exist in the sidebar yet).
   - Recommendation: Show inline error text below the save button on failure. Don't use a toast — no toast infrastructure. Same pattern as `AddItemBar` error display is not present; keep it minimal.

---

## Environment Availability

Step 2.6: SKIPPED — no new external tools, services, CLIs, or runtimes. Phase is code-only changes to existing frontend files. Supabase project is already configured from Phase 6.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.3 + React Testing Library 16.3.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/stores/authStore.test.ts src/stores/uiStore.test.ts src/components/AttributionBadge.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | `updateDisplayName` action updates store optimistically | unit | `npx vitest run src/stores/authStore.test.ts` | ✅ — add cases |
| PROF-01 | `updateDisplayName` calls `supabase.auth.updateUser` with trimmed name | unit | `npx vitest run src/stores/authStore.test.ts` | ✅ — add cases |
| PROF-01 | Display name edit UI: save+cancel flow in Sidebar profile section | component | `npx vitest run src/components/Sidebar.test.tsx` | ✅ — add cases |
| PROF-02 | `AttributionBadge` renders `<img>` when `avatarUrl` prop present | unit | `npx vitest run src/components/AttributionBadge.test.tsx` | ❌ Wave 0 (file doesn't exist yet) |
| PROF-02 | `AttributionBadge` falls back to initials when img errors | unit | `npx vitest run src/components/AttributionBadge.test.tsx` | ❌ Wave 0 |
| PROF-02 | `ItemRow` shows live display name for own items (user_id match) | unit | `npx vitest run src/components/ItemRow.test.tsx` | ✅ — add cases |
| PROF-03 | Sign out calls `authStore.signOut()` and closes drawer | component | `npx vitest run src/components/Sidebar.test.tsx` | ✅ — add cases |
| NAV-03 | `restoreBanner` removes code from `dismissedBanners` Set | unit | `npx vitest run src/stores/uiStore.test.ts` | ❌ Wave 0 (uiStore has no test file yet) |
| NAV-03 | Share2 button visible when banner dismissed; calls restoreBanner | component | `npx vitest run src/pages/ListPage.test.tsx` | ✅ — add cases |
| D-10 | `ListPage` does not render `NamePromptDialog` when user is authenticated | component | `npx vitest run src/pages/ListPage.test.tsx` | ✅ — update/remove existing NamePromptDialog tests |
| D-10 | `AddItemBar` never disabled when auth user is present | component | `npx vitest run src/components/AddItemBar.test.tsx` | ✅ — update cases |

### Sampling Rate
- **Per task commit:** `npx vitest run src/stores/authStore.test.ts src/stores/uiStore.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/AttributionBadge.test.tsx` — covers PROF-02 avatar render + error fallback
- [ ] `src/stores/uiStore.test.ts` — covers NAV-03 `restoreBanner` + existing `dismissBanner`

*(Existing files `authStore.test.ts`, `Sidebar.test.tsx`, `ItemRow.test.tsx`, `ListPage.test.tsx`, `AddItemBar.test.tsx` need new test cases but not new files.)*

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (sign-out) | `supabase.auth.signOut()` — already implemented and tested in Phase 6 |
| V3 Session Management | yes (USER_UPDATED / token) | Supabase session management; `onAuthStateChange` handles token; no manual JWT handling needed |
| V4 Access Control | partial | Items RLS (`user_id = auth.uid()`) unchanged; no new DB policies this phase |
| V5 Input Validation | yes | `display_name` must be trimmed + non-empty before `updateUser`. Validate before calling. |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via display_name reflected in badge | Tampering | React JSX escapes by default; no `dangerouslySetInnerHTML` |
| Open redirect on sign-out | Elevation of Privilege | `ProtectedRoute` redirects to `/` (internal only); no redirect URL from user input |
| Stale JWT after `updateUser` | Spoofing | USER_UPDATED fires with new session; existing `realtime.setAuth` call in listener handles it. Items RLS uses `auth.uid()` not metadata — unaffected by metadata staleness |
| Prototype pollution via `user_metadata` spread | Tampering | Spread `{ ...user.user_metadata, display_name: trimmed }` — server-controlled object; no user-controlled keys injected |

### Security Note on user_metadata

`user_metadata` is writable by the authenticated user (not admin-only). This is appropriate for display_name (user owns it). It is NOT appropriate for storing anything that grants permissions (e.g., `is_admin`). This phase only stores a cosmetic display name — no security concern.
[CITED: https://supabase.com/docs/guides/auth/managing-user-data]

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/items_auth.sql` — [VERIFIED: codebase] `items.user_id uuid DEFAULT auth.uid()`; SELECT policy `user_id IS NULL OR auth.uid() = user_id`
- `src/stores/authStore.ts` — [VERIFIED: codebase] existing `initialize`, `signOut`, `onAuthStateChange` pattern; shape of `user`/`session`
- `src/stores/uiStore.ts` — [VERIFIED: codebase] `dismissedBanners` Set + `dismissBanner` pattern for `restoreBanner` mirror
- `src/components/Sidebar.tsx` — [VERIFIED: codebase] `data-slot="profile-slot"` at line 82; prop-driven `lists` pattern
- `src/components/AppShell.tsx` — [VERIFIED: codebase] already reads `authStore.user`; passes `lists` to Sidebar
- `src/types/item.ts` — [VERIFIED: codebase] missing `user_id` field confirmed
- `src/pages/ListPage.tsx` — [VERIFIED: codebase] exact lines for `NamePromptDialog`, `localStorage`, `AddItemBar` disabled guard
- `src/components/NamePromptDialog.tsx` and `NamePromptDialog.test.tsx` — [VERIFIED: codebase] file exists, must be deleted
- Supabase auth.updateUser: `USER_UPDATED` event fires; shallow merge semantics [CITED: https://supabase.com/docs/reference/javascript/auth-updateuser]
- Supabase onAuthStateChange events: INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, USER_UPDATED, TOKEN_REFRESHED [CITED: https://supabase.com/docs/reference/javascript/auth-onauthstatechange]

### Secondary (MEDIUM confidence)
- Google OAuth `user_metadata` fields (`avatar_url`, `full_name`, `name`, `picture`) [CITED: https://github.com/orgs/supabase/discussions/4047]
- Google avatar referrer policy requirement [CITED: https://github.com/chakra-ui/chakra-ui/issues/5909] — multiple sources agree
- `updateUser` shallow merge behavior [CITED: https://deepwiki.com/supabase/auth/8.2-user-metadata]

### Tertiary (LOW confidence)
- Infinite loop risk when calling `updateUser` inside `onAuthStateChange` [CITED: https://github.com/supabase/auth-js/issues/275] — elevated to MEDIUM as official issue tracker

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing deps verified
- Architecture: HIGH — all integration points confirmed by codebase inspection
- Supabase auth.updateUser + USER_UPDATED: MEDIUM — API docs cited; double-update analysis is reasoned from confirmed event semantics
- Google user_metadata shape: MEDIUM — cited from official Supabase community discussion, consistent across multiple sources
- Google avatar referrer policy: MEDIUM — cited from multiple UI library issues, consistent finding
- Pitfalls: HIGH — most derived from direct codebase inspection

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (Supabase auth API is stable; 30-day window)
