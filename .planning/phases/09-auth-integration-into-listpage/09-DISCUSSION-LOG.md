# Phase 9: Auth Integration into ListPage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 9-Auth Integration into ListPage
**Mode:** `--auto` — Claude auto-selected the recommended (first) option for every gray area; no interactive prompts.
**Areas discussed:** Display-name & avatar source, Rename→existing-attribution propagation, Avatar in attribution badges, Profile UI + sign-out, Re-expand dismissed share header

---

## Display-name & avatar source (PROF-01 / PROF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase auth `user_metadata` (no new table) | Store editable display name in `user_metadata`; avatar from Google metadata. Readable for current user from `authStore`. | ✓ |
| New `profiles` table now | Dedicated table (id→display_name, avatar_url), cross-user readable. | |

**Auto-selected:** Supabase auth `user_metadata` (recommended default).
**Notes:** Phase 9 attribution scope = current user's own items (RLS hides partner items until Phase 10). Cross-user `profiles` table deferred to Phase 10 where it's actually needed. Keeps phase at $0 / zero new tables.

---

## Rename → existing-attribution propagation (PROF-01, success criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Live derivation by `user_id` match | Own-item attribution reads live from auth display name; no DB writes on rename. | ✓ |
| Bulk-rewrite `added_by` on rename | UPDATE all the user's item rows to the new name. | |
| Backfill migration | One-time migration to populate names. | |

**Auto-selected:** Live derivation (recommended default).
**Notes:** Editing display name updates ALL existing attributions instantly, zero DB churn. Add `user_id` to the `Item` type (column already exists, `DEFAULT auth.uid()`).

---

## Avatar in attribution badges (PROF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `AttributionBadge` with optional avatar img + initials fallback | Rounded Google avatar at same footprint; falls back to colored-initial badge. | ✓ |
| Replace initials badge entirely with avatar | Drop the deterministic-color badge. | |

**Auto-selected:** Extend with fallback (recommended default).
**Notes:** Colored-initial path (`src/lib/attribution.ts`) stays as fallback for legacy/null/failed-image cases.

---

## Profile UI + sign-out (PROF-01 / PROF-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Fill Sidebar profile slot; inline name edit; sign-out button, no confirm | Avatar+name+pencil-inline-edit+Sign out in the Phase-8 slot. | ✓ |
| Separate profile page/route | Dedicated `/profile` route. | |
| Sign-out with confirmation dialog | Extra confirm step. | |

**Auto-selected:** Sidebar profile slot, inline edit, no sign-out confirm (recommended default).
**Notes:** Slot pre-built at `Sidebar.tsx:82`. `signOut()` already exists; `ProtectedRoute` handles redirect to `/`. Retire `NamePromptDialog` + per-list localStorage name (auth identity replaces it).

---

## Re-expand dismissed share header (NAV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| `restoreBanner` action + "Show share code" header affordance | Inverse of `dismissBanner`; small icon button brings banner back, no refresh. | ✓ |
| Re-show banner on every visit | Ignore dismissal persistence. | |

**Auto-selected:** `restoreBanner` + header affordance (recommended default).
**Notes:** Affordance visible only while banner is dismissed. Reuses the existing `ShareBanner`, not a second share UI.

---

## Claude's Discretion

- Avatar/name metadata field fallback chain (`avatar_url`/`picture`, `full_name`/`name`/email).
- Inline-edit vs compact dialog for sidebar name editing (inline recommended).
- Exact icon + placement of the "show share code" re-expand affordance.
- `AddItemBar.addedBy` via prop vs direct `authStore` read.
- Avatar image load/error handling (graceful fallback to initials).

## Deferred Ideas

- `profiles` table for cross-user name/avatar → Phase 10 (List Sharing).
- Bulk-rewrite/backfill of `added_by` → rejected; live derivation makes it unnecessary.
- Claim legacy anonymous (`user_id = NULL`) items into a user's identity → related to Phase 7 deferred "claim legacy lists"; not needed for Phase 9.
