# Link Menu Accompaniments to a Dish's Stock Pool

Branch: `feature/waiter/accompaniment-stock-link`
Platform: backend + frontend

## Problem

A main dish and its side are two separate rows with no stock relationship. The
same food exists twice — e.g. **Kunde Slice** as a `Menu` dish (`requiresCooking`,
pool-backed) and **Kunde** as a global `MenuAccompaniment` — but the dish's plate
pool and the accompaniment are completely unrelated. Selling the dish drains its
pool; selling the side as an accompaniment drains nothing.

Accompaniment selections are **price-only** today: `orders.ts` looks up the
starch/vegetable `price`, adds it to the line total, then drops the ids before the
pool gate and deduct. The pool engine never sees them (`factorForServing` honours
`PORTION` only). So a sold-out dish still offers its side, and the side never
counts against stock in any report.

Goal: let the admin link a `MenuAccompaniment` (STARCH or VEGETABLE) to a main
dish so that selling the side deducts the **same** plates from the dish's pool,
the count shows in one central place, and a sold-out side greys out and becomes
unselectable in the waiter dialog — live, with a **Sold Out** watermark.

## Design

Add a nullable FK on the accompaniment — `MenuAccompaniment.linkedMenuId → Menu`.

- **Link to a `Menu`, not a `StockSupply`.** A `Menu` already carries the entire
  pool engine (SHARED / ALLOCATED / KEYED, `excludedFromSharedPool`, weighted
  `platesPerServing`, direct-sale keyed stock, void-restore, sibling recompute).
  Linking to the dish reuses all of it for free and needs **no new ledger table**.
- **1 accompaniment selection = 1 plate.** Constant
  `ACCOMPANIMENT_PLATES_PER_SERVING = 1` (slice = 1 plate, andazi = 1pc, beans =
  a full plate). No weighting — an accompaniment is always one serving of one plate.
- **Applies to BOTH free and charged sides, BOTH starch and vegetable.**
- **Consumption is charged to the main line's own `orderItemId`.** The order item
  already knows its `starchId` / `vegetableId`; the linked dish's plates are
  consumed onto that same item, so `restoreForOrderItem(orderItemId)` (void) covers
  linked cooked pools automatically — no new allocation concept.
- **Unlinked accompaniments keep today's behaviour** (always available, no stock).

### Decisions (confirmed with operator)

1. **Report counting** — a linked side's plates count on the **linked dish's row**
   in stock movement / daily reports (one central movement line). This is not just
   preferred but **required**: `dailyReport.ts` derives `sold` from `OrderItem`
   only (`factorForServing × qty`), so a side sold onto the dish must be folded
   into that dish's `salesByMenu` entry or the report would disagree with the
   snapshot.
2. **Stale cart** — if a linked side sells out after it is already in the cart and
   the waiter places the combo, **block the whole order** with the existing 409
   `INSUFFICIENT_STOCK` "only N left" shortfall (no silent stripping).
3. **Sold-out side in the dialog** — grey background **plus** a **Sold Out**
   watermark overlay, unselectable; updates **live** like the dish cards (driven by
   the polled menu list, matched on `linkedMenuId`).

## Schema (`backend/prisma/schema.prisma`)

- `MenuAccompaniment`:
  - `linkedMenuId String? @db.Uuid`
  - `linkedMenu   Menu?   @relation("Menu_linkedAccompaniment", fields: [linkedMenuId], references: [id], onDelete: SetNull)`
- `Menu` back-relation `accompanimentLinks MenuAccompaniment[] @relation("Menu_linkedAccompaniment")`
- Distinct relation name (a dish already has several `MenuAccompaniment`
  relations: starch/vegetable/portion + portion options).
- Apply with `npm run db:sync` (post-squash convention: generate + push).

## Backend

### `pools.ts`
- New `export const ACCOMPANIMENT_PLATES_PER_SERVING = 1`.
- New `consumedPoolsForOrderItem(tx, item)` → `{ menuId, plates }[]`:
  the main dish (`factorForServing(menuId, portionId) × qty`) plus, for each side
  (`starchId` / `vegetableId`) whose `MenuAccompaniment.linkedMenuId` is set,
  `1 × qty` against that linked menu. Single source of truth for both create and
  void so the two can never disagree.
