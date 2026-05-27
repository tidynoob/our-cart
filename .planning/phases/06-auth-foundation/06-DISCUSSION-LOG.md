# Phase 6: Auth Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 6-Auth Foundation
**Areas discussed:** Login page layout, Post-login destination, Anonymous data transition, Auth UI chrome
**Mode:** --auto (all decisions auto-selected to recommended defaults)

---

## Login Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Transform landing page | Root route (/) shows login for unauthed, create/join for authed | [auto] |
| Dedicated /login route | Separate login page, landing page unchanged | |

**Auto-selected:** Transform landing page (recommended default)
**Notes:** Simpler routing — no new route needed. Current landing page content becomes the authenticated view.

---

## Post-Login Destination

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to landing page | User lands on / (create/join list) after OAuth | [auto] |
| Redirect to /list/:code | Deep-link to a specific list if known | |
| Show "getting started" page | Onboarding flow for new users | |

**Auto-selected:** Redirect to landing page (recommended default)
**Notes:** No "my lists" page until Phase 7. Return-to-URL pattern handles the deep-link case when user was trying to access a specific list.

---

## Anonymous Data Transition

| Option | Description | Selected |
|--------|-------------|----------|
| Keep accessible via URL | Nullable user_id preserves anonymous list access | [auto] |
| Require migration/claim | Force users to claim anonymous lists on first login | |
| Start fresh | Ignore v1.0 data, clean slate | |

**Auto-selected:** Keep accessible via URL (recommended default)
**Notes:** STATE.md already locked "Nullable user_id on items" with policy `user_id IS NULL OR user_id = auth.uid()`. No migration needed.

---

## Auth UI Chrome

| Option | Description | Selected |
|--------|-------------|----------|
| Centered card + Google button | App name/logo, single Google sign-in button, minimal | [auto] |
| Full Google One Tap widget | Google's embedded sign-in iframe | |
| Split screen with branding | Left panel branding, right panel sign-in | |

**Auto-selected:** Centered card + Google button (recommended default)
**Notes:** Matches existing centered layout pattern (LandingPage uses flex-col items-center). Phone-first, no complexity.

---

## Claude's Discretion

- Loading spinner style during auth state resolution
- Auth error handling UX (toast vs inline)
- Google button visual treatment (brand guidelines vs custom)
- Supabase client auth config (explicit PKCE or rely on default)
- Migration ordering (user_id + lists table same or separate)

## Deferred Ideas

None — discussion stayed within phase scope.
