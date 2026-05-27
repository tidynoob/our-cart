# Phase 1: Foundation - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers: a working Supabase schema with RLS, a React+Vite app scaffold, and the shareable list URL flow — create a list, get a link, partner opens it, both see the same (empty) list. No item CRUD yet.

</domain>

<decisions>
## Implementation Decisions

### List Creation Flow
- **D-01:** Landing page presents two paths: "Create a list" (requires naming it) or "Join a list" (enter code/URL)
- **D-02:** Join input auto-detects whether user entered a short code or full URL
- **D-03:** After creating, show share code + copy button AND a native share sheet button (Web Share API on mobile, fallback to copy on desktop)
- **D-04:** Post-creation lands on the list view with a dismissable banner prompting "Share this list with your partner" (includes code/link)

### Share Link Format
- **D-05:** URL structure is `/list/CODE` (e.g., `our-cart.vercel.app/list/V1StGXR8`)
- **D-06:** Share code is 8 characters using nanoid
- **D-07:** Alphabet is nanoid default (A-Za-z0-9_-) — codes are shared via text/copy, not spoken

### Claude's Discretion
- **Schema design:** Create both `lists` and `items` tables in Phase 1 to avoid migration churn in Phase 2. Items table will be empty but structurally ready.
- **Lists table columns:** id (UUID PK, auto-generated), share_code (nanoid 8-char, unique, indexed), name (text, required), created_at (timestamptz, default now())
- **RLS approach:** Share code = access. RLS policies filter by share_code matching a request parameter. Anyone who knows the code can read/write. Appropriate for a private 2-person app where the URL is the only credential.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — SHARE-01, SHARE-02, SHARE-03 requirements for this phase
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependencies

### Technology
- `CLAUDE.md` §Technology Stack — Full stack decisions including Supabase, React 19, Vite 8, nanoid

No external specs beyond project docs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the foundational patterns

### Integration Points
- Supabase client initialization (shared across future phases)
- React Router setup (list routes used by all subsequent phases)
- nanoid configuration (reused if multiple lists added later)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-24*
