# Phase 10: List Sharing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 10-List Sharing
**Mode:** `--auto` (recommended option auto-selected for every area)
**Areas discussed:** Membership model, Redemption route + join mechanism, Stable-link idempotency, Shared lists in sidebar, Cross-user attribution (profiles) scope

---

## Membership model — access primitive

| Option | Description | Selected |
|--------|-------------|----------|
| `list_members` join table | Composite-PK (list_id,user_id) table; access = owner OR member via RLS; idempotency free | ✓ |
| `partner_id` column on lists | Single extra FK on `lists`; cheapest but caps at 2 and no idempotency primitive | |

**Auto-selected:** `list_members` join table + owner-OR-member RLS (recommended).
**Notes:** items SELECT widens from own-items-only to "items in accessible lists" (join via `items.list_id`) — the keystone change that makes partner items visible/mutable. Must avoid `list_members` RLS self-recursion (SECURITY DEFINER helper or non-recursive EXISTS).

---

## Redemption route + join mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `/invite/:code` + SECURITY DEFINER `redeem_invite` RPC | Privileged join hop (pre-join the partner can't SELECT the list under RLS), then redirect to `/list/:code` | ✓ |
| Join logic inside `/list/:code` | Detect non-member on ListPage load and join inline | |

**Auto-selected:** Dedicated `/invite/:code` route + `redeem_invite` RPC (recommended).
**Notes:** ProtectedRoute's existing `returnTo` plumbing carries the invite path through OAuth — no new redirect logic. ShareBanner link repointed `/list/` → `/invite/` (one line).

---

## Stable-link idempotency (success criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Composite PK + ON CONFLICT DO NOTHING | Two-layer dedup; share_code fixed at list creation | ✓ |
| App-side "already member?" check before insert | Race-prone, redundant given PK | |

**Auto-selected:** Composite PK + ON CONFLICT DO NOTHING (recommended).
**Notes:** `share_code` (nanoid(8)) is minted once in `listsStore.createList` — link never changes.

---

## Shared lists in sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| `fetchLists` relies on RLS (owned + member) | Drop `.eq('owner_id')` filter; membership-aware RLS returns all accessible lists | ✓ |
| Explicit `.or(owner, member)` query | Manual union; only if RLS reliance proves insufficient | |

**Auto-selected:** RLS reliance — `fetchLists` returns owned + member lists (recommended).
**Notes:** Redeemed list appears in partner's sidebar automatically.

---

## Cross-user attribution (profiles) scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer profiles; use existing `added_by` fallback | Partner items render via Phase 9 D-06 (frozen name + colored initials); keeps phase tight | ✓ |
| Add `profiles` table now | Live cross-user name/avatar sync; not required by success criteria; +scope/+table | |

**Auto-selected:** Defer profiles, rely on `added_by` fallback (recommended).
**Notes:** Overrides Phase 9 D-01's "profiles lands with Phase 10" — success criteria don't need it and the fallback covers display. Flagged as immediate fast-follow.

---

## Claude's Discretion
- Non-recursive membership-check shape (SECURITY DEFINER `is_list_member()` vs inline EXISTS).
- `redeem_invite` return value (share_code vs list id) for post-join redirect.
- `/invite/:code` joining UX (spinner) + invalid-invite copy.
- Owner written as a `list_members` row at creation vs owner-only via `owner_id`.
- `fetchLists` pure-RLS vs explicit `.or` query.
- Realtime verification for members (RLS-gated broadcast via setAuth).

## Deferred Ideas
- `profiles` table for live cross-user name/avatar (immediate fast-follow).
- Membership management: leave, remove member, revoke/rotate invite, expiry, >2 members, roles.
- Non-link invites (email/SMS).
- Claim legacy anonymous (`owner_id IS NULL`) lists/items.
