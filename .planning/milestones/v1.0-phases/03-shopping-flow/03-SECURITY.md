---
phase: 03
slug: shopping-flow
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-25
---

# Phase 3 — Shopping Flow — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client store → Supabase | `toggleChecked` UPDATE and `clearChecked` bulk DELETE; RLS scopes both to the list's own items | `checked` flag, `list_id` (server-issued UUID) |
| Client optimistic state → render | Optimistic flip/remove happens before DB confirmation; rollback corrects local state on error | item checked state, item array |
| User intent → bulk destructive action | Modal dialog gates `clearChecked`; backdrop dismiss disabled to prevent accidental data loss | confirmation event |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Tampering | `toggleChecked` Supabase UPDATE | mitigate | Inherits Phase 1 RLS (`ENABLE`/`FORCE ROW LEVEL SECURITY` on `items`, ref 01-SECURITY.md T-01-02). `itemsStore.ts:149` issues `.update({ checked }).eq('id', id)`; RLS scopes write to the list's items. | closed |
| T-03-02 | Spoofing | Optimistic UI showing wrong checked state | accept | No real-time sync until Phase 4. Rollback corrects local state on error (`itemsStore.ts:154`). Cross-user desync deferred to Phase 4. | closed |
| T-03-03 | Denial of Service | Rapid checkbox tapping → many UPDATEs | accept | 2-user app; free tier 200 connections / 2M msgs/month — far beyond any tap rate. | closed |
| T-03-04 | Tampering | `clearChecked` Supabase bulk DELETE | mitigate | Inherits Phase 1 RLS DELETE policy. `itemsStore.ts:174` issues `.delete().eq('list_id', listId).eq('checked', true)`; RLS validates `list_id` server-side. | closed |
| T-03-05 | Tampering | Client passes wrong `listId` to `clearChecked` | mitigate | `list.id` is a server-issued UUID read from the Supabase fetch, never user-constructed; passed as `clearChecked(list!.id)` (`ListPage.tsx:153`). RLS revalidates server-side. | closed |
| T-03-06 | Denial of Service | Repeated "Clear Items" taps after rollback | accept | Early-return guard `if (checkedItems.length === 0) return` (`itemsStore.ts:166`) prevents empty-DELETE cascade. 2-user app well within free-tier limits. | closed |
| T-03-07 | Repudiation | No audit log of bulk delete | accept | Personal 2-person list, no audit requirement. Bulk delete is explicitly confirmed via modal (`disablePointerDismissal`, `ListPage.tsx:276`). | closed |
| T-03-SC | Tampering | npm package supply chain | accept | No new packages this phase; `@base-ui/react` already in `package.json`. No install/slopcheck gate triggered. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-02 | Optimistic UI may briefly show stale checked state across users until next load; real-time sync is Phase 4 scope. Rollback handles local error correction. | Mitchell Griffin | 2026-05-25 |
| AR-03-02 | T-03-03 | Rapid-tap UPDATE volume is irrelevant for a 2-user app on Supabase free tier (200 connections / 2M msgs/month). | Mitchell Griffin | 2026-05-25 |
| AR-03-03 | T-03-06 | Repeated-clear DoS is bounded by the empty-set early-return guard and free-tier headroom. | Mitchell Griffin | 2026-05-25 |
| AR-03-04 | T-03-07 | No bulk-delete audit trail; not required for a private 2-person grocery list. Modal confirmation is the intent gate. | Mitchell Griffin | 2026-05-25 |
| AR-03-05 | T-03-SC | No new dependencies introduced this phase; supply-chain surface unchanged. | Mitchell Griffin | 2026-05-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-25 | 8 | 8 | 0 | gsd-secure-phase (manual code verification) |

Method: register authored at plan time (both PLANs carried `<threat_model>` blocks). Mitigate-disposition threats verified by direct read of `itemsStore.ts` and `ListPage.tsx`; RLS dependencies confirmed against Phase 1 01-SECURITY.md (T-01-02). Accept-disposition threats documented in Accepted Risks Log per user approval.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-25
