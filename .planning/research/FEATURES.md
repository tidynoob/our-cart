# Feature Research

**Domain:** Authenticated multi-list shared grocery app — two-person household (couple)
**Researched:** 2026-05-27
**Confidence:** HIGH (Google OAuth + Supabase Auth from official docs; UX patterns from AnyList, Bring!, OurGroceries competitor analysis)

---

## Scope Note

This file covers v2.0 features only: Google OAuth, multi-list management, sidebar navigation,
list sharing/invites, and user profiles. v1.0 features (add/edit/delete items, real-time sync,
check-off, autocomplete, attribution) are already built and not re-researched here.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in an authenticated multi-list app. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Sign in with Google" button on landing | Standard auth entry point for consumer apps; no-password is the expectation | LOW | Must follow Google branding guidelines: standard "G" logo on white background, Roboto Medium font — non-compliance can block app verification |
| Redirect back to app after OAuth completes | Broken post-auth redirects destroy trust; users expect seamless return | MEDIUM | Supabase callback URL must be registered in Google Cloud Console; `redirectTo` must be explicitly set or Supabase falls back to production URL even in dev |
| Persistent session across page reloads | Forcing re-auth on every reload is disqualifying for a daily-use app | LOW | Supabase stores session in localStorage by default; `onAuthStateChange` handles token refresh automatically |
| Sign-out option visible and accessible | Standard for any authenticated app | LOW | Accessible from sidebar or profile area; not buried in settings |
| Editable display name | Users want to control what their partner sees on attribution badges | LOW | Replaces v1's per-list `NamePromptDialog`; stored on user profile once, applies everywhere |
| List of all your lists in sidebar | Core multi-list navigation — where do I go to switch lists? | LOW-MEDIUM | Overlay drawer on mobile (full sidebar on desktop); shows all lists user owns or is a member of |
| Create new list with a name | Every multi-list app lets you name lists ("Weekly Shop", "Costco Run") | LOW | Simple form or inline creation; generates new list owned by current user |
| Rename existing list | Users make typos or change list purpose | LOW | Inline edit or edit button; no confirmation required |
| Delete list with confirmation | Users need to remove stale lists | LOW | Confirmation dialog required; show item count ("Delete list with 12 items?") to prevent accidental loss |
| Share / invite partner to a specific list | The entire value prop is collaboration; sharing must be easy | MEDIUM | See "Sharing Invite Flow" section below for expected behavior detail |
| Active list highlighted in sidebar | Visual affordance — "which list am I on right now?" | LOW | Active/selected state on the list item in the sidebar |
| Switch lists by tapping sidebar entry | Standard navigation behavior | LOW | Route change; sidebar closes after selection on mobile |

### Differentiators (Competitive Advantage)

Features that set this app apart from competitors. Not universally expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Invite via shareable link, not email entry | AnyList and Bring! both require typing partner's email in-app; link-sharing is faster for couples who already text each other | LOW | Generate invite token, partner taps link, signs in, gets added automatically. No email entry friction. |
| Display name stored once on profile | v1 asked for a name on every new list; v2 asks once and remembers — eliminates repeated prompts | LOW | NamePromptDialog retired; attribution uses auth display name globally |
| In-list "Share" button to bring up invite | v1 users dismissed the share banner and had no way back; v2 exposes sharing as a persistent action in the list header | LOW | Icon/button in list header triggers the invite flow from within the list view |
| Real-time attribution with real names | v1 attribution used entered nicknames; v2 uses verified Google account display names — more meaningful | NONE | Already built; just wire to auth user display name instead of localStorage name |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific app.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Email/password sign-up | "Not everyone has Google" | Password reset, email verification, brute-force protection — multiplies dev cost for a 2-person private app | Google OAuth only; both people in a household almost certainly have Google accounts |
| Granular permissions (owner/editor/viewer roles) | Enterprise SaaS pattern | A 2-person grocery list doesn't need RBAC; complexity adds overhead with zero user benefit | All members are co-equal collaborators — same permissions, no roles |
| Public lists (anyone with link can view without login) | "Share our list with guests" | Grocery lists contain personal/household data; public links get re-shared accidentally; this was the core problem with v1's anonymous model | Invite-only: require sign-in to access any shared list |
| Activity feed / change history | Bring! has this, looks nice | Significant storage + UI complexity for minimal grocery value; real-time sync already shows changes instantly | Real-time sync is sufficient; no history needed |
| Push notifications for list changes | "Notify me when partner adds something" | VAPID keys, service worker, notification permission prompts — high complexity; real-time sync handles this when app is open | Real-time sync is sufficient for the open-app use case |
| More than 2 members per list | "Add the kids" | Designed for 2 concurrent users; multi-tenancy multiplies RLS complexity and edge cases | Cap at 2 members per list for v2; revisit in v3 if needed |
| Offline mode / conflict resolution | Common ask for shopping apps | Offline writes with sync conflict resolution is a separate project; explicitly out of scope since v1 | Show offline indicator (already built); no offline writes |
| List folders / nesting | AnyList Complete has this | Overkill for 2-person household; adds navigation depth | Flat list of lists in sidebar is sufficient |
| Email invitation sending | "Send them an invite email" | Requires email sending infrastructure (SMTP, transactional email provider) — adds cost and complexity | Text the invite link instead — couples already text each other |

