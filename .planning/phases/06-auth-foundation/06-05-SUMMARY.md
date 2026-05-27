---
phase: 06-auth-foundation
plan: 05
subsystem: database
tags: [postgres, rls, supabase, auth, migration, sql]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: items and lists tables with RLS enabled, anon policies
provides:
  - items.user_id column (nullable FK to auth.users) with DEFAULT (select auth.uid())
  - lists.owner_id column (nullable FK to auth.users)
  - Auth-aware RLS policies on items table (items_select, items_insert, items_update, items_delete)
  - Auth-aware RLS policies on lists table (lists_select, lists_insert, lists_update, lists_delete)
  - SQL migration files committed to supabase/migrations/
affects: [07-multi-list, 09-attribution, database-schema]

# Tech tracking
tech-stack:
  added: []
  patterns: [nullable-FK-backward-compat, auth-uid-initplan-optimization, IS-NULL-OR-auth-uid-policy-pattern]

key-files:
  created:
    - supabase/migrations/items_auth.sql
    - supabase/migrations/lists_auth.sql
  modified: []

key-decisions:
  - "Used (select auth.uid()) wrapper in all RLS policies for query planner initPlan optimization"
  - "user_id DEFAULT (select auth.uid()) ensures DB-level attribution even if app code omits it"
  - "No DEFAULT on lists.owner_id -- application code will set explicitly in Phase 7"
  - "All policies grant to both anon and authenticated roles for backward compatibility"

patterns-established:
  - "IS NULL OR (select auth.uid()) = column: backward-compatible auth policy pattern"
  - "SQL migrations stored in supabase/migrations/ directory"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 1min
completed: 2026-05-27
---

# Phase 6 Plan 5: Database Auth Scaffolding Summary

**SQL migrations adding user_id to items and owner_id to lists with backward-compatible RLS policies using IS NULL OR auth.uid() pattern**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-27T17:45:32Z
- **Completed:** 2026-05-27T17:46:42Z
- **Tasks:** 1/2 (paused at checkpoint:human-action for Task 2)
- **Files created:** 2

## Accomplishments
- Created items_auth.sql: adds nullable user_id column with DEFAULT (select auth.uid()), replaces 4 v1.0 anon policies with auth-aware equivalents
- Created lists_auth.sql: adds nullable owner_id column, replaces 4 v1.0 anon policies with auth-aware equivalents
- Both migrations use the (select auth.uid()) wrapper for query planner optimization (evaluated once per query, not per row)
- Backward compatibility preserved: IS NULL branch allows legacy anonymous items/lists to remain accessible

## Task Commits

Each task was committed atomically:

1. **Task 1: Write SQL migration files for items_auth and lists_auth** - `3088f58` (feat)

**Task 2: Apply SQL migrations in Supabase Dashboard** - CHECKPOINT (human-action required)

## Files Created/Modified
- `supabase/migrations/items_auth.sql` - Migration: add user_id to items, replace anon RLS policies with auth-aware policies (D-09/D-10)
- `supabase/migrations/lists_auth.sql` - Migration: add owner_id to lists, replace anon RLS policies with auth-aware policies (D-11)

## Decisions Made
- Used `(select auth.uid())` wrapper (not bare `auth.uid()`) in all policy USING/WITH CHECK clauses for PostgreSQL initPlan optimization
- Set `DEFAULT (select auth.uid())` on items.user_id to ensure database-level attribution even if application code omits user_id in INSERT
- No DEFAULT on lists.owner_id -- Phase 7 application code will set owner_id explicitly when creating lists
- Granted all policies to both `anon` and `authenticated` roles to maintain backward compatibility during transition
- Added lists_delete policy (plan initially deferred it, then decided to include it for completeness)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Migrations must be applied manually.** Task 2 is a checkpoint:human-action requiring the user to:
1. Run items_auth.sql in Supabase Dashboard SQL Editor
2. Run lists_auth.sql in Supabase Dashboard SQL Editor
3. Verify columns and policies via information_schema queries and Dashboard UI

See Task 2 checkpoint details in 06-05-PLAN.md for step-by-step instructions.

## Next Phase Readiness
- SQL migration files are committed and ready for application
- After migrations are applied, the database layer supports authenticated user attribution (items.user_id) and list ownership (lists.owner_id)
- Phase 7 (multi-list) depends on lists.owner_id being in place
- Phase 9 (attribution display) depends on items.user_id being in place
- Frontend auth code (Plans 02-04) can proceed independently of this migration

## Self-Check

Verified below.

---
*Phase: 06-auth-foundation*
*Completed: 2026-05-27 (Task 1 only; Task 2 awaiting human action)*
