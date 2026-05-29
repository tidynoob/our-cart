# Phase 8: App Shell & Sidebar - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 8-App Shell & Sidebar
**Mode:** `--auto` (autonomous — Claude selected the recommended option for every area; no user prompts)
**Areas discussed:** Shell architecture, Drawer primitive, Open-state location, Active-list highlight, Lists data loading, Layout responsiveness, Close-on-navigate

---

## Shell architecture

| Option | Description | Selected |
|--------|-------------|----------|
| AppShell layout route | React Router v7 layout route with `<Outlet/>` wrapping protected `/list/:code`; drawer+trigger rendered once | ✓ |
| Sidebar embedded in ListPage | Render the drawer inside ListPage only | |

**Auto choice:** AppShell layout route (recommended). Satisfies "from any list page" structurally and hosts the Phase 9 profile slot. LandingPage excluded — already the full lists-home (D-07).
**Notes:** Repo is on React Router **v7**, not v6 as CLAUDE.md states — flagged for planner.

---

## Drawer primitive

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse @base-ui Dialog | Left-anchored drawer on the existing Dialog primitive; reuses focus-trap/escape/backdrop; tw-animate-css slide | ✓ |
| Add shadcn Sheet | Install a new Sheet/Drawer component | |
| Hand-rolled | Custom overlay + focus management from scratch | |

**Auto choice:** Reuse @base-ui Dialog primitive (recommended). Zero new deps; matches existing dialog pattern. Not the centered `DialogContent` — a new left-anchored variant.

---

## Open-state location

| Option | Description | Selected |
|--------|-------------|----------|
| Local useState in AppShell | Open state local to the shell; trigger + drawer co-located | ✓ |
| uiStore (Zustand) | Store open state in the shared ephemeral-UI store | |

**Auto choice:** Local useState (recommended). No cross-component consumers; uiStore reserved for cross-component state (dismissedBanners).

---

## Active-list highlight (NAV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Match useParams().code → share_code | URL identity is share_code; bg + font-weight + aria-current="page" | ✓ |
| Match by list.id | Compare against list id | |

**Auto choice:** Match on `share_code` (recommended). URL carries `share_code` (Phase 7 D-01), not `id`.

---

## Lists data loading

| Option | Description | Selected |
|--------|-------------|----------|
| AppShell fetchLists on mount when empty | Populate listsStore for deep-link/refresh into /list/:code | ✓ |
| Rely on LandingPage fetch | Assume lists already loaded | |

**Auto choice:** AppShell fetches when empty (recommended). Direct nav to a list page never hits LandingPage, so the sidebar would be empty otherwise.

---

## Layout responsiveness (criterion 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Overlay drawer at all breakpoints | One slide-in overlay, mobile + desktop, constrained width | ✓ |
| Persistent desktop rail | Two-layout split: rail on desktop, drawer on mobile | |

**Auto choice:** Single overlay drawer (recommended). Phone-first, matches "slide-in," avoids layout-break risk.

---

## Close-on-navigate (criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| navigate + setOpen(false) in one handler | Link onClick closes drawer | ✓ |
| Route-change effect closes drawer | useEffect on location to close | |

**Auto choice:** Combined handler (recommended). Simplest; tapping active list still closes.

---

## Claude's Discretion

- Hamburger trigger placement in the list header (co-locate with name + SyncStatus).
- Whether to extract a generic `Drawer`/`Sheet` wrapper vs. inline drawer styling in `Sidebar`.
- Sidebar header/title + empty-state copy.
- Slide direction/easing/duration tuning via tw-animate-css.
- Whether shell appears on NotFoundPage — no.

## Deferred Ideas

- Profile section in the shell (avatar/name/sign out) — Phase 9 (slot left empty).
- Re-expand dismissed share-code header (NAV-03) — Phase 9.
- Persistent desktop sidebar rail — rejected for this phase; revisit if desktop usage grows.
- Realtime sidebar updates across sessions/users — Phase 10 (sharing).
