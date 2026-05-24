# Feature Landscape

**Domain:** Shared grocery list app — two-person household (couple)
**Researched:** 2026-05-24
**Project scope:** "Our Cart" — phone-first, real-time sync, no-account link sharing

---

## Table Stakes

Features users expect from any shared grocery list app. Missing means the product
feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add items (text entry) | Core action — without it, no list | Low | Fast entry is critical; if adding an item takes more than 2 seconds users stop using the app |
| Real-time sync across both devices | Primary value of a shared list; polling is not acceptable | Medium | OurGroceries syncs every 20 seconds; WebSocket/SSE gives true real-time. This is the core value proposition |
| Check off items while shopping | Universal shopping behavior — tap to mark purchased | Low | Items should visually remain (crossed out, dimmed) until explicitly cleared, not disappear immediately |
| Clear completed items | End-of-trip cleanup; removes crossed-off items from both views | Low | Two-step: check off during shopping, bulk-clear when done. Don't auto-delete |
| Item quantity field | "2 gallons of milk" — required for practical shopping | Low | Optional on add, editable inline |
| Category/grouping | Organizes items by store section — produce, dairy, etc. | Low | Simple grouping; not store-layout mapping. Optional per item |
| Share list with partner | The entire premise — get partner onto the same list | Low-Med | Link/code based for this project; most apps require account creation which adds friction |
| Works well on mobile | Used while walking store aisles; one-handed interaction | Low | Phone-first layout, large tap targets, no tiny UI elements |
| Fast item entry | Competing with typing into a paper list | Low | Minimal taps from open-app to item-added |

---

## Differentiators

Features that set a product apart. Not universally expected, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| No account required — link access | Zero friction onboarding; partner joins via link, no signup | Low-Med | The Easy List and Shared Lists do this. Most apps (AnyList, OurGroceries) require account creation. Differentiates strongly for a private two-person use case |
| Item notes field | "Get the Trader Joe's brand, not Safeway" — disambiguates items | Low | One short text field per item. Reduces "wrong item" trips |
| "Who added this" attribution | Cupla surfaces this; useful when one partner adds items without context | Low | Show initials or a color indicator per item. Low build cost, meaningful UX |
| Auto-sort by category | Groups list by category automatically so user shops aisle-to-aisle without backtracking | Low-Med | Sort items by their category tag in the display. Requires category field to already exist |
| Item history / autocomplete | Remembers previously bought items for one-tap re-add | Medium | Reduces typing for recurring staples. Needs persistence layer for item history |
| Visual/icon-based items | Bring! uses illustrated tiles; scannable while distracted | High | High build cost relative to value for a two-person private app — probably not worth it at this scale |
| Suggested items | AI or frequency-based item suggestions | High | Overkill for two-person use; adds complexity without proportional value |

---

## Anti-Features

Features to explicitly NOT build. Either out of scope, add complexity without value,
or actively harm the two-person household use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multiple lists | Fragments attention; the value is one shared truth. PROJECT.md calls this out explicitly | Start with one list; add later only if validated need emerges |
| User accounts / authentication | Friction. Creates onboarding barrier for what is a private two-person tool | Shared link is the credential; bookmark is the return path |
| Recipe integration / meal planning | Scope creep — this is a shopping list, not a meal planner. AnyList proves you can do this, but it doubles the product surface area | Keep it a list; users who want meal planning use dedicated apps |
| Pantry inventory tracking | Useful in theory, almost never maintained in practice. Adds ongoing maintenance burden for users | Out of scope; does not serve the core "shop without double-buying" problem |
| Price tracking / budgeting | High data maintenance cost; requires store-specific pricing data or user input. Only one app (Groceries Tracker) does it well | Out of scope; a bank app already solves this |
| Barcode scanning | Useful for large families; adds camera permission + lookup API complexity for a two-person list | Item name + quantity is sufficient |
| Offline / PWA mode | Requires complex sync conflict resolution. PROJECT.md explicitly excludes this | Document that internet is required |
| Aisle-layout store mapping | Store layouts change; varies by store; high maintenance. PROJECT.md limits categories to simple grouping | Use category labels (Produce, Dairy) not aisle numbers |
| Push notifications | "Your partner added milk" — useful but requires notification permission and backend infrastructure | Real-time sync on screen is sufficient; they see changes when they open the app |
| Voice assistant integration | Alexa/Siri/Google integration — high build complexity, niche usage for private web app | Out of scope for v1 |
| Social / sharing outside household | This is a private two-person list, not a social grocery tool | The share link is for the partner only; no "public list" feature |

---

## Feature Dependencies

```
Link sharing → [nothing] (entry point, no prerequisite)
Add item → Link sharing (must have list first)
Item quantity → Add item (field on the same form)
Item category → Add item (field on the same form)
Item notes → Add item (field on the same form)
Check off item → Add item (need items to check off)
Clear completed → Check off item (clear only operates on checked items)
Real-time sync → Add item + Check off + Clear completed (all mutations need sync)
Auto-sort by category → Item category (requires category field to be populated)
Item history / autocomplete → Add item (surfaces past items during entry)
"Who added this" attribution → Add item + Link sharing (needs to know which device/person added)
```

---

## MVP Recommendation

The "Our Cart" project context (PROJECT.md) has already defined good scope. Mapping
research findings onto those decisions:

**Build first (table stakes — no negotiation):**
1. Add items with name, quantity (optional), category (optional)
2. Real-time sync between two devices via WebSocket or SSE
3. Check off items — crossed out, stays visible
4. Clear completed items — removes from both views
5. Share list via link/code — no account needed
6. Phone-first responsive layout

**Consider for v1 if low effort:**
- Item notes field (one extra text input — very low cost, meaningful value)
- "Who added this" indicator (color or initial on each item row — low cost)

**Defer — validate need first:**
- Item history / autocomplete: adds backend complexity; validate whether the two-person
  use case has enough recurring items to justify it
- Auto-sort by category: only valuable if users reliably categorize items; depends on
  adoption of the category field

**Never build (this project):**
- Accounts, recipes, pantry, price tracking, offline mode, barcode scanning, voice,
  multiple lists, push notifications

---

## Sources

- OurGroceries User Guide: https://www.ourgroceries.com/user-guide
- SmartCart Family app comparison (Listonic, Bring, AnyList, OurGroceries): https://smartcartfamily.com/en/blog/grocery-apps-comparison
- GroceriesTracker best apps 2026: https://groceriestracker.com/blog/best-grocery-list-apps-2026
- Cupla blog — top grocery apps for couples: https://cupla.app/blog/the-top-grocery-list-apps-for-couples-families/
- The Easy List — no-signup shared lists guide: https://www.theeasylist.com/guides/how-to-create-shared-shopping-list-online
- AnyList vs OurGroceries comparison: https://www.daeken.com/blog/anylist-vs-ourgroceries-app/
