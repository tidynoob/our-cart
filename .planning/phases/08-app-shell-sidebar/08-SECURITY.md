# Phase 08 — App Shell & Sidebar — Security Audit

**Phase:** 08 — app-shell-sidebar
**ASVS Level:** 1
**block_on:** high
**Audited:** 2026-05-29
**Result:** SECURED — 6/6 threats closed
**Register origin:** Authored at plan time (all 3 PLAN.md `<threat_model>` blocks). Verification only — no new-threat scan.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-08-01 | Information Disclosure | mitigate | CLOSED | `src/stores/listsStore.ts:28` — `.eq('owner_id', userId)` on fetchLists SELECT; server-side enforcement `supabase/migrations/lists_auth.sql:31-36` — `CREATE POLICY "lists_select" ... USING (owner_id IS NULL OR (select auth.uid()) = owner_id)` |
| T-08-02 | Spoofing | mitigate | CLOSED | `src/components/AppShell.tsx:18-22` — `useEffect(() => { if (user && lists.length === 0) { fetchLists(user.id) } }, [user])`; null-user short-circuits the call. Belt-and-suspenders: `src/router.tsx:11-19` nests AppShell inside `<ProtectedRoute />`, which blocks mount until auth resolves |
| T-08-03 | Information Disclosure | mitigate | CLOSED | Sidebar is data-passive: `src/components/AppShell.tsx:31` passes `lists={lists}` (the owner-scoped store) into `src/components/Sidebar.tsx:15`; Sidebar performs no fetch. Source scope inherited from T-08-01 RLS policy. No cross-user lists can reach the drawer |
| T-08-04 | Spoofing / Elevation | mitigate | CLOSED | `src/components/Sidebar.tsx:20` — `<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>` with no `modal` prop → Base UI Dialog default `modal=true` (focus trap + outside-pointer-interaction disabled). Backdrop rendered at `Sidebar.tsx:22-24` (`z-40`) intercepts background clicks. No `modal={false}` override exists anywhere in `src/**/*.tsx` |
| T-08-05 | Elevation | accept | CLOSED | `src/contexts/SidebarContext.ts:3-9` + `src/components/AppShell.tsx:25` — `onOpenSidebar: () => setOpen(true)`. Callback only toggles local drawer-open state; carries no auth token, user id, or data-mutation path. Scoped to the AppShell subtree, which mounts only after ProtectedRoute. Accepted-risk rationale holds (see log below) |
| T-08-SC | Tampering (supply chain) | accept | CLOSED | `git diff --stat f41fa6d..6ce632e -- package.json package-lock.json` returns empty; `package.json` byte-identical at phase start (`f41fa6d`) and end (`6ce632e`). Zero new dependencies introduced this phase. Accepted-risk rationale holds |

## Accepted Risks Log

### T-08-05 — SidebarContext.onOpenSidebar carries no privilege
**Disposition:** accept. The context callback only sets `open=true` on the AppShell-local `useState`. It exposes no authentication material, no user identity, and no data read/write path. The context (including `triggerRef`) is only reachable inside the AppShell subtree, which is itself gated behind `<ProtectedRoute />` in `src/router.tsx`. There is no elevation surface to mitigate. **Rationale accepted.**

### T-08-SC — No new packages this phase
**Disposition:** accept. No dependency was added, removed, or version-bumped across phase 08 (commits `f41fa6d..6ce632e`). All primitives used (`react-router-dom`, `@base-ui/react`, `lucide-react`, `zustand`) pre-date this phase. No supply-chain surface introduced. **Rationale accepted.**

## Unregistered Flags

None. `08-02-SUMMARY.md` `## Threat Flags` section explicitly states "None — no new network endpoints, auth paths, or trust boundaries introduced." `08-00-SUMMARY.md` and `08-01-SUMMARY.md` contain no `## Threat Flags` section (test-scaffold and layout-only waves). No new attack surface appeared during implementation that lacks a threat mapping.

## Notes

- **RLS is the security boundary.** Per phase constraints, the client-side `.eq('owner_id', userId)` filter is a convenience, not a control. The actual boundary is the `lists_select` RLS policy in `supabase/migrations/lists_auth.sql`, which is present in the repo and enforces `auth.uid() = owner_id` server-side. T-08-01 and T-08-03 are CLOSED on that basis.
- **RLS scope caveat (informational, not a phase-08 gap):** the `lists_select` policy also permits `owner_id IS NULL` (legacy anonymous lists) to be read by `anon, authenticated`. This is a Phase 6 legacy-migration decision, outside phase 08's threat register, and does not affect owner-scoped reads for authenticated users. Flagged for awareness only.
- This is a 2-user, $0-budget, non-public app. ASVS L1 is appropriate. No blockers under `block_on: high`.
