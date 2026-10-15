# Menu Category Ordering

## Platform

fullstack

## Goals

- Let admin/manager assign a **display order number** to each menu category from Settings → Menu Categories
- Category table gains a `No.` column (order number) shown before `Name`
- Waiter POS groups menu items by category and renders the category sections in the defined number order (1 → last) for **every** meal period
- Replace the hardcoded breakfast `CATEGORY_ORDER = ["Beverages", "Snacks"]` special-case with the DB-driven order
- Categories with no number / unmatched names fall to the end, alphabetically

## Branch

`feature/admin/menu-category-ordering` off `restaurant-build`.

> Separate branch — do **not** fold into `feature/cashier/receipt-reprint`.

## Locked Decisions

| Question | Decision |
|---|---|
| Duplicate numbers | **Reject** — API returns `409 "Display order already in use"` |
| New category with blank number | **Auto-append last** — server assigns `max + 1`, no forced backfill |
| Rename cascade | **No cascade** — renaming does not rewrite linked `Menu.category` strings; renamed category simply sorts last until re-matched |

## Key Findings

- `Category` model is `{id, name, createdAt, updatedAt}` — `Menu.category` is a **free-text string matched by name** (no FK).
- `GET /api/categories` currently `orderBy: { name: "asc" }` — also drives the MenuForm dropdown, so fixing the sort here benefits both.
- IPC layer (`ipc-handlers.ts`, `preload.cts`) passes category request bodies through untouched — **no Electron changes needed**.
- Waiter grid derives sections via `new Set(items.map(i => i.category))` (`WaiterMenuGrid.tsx:390`), with breakfast-only hardcoded `CATEGORY_ORDER` at line 50.
- Category API functions already exist in `desktop/ui/lib/api.ts:343-368` (`getCategories`, `createCategory`, `updateCategory`, `deleteCategory`).
- Types live in `desktop/ui/types/electron.d.ts:499-510` (`Category`, `CreateCategoryData`, `UpdateCategoryData`).
- Settings UI is `desktop/ui/components/admin/CategoryManager.tsx` (registered in `pages/admin/Manager.tsx`).

## Phases

### Phase 1 — Prisma Schema

- Add `displayOrder Int @default(0)` to `model Category` in `backend/prisma/schema.prisma`.
- Uniqueness is enforced at the **API level** (409), not a DB constraint — avoids a fragile two-step `db push` for a unique column; the admin-screen race window is negligible.
- Run `npm run db:sync` (generate + push) — see AGENTS.md.

### Phase 2 — Backend Routes (`backend/routes/categories.ts`)

- `GET /` → `orderBy: [{ displayOrder: "asc" }, { name: "asc" }]`.
- `POST /` → accept `displayOrder`:
  - omitted / blank / non-integer → auto `max(displayOrder) + 1` (appends last)
  - explicit → validate integer `>= 1`; conflict against another row → `409 "Display order already in use"`
  - keep existing unique-name `P2002` → `409` handling
- `PUT /:id` → accept `displayOrder`:
  - omitted → keep existing value
  - same validation, conflict check excludes self (`id: { not: id }`)
  - keep existing `P2025` → 404 and `P2002` name handling

### Phase 3 — Frontend Types (`desktop/ui/types/electron.d.ts`)

- Add `displayOrder: number` to `interface Category`.
- Add `displayOrder?: number` to `CreateCategoryData` (`UpdateCategoryData` inherits via `Partial`).

### Phase 4 — Settings UI (`desktop/ui/components/admin/CategoryManager.tsx`)

- Table columns become **`No.` → `Name` → `Actions`**; render `cat.displayOrder` in the `No.` cell.
- Dialog gains an optional number input labelled "Display order":
  - placeholder `Auto — appends last`
  - edit mode pre-fills the current `displayOrder`
  - pass through to create/update; API `409` surfaces in the existing `formError` line
- Keep search + pagination as-is (`filtered` currently matches name only — leave unchanged unless it feels wrong in testing).

### Phase 5 — Waiter Grid (`desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx`)

- Load categories via `getCategories()`; build a `Map<name, displayOrder>` lookup.
- Sort category sections for **all** periods by `(displayOrder, name)`.
- **Delete** the hardcoded `CATEGORY_ORDER = ["Beverages", "Snacks"]` (line 50) and the breakfast-only sort branch (lines 392-398).
- Category names with no matching `Category` row (renames, free-text drift) sort last, alphabetically.
- Items **within** a category keep their current order (do not re-sort items).

### Phase 6 — Verification

- `tsc -b` clean; `npm run lint` clean.
- `npm run build` + `npm run build:web -- --server same-origin` green.
- E2E:
  - Number categories 1..n in Settings → waiter sections follow that order
  - Duplicate number → `409` error shown in dialog
  - Blank create → new category appears last
  - Renamed category → drops to end, linked menu items intact

### Phase 7 — Deploy (backend + schema changed)

1. One-time backfill SQL: assign `displayOrder = 1..n` to existing rows ordered by name-asc, so day one is clean.
2. `npm run db:sync` (generate + push).
3. `npm run build --prefix backend`.
4. `npm run server:restart` (needs elevation) → `server:status` → `curl http://localhost:3001/health`.
5. `npm run build:win` for installed terminals.

## Notes

- `Menu.category` stays a `String` (no FK) — ordering is keyed by category **name**, so the waiter lookup is a name match.
- Auto-append (`max + 1`) means legacy/blank rows never block a new category being added.
- Deleting a category removes its ordering row; linked `Menu.category` strings are untouched (pre-existing behavior).
- Backfill must run **before** the point where `GET` sorts by `displayOrder`, otherwise every row ties at `0` and order collapses to name-asc.
