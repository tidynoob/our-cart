---
phase: 6
slug: auth-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-28
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → Google OAuth | Browser redirected to Google; Supabase allowlist validates `redirectTo` server-side | OAuth authorization request, redirect URI |
| Supabase Auth → App | Supabase controls allowed redirect destinations via allowlist | Session tokens (access + refresh JWT) |
| Browser localStorage → authStore | Session tokens written by Supabase Auth client; read by `onAuthStateChange` on load | Access/refresh JWT |
| authStore → Supabase Realtime | JWT passed via `setAuth()` per-connection; stale anon sessions cannot persist | Access JWT |
| Browser render → ProtectedRoute | UX guard only — RLS is the enforcement layer | Route path |
| sessionStorage → react-router `navigate()` | `returnTo` path read and consumed for same-origin client navigation | Intended path (non-secret) |
| RLS policies → database queries | Postgres enforces RLS on every query; policy correctness is the security boundary | Row ownership (`user_id` / `owner_id`) vs `auth.uid()` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | Spoofing | OAuth redirect URI manipulation | mitigate | `redirectTo: window.location.origin` (app-origin scoped) — `src/stores/authStore.ts:53` (D-13, commit 4eaa26e); server allowlist in Supabase Dashboard | closed |
| T-06-02 | Information Disclosure | Google Client Secret storage | accept | Secret lives in Supabase Dashboard, never in code; only `VITE_SUPABASE_*` env refs in `src/lib/supabase.ts:3-4` | closed |
| T-06-03 | Information Disclosure | Session token in localStorage | accept | Supabase Auth default; short-lived tokens with auto-refresh; no extra PII co-stored | closed |
| T-06-04 | Spoofing | Async `onAuthStateChange` missed events | mitigate | Callback is synchronous (no `async`/`await`) per D-08 — `src/stores/authStore.ts:27-44` | closed |
| T-06-05 | Elevation of Privilege | Realtime channel stale anon JWT after sign-in | mitigate | `realtime.setAuth(session.access_token)` on every auth change, `setAuth(null)` on sign-out — `src/stores/authStore.ts:38-42` | closed |
| T-06-06 | Elevation of Privilege | Direct API call bypassing ProtectedRoute | accept | ProtectedRoute is UX-only client guard — `src/components/auth/ProtectedRoute.tsx:4-25`; RLS (T-06-11/12) is the real control | closed |
| T-06-07 | Denial of Service | `onAuthStateChange` subscription leak | mitigate | `App.tsx:9-12` returns cleanup; `initialize()` returns `() => subscription.unsubscribe()` — `src/stores/authStore.ts:46` | closed |
| T-06-08 | Information Disclosure | `returnTo` URL in sessionStorage | accept | Tab/origin-scoped path, not a secret; cleared via `removeItem` before navigate — `src/pages/LandingPage.tsx:18-22` | closed |
| T-06-09 | Tampering | Open redirect via `returnTo` manipulation | mitigate | Used only in react-router `navigate(returnTo, { replace: true })` — `src/pages/LandingPage.tsx:21`; client-side nav cannot redirect to external URL | closed |
| T-06-10 | Information Disclosure | OAuth error message displayed to user | accept | Renders `error.message` text only — `src/components/auth/LoginPage.tsx:22-24`; no secrets in Supabase Auth error strings | closed |
| T-06-11 | Elevation of Privilege | Anon user accessing another user's items via direct API | mitigate | items RLS `user_id IS NULL OR (select auth.uid()) = user_id` on S/I/U/D (UPDATE has USING + WITH CHECK) — `supabase/migrations/items_auth.sql:33-66` | closed |
| T-06-12 | Elevation of Privilege | Anon user accessing another user's lists | mitigate | lists RLS same pattern on `owner_id` for S/I/U/D — `supabase/migrations/lists_auth.sql:31-66` | closed |
| T-06-13 | Denial of Service | DROP POLICY mid-migration leaves table unprotected | mitigate | `DROP POLICY IF EXISTS` (items:21-24, lists:19-22); no `DISABLE ROW LEVEL SECURITY` anywhere — RLS never disabled, fail-closed. See residual note. | closed |
| T-06-14 | Tampering | `user_id DEFAULT auth.uid()` null for anon inserts | accept | Correct behavior — anon inserts get `user_id` null; policy permits null — `supabase/migrations/items_auth.sql:14-16` | closed |
| T-06-SC | Tampering | Dependency installs (supply chain) | accept | No new packages added this phase; `package.json` last changed Phase 01 (commit d6e9180) — SQL + existing deps only | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-02 | Google Client Secret held in Supabase Dashboard (encrypted at rest), never committed to git | Mitchell Griffin | 2026-05-28 |
| AR-06-02 | T-06-03 | Session tokens in localStorage are Supabase Auth default; short-lived with auto-refresh; no PII beyond email/name | Mitchell Griffin | 2026-05-28 |
| AR-06-03 | T-06-06 | ProtectedRoute is a UX guard only; RLS at the DB layer is the access-control enforcement point | Mitchell Griffin | 2026-05-28 |
| AR-06-04 | T-06-08 | `returnTo` is a tab/origin-scoped navigation path, not secret; cleared after use | Mitchell Griffin | 2026-05-28 |
| AR-06-05 | T-06-10 | Supabase Auth error strings are informational; surfaced to user for retry; no secrets exposed | Mitchell Griffin | 2026-05-28 |
| AR-06-06 | T-06-14 | Anonymous inserts intentionally produce `user_id = null`; policy permits null for backward compatibility (D-09) | Mitchell Griffin | 2026-05-28 |
| AR-06-07 | T-06-SC | No new dependencies introduced this phase; supply-chain surface unchanged | Mitchell Griffin | 2026-05-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Residual Notes (non-blocking)

- **T-06-13:** Migration scripts have no explicit `BEGIN`/`COMMIT`. The rollback-on-failure guarantee relies on the Supabase SQL Editor's implicit per-submission transaction (an out-of-repo operational step). All in-repo verifiable requirements pass (`IF EXISTS`, no RLS-disable window, single script). If ever applied via a per-statement auto-commit tool, wrap in `BEGIN; ... COMMIT;`.
- **T-06-01:** The server-side redirect allowlist is Supabase Dashboard configuration (out of repo). Only the client `redirectTo` value was verifiable in-repo and is correctly scoped to the app origin.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-28 | 15 | 15 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-28
