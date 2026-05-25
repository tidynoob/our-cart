# Phase 2: List Management - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers: full item CRUD (add, edit, delete) with category grouping and per-person attribution. Users can add grocery items with name/quantity/category, edit or delete them, see items grouped by category section headers, and see who added each item via initials badges. No check-off flow (Phase 3), no real-time sync (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Item Entry UX
- **D-01:** Single text field + Add button at top of list, always visible. Enter/tap submits with name only.
- **D-02:** "More details" expand link reveals quantity (text input) and category (dropdown) fields below the name field.
- **D-03:** Input pinned above items list. Standard top-of-list placement (like Todoist, Apple Reminders).

### Category System
- **D-04:** Predefined dropdown with ~8 grocery categories: Produce, Dairy, Meat, Bakery, Frozen, Beverages, Snacks, Other.
- **D-05:** Category is optional — items without category go to "Uncategorized" section at bottom.
- **D-06:** Items displayed grouped under bold section headers per category. Empty categories hidden. Sort order follows the predefined category list order.

### Attribution Display (LIST-04)
- **D-07:** Small colored initials badge shown to the left of each item name (e.g., [M] for Mitch). One consistent color per person.
- **D-08:** `added_by` column needed in items table (schema migration). Stores the person's display name.

### Edit & Delete
- **D-09:** Tap an item row to enter inline edit mode — name, quantity, category fields become editable in place. Save on blur or Enter.
- **D-10:** Trash icon appears only while in edit mode. Keeps default view clean.
- **D-11:** Delete requires brief confirmation — row highlights with "Delete?" and cancel/confirm buttons before removal.

### Claude's Discretion
- **Attribution identity mechanism:** Name prompt dialog on first list visit ("What's your name?"). Stored in localStorage per list. Written to `added_by` column on each item insert. If localStorage clears, re-prompts. No auth needed — acceptable for a 2-person private app.
- **Schema changes:** Add `added_by` (text, nullable) column to items table. Add UPDATE and DELETE RLS policies for items table (currently only SELECT/INSERT exist). Both scoped via list_id foreign key.
- **Color assignment:** Deterministic color from name hash — same name always gets same color. Two distinct, accessible colors for the two-person use case.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — LIST-01 through LIST-06 requirements for this phase
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependencies

### Prior Phase
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 decisions (share code format, schema design, RLS approach)

### Technology
- `CLAUDE.md` §Technology Stack — Full stack decisions including Supabase, React 19, Vite 8, Tailwind v4, Zustand, shadcn/ui

### Existing Schema (from Phase 1 plan)
- `.planning/phases/01-foundation/01-01-PLAN.md` §Task 2 — Supabase schema SQL with items table structure and current RLS policies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn Button component, use for Add and confirm/cancel buttons
- `src/components/ui/input.tsx` — shadcn Input component, use for item name/quantity fields
- `src/lib/supabase.ts` — Supabase client singleton, use for all item CRUD operations
- `src/stores/uiStore.ts` — Zustand store pattern, extend or create new store for item/edit state

### Established Patterns
- Supabase queries: `supabase.from('table').select()` pattern in ListPage.tsx
- Zustand store: `create<State>()((set) => ({...}))` pattern in uiStore.ts
- Tailwind v4 utility classes throughout existing components
- React Router `useParams` for share code extraction

### Integration Points
- `src/pages/ListPage.tsx:78-81` — Placeholder div "Items area — Phase 2 will populate this"
- `src/router.tsx` — `/list/:code` route already exists, no routing changes needed
- Supabase items table: `id, list_id, name, quantity, category, checked, created_at` — add `added_by` column

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

*Phase: 2-List Management*
*Context gathered: 2026-05-25*