- Extend `assertLinesServable` to aggregate demand **per underlying pool**: a
  line's own dish plus the linked dishes of its selected sides, so a shortfall on
  the linked dish is reported (with its name) before anything is written.

### `routes/orders.ts` (create)
- Resolve `linkedMenuId` for the line's starch/vegetable (extend the existing
  accompaniment lookups to select it).
- Gate via the extended `assertLinesServable` (now includes linked sides).
- After the main consume, consume each linked side onto the **same
  `orderItem.id`** via `consumeForOrderItem`.
- Upsert `ShiftSnapshot.platesSold` per consumed menu (main + each linked side),
  reusing the existing main-dish stamping logic.
- `recomputeMenuStockWithSiblings(linkedMenuId)` for each consumed menu.

### `routes/orders.ts` (void)
- Query the order items including `Starch` / `Vegetable` (with `linkedMenuId`).
- Restructure the per-item restore to iterate `consumedPoolsForOrderItem`: restore
  the main line once (`restoreForOrderItem` covers allocations), then direct /
  KEYED restore per consumed menu, recompute mirrors, and decrement snapshots per
  consumed menu.

### `routes/accompaniments.ts`
- `POST` / `PUT` accept `linkedMenuId` (nullable); validate it references a real
  `Menu` (else 400). Allow clearing (set null).
- `GET /` includes `linkedMenuId` and a resolved `availablePlates` via
  `sellableForMenu(linkedMenuId)` (null / unlimited when unlinked).

### `routes/dailyReport.ts`
- In the order-derived `salesByMenu` loop, fold each order line's linked-side
  plates (`1 × qty`) into the **linked dish's** entry (both `sold` and
  `soldBeforeAutoClose`), mirroring exactly what `orders.ts` consumes, so the
  report row and the snapshot agree.

## Frontend

- `types/electron.d.ts` — `Accompaniment` gains `linkedMenuId?: string | null`,
  `availablePlates?: number | null`; `AccompanimentCreateData` / `UpdateData` gain
  `linkedMenuId`; `OrderAccompaniment` gains `linkedMenuId`.
- `lib/api.ts` — accompaniment create/update already pass `data` through; no
  signature change (types only).
- **Admin — `components/menu/AccompanimentDialog.tsx`** — a "Linked dish" `Select`
  (options from `getMenus()`), nullable ("Not linked"); sent as `linkedMenuId`.
- **Admin — `components/menu/AccompanimentsTable.tsx`** — a column showing the
  linked dish name and `N left` / `Sold Out`.
- **Waiter — `pages/waiterPos/WaiterMenuGrid.tsx`**
  - `AccompanyRadioCard` gains a `disabled` prop: grey (`opacity-40`,
    `cursor-not-allowed`), disabled `RadioGroupItem`, and a **Sold Out** watermark
    overlay on the card.
  - Badge flips `Free` / `+KSH N` → `Sold Out` / `N left`, reusing
    `platesBadgeClass` (running-low ≤ 10).
  - Resolve a side's live availability from the polled menu `items` by
    `linkedMenuId` (updates each poll), falling back to the server
    `availablePlates`.
  - Guard `selectStarch` / `selectVegetable` so a sold-out side cannot be chosen.
  - Place-order shortfall path already blocks the whole order with "only N left"
    (decision 2) — verify the linked-dish shortfall surfaces there.

## Verify + deploy

`tsc -b` + `npm run build --prefix backend` + touched-file ESLint → `db:sync`
(generate + push) → backend build → `npm run server:restart` → `curl :3001/health`
→ `npm run build` + `npm run build:web -- --server same-origin`.

Live smoke: link a side to a dish → sell the dish with the side → dish pool drops
by main + 1 → report row shows the combined sold → sell the linked dish to 0 →
the side greys out with the Sold Out watermark, unselectable, live → attempt to
place a stale cart with the sold-out side → whole order rejected "only N left" →
void restores both.

## Open items

- None — both product decisions confirmed with operator.