---

## Feature Dependencies

```
Google OAuth Sign-In
    └──required by──> User Profile (display name, avatar from Google)
    └──required by──> Multi-List (lists owned by auth.uid())
    └──required by──> RLS policies (auth.uid() in all policies)
                           └──required by──> List Sharing (list_members join table enforced by RLS)
                                                └──required by──> Invite Flow (token → add to list_members)

User Profile
    └──replaces──> NamePromptDialog + localStorage per-list name (v1)
    └──feeds──> Attribution Badge (display name instead of entered nickname)

Multi-List + Sidebar Navigation
    └──requires──> Auth (lists tied to auth.uid())
    └──requires──> Routing update (list by UUID/id, sidebar list switching)

List Sharing + Invite
    └──requires──> Auth (inviter and invitee must be identified users)
    └──requires──> list_members table (user_id <-> list_id join, with RLS)
    └──requires──> Invite token mechanism (link with short-lived or persistent token)

In-List Share Button (Header Re-expand)
    └──enhances──> List Sharing (surfaces invite from within the list view)
    └──independent──> Can be implemented as UI-only without blocking other features
```

### Dependency Notes

- **Google OAuth is the root dependency.** Nothing else in v2 works without auth. Build and validate sign-in first before tackling multi-list or sharing.
- **RLS must be in place before list sharing.** Schema migration (add `user_id` to `lists`, create `list_members` table, write policies) gates the invite flow.
- **v1 data has no owner.** Existing lists have no `user_id`. Decision: v1 lists remain accessible via share_code for backward compatibility (don't break existing usage). v2 lists created by authenticated users are auth-gated.
- **NamePromptDialog retires when User Profile lands.** Attribution badges wire to `auth.user.user_metadata.display_name` instead of localStorage. The dialog component can be removed.
- **Routing will change.** v1 routes by `/list/:code` (share_code). v2 authenticated lists should route by `/list/:id` (UUID). The sidebar links to lists by UUID; invite links may still use a token-based URL.

---

## MVP Definition

### Launch With (v2.0 milestone target)

- [x] Google OAuth sign-in — "Sign in with Google" button gates access
- [x] Persistent session with auto-refresh — no daily re-auth
- [x] Editable display name on user profile — one-time setup, applies everywhere
- [x] Sidebar showing all user lists with active-list highlight — navigation
- [x] Create, rename, and delete lists (delete requires confirmation) — multi-list CRUD
- [x] Share list via invite link — partner taps, signs in, gets added as collaborator
- [x] RLS on lists and items tables — enforces ownership and membership
- [x] In-list share button (header re-expand) — access sharing without dismissing to sidebar

### Add After Validation (v2.x)

- [ ] Google profile photo as avatar in sidebar and attribution badges — OAuth provides it free, just needs wiring
- [ ] Member can leave a list — needed eventually; low priority for 2-person use
- [ ] Owner can remove a member — edge case but complete the model
- [ ] Onboarding empty state for new accounts ("Create your first list") — polish

### Future Consideration (v3+)

- [ ] Additional OAuth providers (Apple, GitHub) — adds complexity, both users have Google
- [ ] List archiving (instead of deleting) — low priority
- [ ] Notification preferences — only relevant if push notifications are ever added

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google OAuth sign-in | HIGH | MEDIUM | P1 |
| Persistent session | HIGH | LOW | P1 |
| Editable display name | HIGH | LOW | P1 |
| Sidebar with all lists | HIGH | MEDIUM | P1 |
| Create / rename / delete list | HIGH | LOW | P1 |
| Share list via invite link | HIGH | MEDIUM | P1 |
| RLS on lists + items | HIGH | MEDIUM | P1 |
| In-list share / header re-expand | MEDIUM | LOW | P1 |
| Google avatar in attribution | LOW | LOW | P2 |
| Leave list (member) | MEDIUM | LOW | P2 |
| Remove member (owner) | LOW | LOW | P2 |
| New account empty state | MEDIUM | LOW | P2 |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Should have once v2.0 core is stable
- P3: Nice to have, future milestone

---

## Sharing Invite Flow: Expected Behavior

This warrants explicit specification — it's the most complex new UX in v2, and getting
the edge cases wrong (unauthenticated recipient, expired token) creates frustrating dead ends.

**Primary scenario:** Mitch creates a new list and wants his wife to access it.

**Expected flow (invite link model):**

1. Mitch taps "Share" in list header or sidebar actions
2. App generates an invite link: `our-cart.app/invite/[token]`
3. Mitch uses native mobile share sheet or copies link — sends via iMessage (primary channel)
4. Wife taps link on her phone
5. If she is not signed in: redirected to sign-in page, then back to the invite URL after auth
6. If she is signed in: presented with "Accept invitation to [List Name]?" screen
7. On accept: she is added to `list_members`, redirected to the list view
8. Both can now see and edit the list; attribution shows both names

**Token approach decision (for this 2-person private app):** A persistent invite token
(no expiry) is simpler to implement and appropriate for the use case. The list is private —
only someone who has the link can join. If the user wants to revoke access, they remove the
member. No need for 24-hour expiry complexity.

**Edge cases to handle:**
- Invitee is already a member → show "You already have access" and redirect to list
- Inviter revokes the list before invitee accepts → show "Invitation is no longer valid"
- Invitee is not signed in → sign-in redirects back to the same invite URL (not to home)

---

## Competitor Feature Analysis

| Feature | AnyList | Bring! | OurGroceries | Our Cart v2 |
|---------|---------|--------|--------------|-------------|
| Auth method | Email or Apple/Google | Email | Shared account (no individual auth) | Google OAuth only |
| Invite method | Type partner's email in-app | Type partner's email in-app | Share account credentials | Shareable link (text it) |
| Multi-list | Yes (folders in premium) | Yes (flat) | Yes | Yes (flat sidebar) |
| Permissions model | Owner / member | Equal collaborators | Shared account = equal | Equal collaborators |
| Display name | Account name | Account name | N/A (shared) | Editable per-user display name |
| Real-time sync | Yes | Yes (noted fastest) | Yes (20-second polling noted) | Yes (already built — WebSocket) |
| Attribution | No | Activity feed | No | Yes (already built — color-coded per user) |
| Offline | Yes | Yes | Yes | No (internet required, out of scope) |
| History/activity | Yes (premium) | Yes (free) | No | No (out of scope) |

**Key insight from competitor analysis:**
Both AnyList and Bring! use email-based invitations, which requires typing a partner's
email address inside the app. For a couple who already communicate by text message, this
is unnecessary friction. Sharing a link via iMessage is the natural interaction — it's how
people already coordinate. This is Our Cart's cleaner approach.

---

## Sources

- [Supabase Google OAuth official docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Anonymous Sign-Ins and identity linking](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase onAuthStateChange reference](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Google Sign in with Google Branding Guidelines](https://developers.google.com/identity/branding-guidelines)
- [AnyList features page](https://www.anylist.com/features)
- [Bring! collaborative features](https://www.getbring.com/en/features/collaborative)
- [OurGroceries user guide](https://www.ourgroceries.com/user-guide)
- [Mobile navigation UX patterns - UXPin](https://www.uxpin.com/studio/blog/mobile-navigation-examples/)
- [Material Design navigation drawer](https://m2.material.io/components/navigation-drawer)
- [Login/Signup UX best practices - Authgear](https://www.authgear.com/post/login-signup-ux-guide/)
- [Invite friends UX pattern - UI Patterns](https://ui-patterns.com/patterns/invite-friends)
- [Designing an intuitive invite flow - PageFlows](https://pageflows.com/resources/invite-teammates-user-flow/)

---

*Feature research for: Our Cart v2.0 — Accounts & Multi-List milestone*
*Researched: 2026-05-27*
