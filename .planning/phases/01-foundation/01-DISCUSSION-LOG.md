# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 1-Foundation
**Areas discussed:** List creation flow, Share link format, Schema scope

---

## List Creation Flow

### Q1: First visit experience

| Option | Description | Selected |
|--------|-------------|----------|
| Landing page + button | Simple page with 'Create a List' button | |
| Auto-create on visit | First visit immediately creates a list | |
| Name your list first | Short form asking for list name before creating | |
| *Other* | Name first list or ask for a list code/id to join someone else's | ✓ |

**User's choice:** Two-path landing: create (with name) or join (with code/URL)
**Notes:** User wants both create and join flows on the landing page

### Q2: Join method

| Option | Description | Selected |
|--------|-------------|----------|
| Short code only | Landing page has 'Enter code' field | |
| Full URL paste | Text field accepts full URL | |
| Both — auto-detect | Single input accepts either short code or full URL | ✓ |

**User's choice:** Both — auto-detect
**Notes:** None

### Q3: Share link presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Copy button + code display | Show code prominently with 'Copy Link' button | |
| Native share sheet | Trigger phone's native share with link pre-filled | |
| Both options visible | Code + copy button AND native share sheet button | ✓ |

**User's choice:** Both options visible
**Notes:** None

### Q4: Post-creation destination

| Option | Description | Selected |
|--------|-------------|----------|
| Go to list immediately | Land on empty list view, share accessible from header | |
| Share screen first | Stay on share screen until user taps 'Go to list' | |
| List view with share prompt | Go to list with dismissable banner showing link/code | ✓ |

**User's choice:** List view with share prompt
**Notes:** None

---

## Share Link Format

### Q1: URL structure

| Option | Description | Selected |
|--------|-------------|----------|
| /list/CODE | e.g., our-cart.vercel.app/list/V1StGXR8 | ✓ |
| /l/CODE | Shorter for texting | |
| /CODE (root level) | Shortest but limits future routing | |

**User's choice:** /list/CODE
**Notes:** None

### Q2: Code length

| Option | Description | Selected |
|--------|-------------|----------|
| 8 characters | ~48 bits entropy, easy to type | ✓ |
| 12 characters | ~72 bits entropy, more future-proof | |
| 21 (nanoid default) | Max entropy, long for manual entry | |

**User's choice:** 8 characters
**Notes:** None

### Q3: Alphabet

| Option | Description | Selected |
|--------|-------------|----------|
| Default (A-Za-z0-9_-) | URL-safe, case-sensitive, 64 chars | |
| Lowercase + digits only | Easier to say aloud, 36 chars | |
| You decide | Let Claude pick | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Schema Scope

### Q1: Tables to create

| Option | Description | Selected |
|--------|-------------|----------|
| Both tables now | lists + items together, avoids Phase 2 migration | |
| Lists only | Only what Phase 1 needs | |
| You decide | Let Claude determine | ✓ |

**User's choice:** You decide
**Notes:** None

### Q2: Lists table columns

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: id, name, created_at | Bare minimum | |
| Add share_code separately | UUID PK + nanoid share_code + name + created_at | |
| You decide | Let Claude design per best practices | ✓ |

**User's choice:** You decide
**Notes:** None

### Q3: RLS approach

| Option | Description | Selected |
|--------|-------------|----------|
| Share code = access key | Know the code, access the list | |
| You decide | Let Claude pick simplest secure approach | ✓ |

**User's choice:** You decide
**Notes:** User asked what RLS is — explanation provided before decision

---

## Claude's Discretion

- **Alphabet:** Default nanoid (A-Za-z0-9_-) — codes shared via text, not spoken
- **Tables:** Create both lists + items in Phase 1
- **Schema:** UUID PK + nanoid share_code (unique, indexed) + name + created_at
- **RLS:** Share code as access filter — anyone with code can read/write that list

## Deferred Ideas

None — discussion stayed within phase scope
