# Waiter Menu — Layout Setting + Card Grid (collapsible category cards)

## Platform

frontend + backend (small schema/route change for the setting)

## Status

Not Started

## Goals

- Replace the waiter POS "long scroll of stacked category sections" with a **grid of collapsible category cards** so a waiter sees every category at a glance and reaches a dish in **one tap** instead of scrolling
- Add an **admin setting** so the layout is switchable at runtime: `List View` (today's behaviour) vs `Card Grid` (the new one)
- Default to `List View` so the feature ships **without changing waiter behaviour** until the operator explicitly flips the switch
- Keep every stock / sold-out / selling-paused signal and every price calculation **byte-identical** to today
- Fix the dish-detail panel's **missing Back button** (it currently has no way back to the dish list)

## Background / problem

`WaiterMenuGrid.tsx:1134-1149` renders **every** category as a stacked section (a bare `<p>` header + a dish grid) inside one scroll container. With the live menu this is **20 food categories / 89 dishes** in a single scroll — waiters reported the scrolling as tiring during order taking.

Live counts measured from the running instance (`GET /api/menu`, 119 items):

| Meal period | Distinct categories | Dishes |
|---|---|---|
| BREAKFAST / LUNCH / DINNER | **20** | 89 |
| BEVERAGE | 9 | 24 |
| PACKAGE | 1 | 6 |

Per-category dish counts (food periods) — this is what drives the layout decision:

| Category | Dishes | | Category | Dishes |
|---|---|---|---|---|
| Snacks | **16** | | Matoke | 1 |
| Hot Beverages | **14** | | Cereals | 1 |
| Vegetable Plates | 9 | | Ugali | 1 |
| Eggs | 8 | | Athola | 2 |
| Special Meals | 8 | | Cereals/Beans/Minji | 2 |
| Fish | 6 | | Matumbo | 2 |
| Boiled Beef | 5 | | Beef Fry | 3 |
| Ugali Plate/RICE PLATE | 4 | | Liver | 3 |
| Chicken | 1 | | Grand-Ma Chicken | 1 |
| Mbuzi Fry | 1 | | Nduma-Ngwashi | 1 |

**Why the drawer is full-width, not in-cell:** at 1/3 of the grid width (~310px) a dish card only fits **one per row** (name + price + stock badge will not sit two-up at ~150px). A 1/3-width card holding Snacks would be ~1,050px tall — i.e. the scrolling fatigue would simply move inside the card. A full-width drawer renders dishes 3-across at exactly today's dish-card size, so Snacks becomes ~390px and Fish ~130px.

## Decisions (operator-confirmed)

| Decision | Choice |
|---|---|
| Grid shape | Category cards, **3 per row** on desktop (2 on tablet, 1 on phone), rows grow as categories are added |
| Open behaviour | Click a card → it opens into a **full-width drawer below its own row**; click the same card again → it closes. **One category open at a time** |
| Card content | Name + dish count + stock summary, left border tinted with the existing green/amber/red/grey stock language |
| Search | Yes — a dish search box alongside the grid |
| Layout switch | Admin setting, `List View` ⇄ `Card Grid`, default `List View` |
| PACKAGE period | **Excluded** from Card Grid — always keeps the current list layout (one category makes a collapsible card a pointless extra click) |
| BEVERAGE period | Card Grid applies (9 cards = 3 rows) |
| Settings access | Admin-only, matching Go-Live Mode / Server Connection (one-line change in `Manager.tsx` if managers should also get it) |
| Setting name | Settings card **"Waiter Menu Layout"**; options **"List View"** / **"Card Grid"**; DB field `waiterMenuLayout String @default("LIST")` with values `"LIST" \| "GRID"` |

## Layout

### Home state (no category open)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [← Home]        [BREAKFAST][LUNCH][DINNER][PACKAGE][BEVERAGE]         │
├──────────────────────────────────────────────────────────────────────┤
│  [ 🔍 Search dishes…                                                 │
│                                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                       │
│  │ Hot Bev…   │ │ Snacks     │ │ Eggs       │   ← row 1            │
│  │ 14 dishes  │ │ 16 dishes  │ │ 8 dishes   │                       │
│  │ 9 available│ │ ●●●● 2 out │ │ ●●●●●●●●   │                       │
│  └────────────┘ └────────────┘ └────────────┘                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                       │
│  │ Beef Fry   │ │ Boiled Beef│ │ Matumbo    │   ← row 2            │
│  └────────────┘ └────────────┘ └────────────┘                       │
│  … 7 rows for 20 categories, all visible without scrolling            │
└──────────────────────────────────────────────────────────────────────┘
```

### Drill-in state (a category is open)

```
│  ┌────────────┐ ┌────────────┐ ┌────────────┐
│  │ Hot Bev…   │ │ Snacks     │ │ Eggs  ▾    │   ← the clicked card is marked open
│  └────────────┘ └────────────┘ └────────────┘
│  ┌──────────────────────────────────────────────────────────────┐
│  │ EGGS · 8 dishes                                              │   ← full-width drawer
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐                │
│  │ │ Omelette   │ │ Fried Eggs │ │ Egg Chips  │   dishes 3-across
│  │ └────────────┘ └────────────┘ └────────────┘                │
│  └──────────────────────────────────────────────────────────────┘
│  ┌────────────┐ ┌────────────┐ ┌────────────┐
│  │ Beef Fry   │ │ Boiled Beef│ │ Matumbo    │   ← row 2 stays put
```

**No card ever changes row or column.** The drawer is inserted *below its own row*, so the map the waiter learned stays valid; only content below the open row shifts down.

### Detail state (a dish is tapped)

Unchanged from today — image gallery, Size, Served With (starch), Vegetable Options, Add to Order — **plus a Back button** (see "Bug fix" below).

## Card Grid mechanics

### Row chunking

```ts
// cols: 3 (lg) | 2 (sm) | 1 (base)
// chunk categories into groups of `cols`; render each group as its own grid,
// then render any open card's full-width drawer directly below that group.
```

- Sibling cards use `items-start` so a card never stretches to match an open neighbour.
- Exactly **one** category is open at a time → `openCategory: string | null`.
- Clicking the open card again sets `openCategory` back to `null`.

### Tile content

| Element | Content |
|---|---|
| Name | `category` name, up to 2 lines, truncated (`truncate` / `line-clamp-2`) |
| Count | `N dishes` |
| Stock summary | `N available` · `N sold out` · `Selling paused` when applicable |
| Left border | Green = all sellable · Amber = some running low · Red = mostly sold out · Grey = nothing sellable |
| Open marker | Chevron rotated down + highlighted border when the card is open |

Availability is derived from the same helpers the dish cards use — `sellableServingsFor(item, defaultPortionFor(item))` — so the tile can never disagree with the dish cards.

### Search

- One `Input` above the grid, placeholder `Search dishes…`
- Matches `Menu.name` case-insensitively across **all** categories
- Categories with **no** match are hidden; a matching card shows `N matches`
- Inside an open card only matching dishes are shown
- Clearing the search restores the full grid

## Bug fix — dish detail panel has no Back button

`setSelectedItem(null)` is currently called only on serving-period change (`WaiterMenuGrid.tsx:370, 378`). There is **no X / Back control** in the detail header (`WaiterMenuGrid.tsx:866-896`), so once a waiter taps a dish there is no way back to browsing other dishes without switching serving periods.

**Fix:** add a `← Back to dishes` button as its own row above the detail header. It calls `setSelectedItem(null)`, which returns to the Card Grid / List View with the open category still selected.

## The setting

### Schema — `backend/prisma/schema.prisma` (`model SystemSettings`, lines 680-689)

```prisma
model SystemSettings {
  id                Int      @id @default(1)
  showGoLiveInput   Boolean  @default(true)
  // Waiter POS menu layout: "LIST" (stacked sections, current behaviour) or
  // "GRID" (collapsible category cards).
  waiterMenuLayout  String   @default("LIST")
  createdAt         DateTime @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime @updatedAt @db.Timestamptz(6)
}
```

A `String` (not a Prisma enum) is deliberate: adding a NOT NULL column with a default backfills the existing `id = 1` row safely via `prisma db push`, with no enum migration risk.

### Backend — `backend/routes/systemSettings.ts`

- `GET /` needs **no change** — `ensureSettings()` (lines 11-18) already upserts the singleton and returns the whole row
- `PUT /` (lines 32-50) gains validation + persistence, following the existing partial-update pattern:
  ```ts
  if (waiterMenuLayout !== undefined && waiterMenuLayout !== "LIST" && waiterMenuLayout !== "GRID") {
    return res.status(400).json({ error: "waiterMenuLayout must be LIST or GRID" });
  }
  // ...update: waiterMenuLayout !== undefined ? { waiterMenuLayout } : {}
  ```
- `backend/app.ts:90` already mounts the route — **no change**

### Types — `desktop/ui/types/electron.d.ts` (lines 1316-1324)

```ts
type MenuLayout = "LIST" | "GRID";

interface SystemSettings {
  id: number;
  showGoLiveInput: boolean;
  waiterMenuLayout: MenuLayout;
}

interface SystemSettingsUpdate {
  showGoLiveInput?: boolean;
  waiterMenuLayout?: MenuLayout;
}
```

### Admin UI — new Settings card

- **NEW** `desktop/ui/components/admin/MenuLayoutSettings.tsx` — modelled on `GoLiveModeSettings.tsx`: `BackButton` + `Save` button in the header, a `Card` with a `RadioGroup` offering `List View` / `Card Grid`, plus a short explanation of each. Reads on mount, saves via `updateSystemSettings({ waiterMenuLayout })`, shows `Saved.` / error states.
- `desktop/ui/pages/admin/Manager.tsx` — three-point extension:
  1. add `"menu-layout"` to the `ActiveView` union (lines 14-22)
  2. add a card entry `{ title: "Waiter Menu Layout", description: "Choose how the waiter POS lists dishes", icon: LayoutGrid, view: "menu-layout", adminOnly: true }` to the `cards` array (lines 24-80)
  3. add `{resolvedView === "menu-layout" && <MenuLayoutSettings onBack={() => setActiveView(null)} />}` near lines 126-128
- `desktop/ui/lib/api.ts` — **no change**; `getSystemSettings()` / `updateSystemSettings()` (lines 621-640) are already generic
- `desktop/electron/ipc-handlers.ts` (375-381), `main.ts` (84), `preload.cts` (145-148) — **no change**; the bridge is a generic pass-through

### Waiter POS reads the setting

- `desktop/ui/pages/waiterPos/WaiterMenu.tsx` — read `getSystemSettings()` on mount **and** whenever `mealPeriod` changes, plus a ~60s refresh so an admin's flip lands on already-open terminals within a minute. Pass `menuLayout` down as a prop.
- Failure posture: on error, fall back to `"LIST"` (the current behaviour) — the same fail-safe the Kitchen screens use for `showGoLiveInput` (`Kitchen.tsx:723-735`).

## Files to change

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | add `waiterMenuLayout String @default("LIST")` to `SystemSettings` (680-689) |
| `backend/routes/systemSettings.ts` | validate + persist `waiterMenuLayout` in `PUT` (32-50) |
| `desktop/ui/types/electron.d.ts` | `MenuLayout` type + `SystemSettings` / `SystemSettingsUpdate` fields (1316-1324) |
| `desktop/ui/components/admin/MenuLayoutSettings.tsx` | **NEW** — Settings editor for the layout |
| `desktop/ui/pages/admin/Manager.tsx` | `ActiveView` union + card entry + render branch (14-22, 24-80, 126-128) |
| `desktop/ui/pages/waiterPos/WaiterMenuBrowser.tsx` | **NEW** — Card Grid: tiles, row chunking, full-width drawers, search |
| `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | `menuLayout` prop (34-48); branch the listing at 1134-1149; **add the detail-panel Back button** (866-896); widen the L865 cap `max-w-[720px]` → `max-w-[960px]` so the grid gets real width; reset `openCategory` on period change (375-384) |
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | read the setting, pass `menuLayout` down (144-170, 211-245, 355-371) |
| `desktop/ui/hooks/useMediaQuery.ts` | **NEW** — ~20 lines, for the 1/2/3 responsive column count |
| `desktop/ui/index.css` | one short `slide-down` keyframe for the drawer (the codebase already has a `fade-in` keyframe to follow) |

## Invariants — what must NOT change

| Thing | Where | Rule |
|---|---|---|
| Dish card markup | `WaiterMenuGrid.tsx:460-534` (`renderItemCard`) | **Reused verbatim.** The drawer renders the exact same cards as today |
| Cart line price | `WaiterMenuGrid.tsx:59-65` | `(unit + chargedStarch + chargedVegetable) × qty` — untouched |
| Order context price | `WaiterOrderContext.tsx:85-92` | untouched |
| Receipt / order items | `WaiterMenu.tsx:36-39`, `:48` | untouched |
| Server price | `backend/routes/orders.ts:255` | untouched |
| Detail panel price | `WaiterMenuGrid.tsx:70-80` (`comboPrice`) | untouched |
| Category ordering | `WaiterMenuGrid.tsx:437-449` (`Category.displayOrder`) | reused as-is; assigned-first ascending, unassigned alphabetical |

The AGENTS.md **Menu Pricing Rule** must hold after the change: `menu.price` is the unit price excluding accompaniments; a charged starch/vegetable is added to the line total but never becomes a separate dish; a free accompaniment adds nothing.

## Responsive rules

| Breakpoint | Grid columns | Drawer dish columns |
|---|---|---|
| `< 640px` (phone) | 1 | 1 |
| `640-1024px` (tablet) | 2 | 2 |
| `≥ 1024px` (desktop) | 3 | 3 (matches today's dish-card size) |

The existing phone treatment still applies: fixed bottom cart bar + `Sheet`, and `pb-24 lg:pb-0` clearance on the scroller.

## Accessibility

- The category card is a real `<button type="button">` inside the `Card` (not a click-handler on a `div`), with `aria-expanded` and `aria-controls` pointing at its drawer
- The card grid is a `role="list"`-style grouping with each card labelled by its category name
- The drawer gets `aria-label={`${category} dishes`}`
- Focus ring must be visible on the card (use the shadcn `ring` token)

## Verification checklist

- [ ] `npm run lint` — zero **new** issues (the repo carries ~785 pre-existing errors)
- [ ] `npx tsc -b` / `npm run build` clean
- [ ] `npm run build:web -- --server same-origin` clean
- [ ] **Settings** — new "Waiter Menu Layout" card appears; saving `Card Grid` persists across reload
- [ ] **List View** — the waiter POS renders **pixel-identical** to today
- [ ] **Card Grid** — all 20 food cards visible **without scrolling at 1366×768** (tiles tuned to ~72px so 7 rows ≈ 600px)
- [ ] clicking **Fish** opens a full-width drawer with its 6 dishes 3-across; clicking again collapses it and the grid snaps back
- [ ] clicking **Snacks** shows 16 dishes in ~6 rows (not 16 stacked rows)
- [ ] the cards in a row never change position when a sibling opens
- [ ] tapping a dish opens the detail panel; **Back** returns to the drawer with the category still open
- [ ] stock badges, sold-out greying and "Selling Paused" are identical to the List View
- [ ] search filters cards, shows match counts, and filters dishes inside an open card
- [ ] **PACKAGE** period still uses the list layout even when Card Grid is selected
- [ ] BEVERAGE period shows its 9 cards
- [ ] phone 390×844 — no horizontal overflow, 1-column cards, drawer full width
- [ ] a real order placed with the grid open has the **same total** as the same order placed with List View
- [ ] the setting flip reaches an already-open waiter terminal within ~60s

## Deployment

### Local development (where this feature is being built)

```bash
npm run db:sync                        # adds waiterMenuLayout
npm run build --prefix backend
npm run dev:backend                    # dev port 3111
npm run dev                            # Vite + Electron
```

> The local dev backend uses port **3111** and `eraevadb_dev`. Do **not** touch the production `EraevaBackend` service or `eraevadb` from the dev machine.

### Production (later, after operator sign-off)

Schema changed → `db:sync` **before** the rebuild + restart:

```bash
# on the restaurant server, as ops
git pull origin restaurant-build
npm run db:sync
npm run build --prefix backend
schtasks /run /tn pos-backend-restart        # no UAC needed
sc query EraevaBackend                       # expect RUNNING
curl http://localhost:3001/health
npm run build
npm run build:web -- --server same-origin
```

- **No** backend logic change beyond the settings route — but the service still runs compiled `dist/`, so the rebuild + restart **is** required
- Installed `.exe` terminals keep their own packaged bundle → a fresh `npm run build:win` installer is needed for the waiters' machines (operator decision)
- After any plain `npm run build` / `build:win`, re-run `npm run build:web -- --server same-origin` so the served browser UI stays correct

## Out of scope (operator follow-ups, separate changes)

1. **Set `displayOrder` on the 6 food categories that still have `0`** — `Athola`, `Cereals`, `Fish`, `Liver`, `Nduma-Ngwashi`, `Ugali` currently sort alphabetically to the end, so the card order is not deliberate
2. **Merge near-duplicate categories** — `Cereals` + `Cereals/Beans/Minji` and `Ugali` + `Ugali Plate/RICE PLATE` are 4 cards where 2 would do (20 → 18)
3. **BEVERAGE's 9 "categories" are drink brands** (`Dasani`, `MWALA`, `Glass SODA`…) — modelling them as one `Beverages` category with a brand field would make that grid a single card
4. **Search in List View** — the search box is specified for Card Grid only; adding it to List View is a follow-up

## Handoff

- Branch: `feature/waiter/menu-layout-card-grid`
- Spec: `context/features/frontend/waiter-menu-layout-card-grid.md`
- Update `context/current-feature.md` (Platform, Status, Goals, Notes, History) when implementation starts
- No ollama codegen model is installed on this machine (only `qwen2.5vl:3b` vision) → **manual implementation**, consistent with the standing operator directive recorded in past history entries
