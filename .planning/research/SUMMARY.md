# Project Research Summary

**Project:** Our Cart — v2.0 Accounts & Multi-List
**Domain:** Authenticated real-time shared grocery list (React SPA + Supabase)
**Researched:** 2026-05-27
**Confidence:** HIGH

## Executive Summary

v2.0 adds Google OAuth + multi-list + sharing to a working anonymous app using zero new npm packages — all capabilities come from `@supabase/supabase-js` already installed. Build order strictly follows dependency graph: Auth → Lists Infrastructure → Sidebar Shell → ListPage Auth Wiring → Sharing. Most dangerous risks: enabling RLS without policies in same migration (silent data lockout) and Google OAuth redirect URL misconfiguration across 3 environments.

## Key Findings

### Stack Additions

- Zero new npm packages — `@supabase/supabase-js` covers auth
- `shadcn/ui Sheet` (CLI install) — mobile sidebar drawer
- `shadcn/ui Avatar` (CLI install) — profile photos
- New Zustand `authStore` + `listsStore` — no new packages
- Auth state: hybrid `AuthProvider` (React Context) + `authStore` (Zustand)

### Feature Table Stakes

- Google OAuth sign-in with persistent session
- Sidebar with all user lists + active highlight
- Create, rename, delete lists (delete with confirmation)
- Share list via invite link (nanoid token, persistent)
- Editable display name (replaces per-list NamePromptDialog)
- RLS on all tables enforcing ownership/membership
- In-list share button in header

### Architecture

- `AuthProvider` (React Context) + `authStore` (Zustand) hybrid pattern
- `ProtectedRoute` wrapper redirects unauthenticated users to `/login`
- `AppShell` layout with `Sheet`-based sidebar (side="left")
- New tables: `profiles` (trigger-created), `list_members` (join), `list_invites` (nanoid tokens)
- Modified: `lists` (add `owner_id`), `items` (add `user_id` nullable)
- `SECURITY DEFINER` function for invite token lookup (avoids RLS catch-22)
- `onAuthStateChange` wires to `realtime.setAuth()` for channel auth

### Critical Pitfalls

1. **RLS without policies** — enable + create policies in same migration or all data invisible
2. **v1.0 data has no user_id** — make nullable, policy allows `user_id IS NULL OR user_id = auth.uid()`
3. **OAuth redirect URL matrix** — 3 places must match: Supabase Site URL, Supabase redirect allowlist, Google Cloud Console
4. **Auth state flash** — `isLoading` guard required; `onAuthStateChange` callback must NOT be async
5. **Realtime needs explicit setAuth()** — JWT cached at channel-open; call `realtime.setAuth()` on auth change
6. **Missing WITH CHECK** — INSERT/UPDATE policies need both `USING` and `WITH CHECK`
7. **Bare auth.uid()** — use `(select auth.uid())` for query planner caching

### Anti-Features (confirmed out of scope)

Email/password auth, granular RBAC, public lists, activity feed, push notifications, >2 members per list, offline writes, list folders, email invitation sending, barcode scanning, recipe integration.

## Suggested Phases

### Phase 1: Auth Foundation
Google OAuth, persistent session, AuthProvider + authStore, ProtectedRoute, LoginPage, AuthCallbackPage, profiles table + trigger, drop anon RLS, write authenticated RLS policies.

### Phase 2: Lists Infrastructure
`lists.owner_id` column, `list_members` table, `listsStore` Zustand store, list CRUD (create/rename/delete), updated route structure.

### Phase 3: App Shell & Sidebar
shadcn Sheet drawer, ListNav, UserProfileSection, AppShell layout wrapper, route wrapping with Outlet. Install: `npx shadcn@latest add sheet avatar`.

### Phase 4: Auth Integration into ListPage
Remove NamePromptDialog, wire `addedBy` to authStore.displayName, ProfileEditDialog for name editing, header re-expand fix.

### Phase 5: List Sharing
`list_invites` table, SECURITY DEFINER function, invite link generation, InviteRedemptionPage at `/invite/:code`, member management.

## Research Flags

- **Phase 1:** 3-environment OAuth redirect matrix needs pre-coding checklist
- **Phase 5:** SECURITY DEFINER invite pattern + edge cases need careful planning
- **Phases 2-4:** Standard patterns, no additional research needed

## Open Decisions

- v1.0 data migration: nullable `user_id` with IS NULL fallback (recommended)
- PKCE vs implicit OAuth: PKCE preferred (OAuth 2.1 direction)
- Invite token expiry: persistent/no expiry (recommended for 2-person app)

## Sources

### Primary
- Supabase Auth Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Managing User Data: https://supabase.com/docs/guides/auth/managing-user-data
- shadcn/ui Sheet: https://ui.shadcn.com/docs/components/radix/sheet

### Secondary
- Supabase team invite RLS pattern: https://boardshape.com/engineering/how-to-implement-rls-for-a-team-invite-system-with-supabase
- Google OAuth redirect issues: https://github.com/orgs/supabase/discussions/25756

---
*Research completed: 2026-05-27*
*Ready for roadmap: yes*
