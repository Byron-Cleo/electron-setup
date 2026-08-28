# One Cooking Record = One Menu Item (Direct Stock Tracking)

## Status

Ready to implement (spec loaded into `current-feature.md`).

## Objective

Eliminate the misleading "shared pool" in the cooked-food and plate-assignment
flow so that a stock item no longer produces many menu variants that split one
pot of produced plates. Instead, each cooking record is tied directly to a
**single** menu item, and the live "remaining" plates are decremented in lock-step
with `Menu.stock` whenever a waiter places an order.

## Problem (current behavior)

Two independent counters with no reconciliation:

- `Menu.stock` — a running tally. Assignment **increments** it; an order
  **decrements** it (orders.ts:142-150) based purely on `currentStock - qty`.
- `CookingRecordAssignment.quantityPlates` — a static per-(record,menu) "assigned"
  tally. It only changes via the assignment UI and is **never** touched when an
  order is placed.

Result: ordering drops `Menu.stock` to 0 (waiter feed hides the item), but the
cooked table still shows "assigned N plates" as if those plates are still
available. The two views drift with no link.

Additionally the "one stock item → many menu variants" distribution (Chicken →
Stew, Fry, Ticker) forces a shared-pool "available = produced − totalAssigned"
computation that distributes remaining across every menu and confuses the modal.

## Agreed Design (final)

- **One `CookingRecord` = one menu item.** A cooking record is created for a
  specific menu item and holds that menu's produced plates
  (`platesExpected` / `platesActual`).
- **Drop the `CookingRecordAssignment` table.** Store the live **`platesRemaining`**
  directly on `CookingRecord`.
- **Single shared number (per menu/record):** `platesRemaining` is the source of
  truth for "available to serve" for that menu item, and it updates transactionally
  on **both**:
  - **Assignment / top-up**: increment `Menu.stock` AND `CookingRecord.platesRemaining`.
  - **Order placement**: decrement `Menu.stock` AND `CookingRecord.platesRemaining`.
- **No cross-menu distribution.** No shared-pool math; each menu is independent.
- **Modal is never stale**: it shows the live `platesRemaining`, not the original
  assigned value, so after an order consumes plates the remaining reflects reality
  and the kitchen knows exactly how many more plates to assign.

## Data Changes

- `Menu.stock` — unchanged (Int, source of waiter-feed visibility: hidden when ≤ 0).
- `CookingRecord`:
  - add `menuId String @db.Uuid` (the single menu item it feeds)
  - add `platesRemaining Decimal @default(0) @db.Decimal(12,2)` (live available)
  - add relation `menu Menu @relation(fields: [menuId], references: [id])`
  - remove `assignments CookingRecordAssignment[]`
- Remove model `CookingRecordAssignment`.

> Per user decision: **wipe and re-seed** the existing kitchen/cooking/assignment
> data (and any related test setups) so the new model starts clean. `backend/db/clean-db.ts`
> already clears `CookingRecordAssignment` / `CookingRecord` (and other transactional
> data) while keeping `Menu`, `StockSupply`, `Users`.

## Backend Changes

- `backend/routes/cookingRecords.ts`
  - `POST` create: accept `menuId`, `platesActual`, `platesExpected`; set
    `platesRemaining = platesActual ?? platesExpected` on creation.
  - `GET`: include `menuId`, `platesRemaining` (and menu relation).
  - `PUT`/`DELETE`: keep remaining consistent (editing produced adjusts remaining by
    the delta; delete just removes).
- **New assignment concern moves onto the record**: either
  - keep `cookingAssignments.ts` but rewrite to update the record's
    `platesRemaining` (no more shared-pool), or
  - fold assign/top-up into `cookingRecords.ts`.
  Top-up increments both `Menu.stock` and `CookingRecord.platesRemaining` in one transaction.
- `backend/routes/orders.ts` — on order placement (the tx block at ~142), after
  decrementing `Menu.stock`, also decrement the relevant open (remaining>0)
  `CookingRecord.platesRemaining` for that menu (today, oldest first / FIFO),
  never below 0. Mirrored in the void/restore path (~265).
- `backend/routes/menu.ts`:
  - `/cooked` rewrite: per menu, remaining = sum of its records' `platesRemaining`
    (no `totalPoolAssigned` / shared-pool subtraction). `ready-count`,
    `running-low-count`, `stock-status` updated to read `platesRemaining`.
- `backend/routes/dailyReport.ts` — plate movement / drift now use record
  `platesRemaining` (or produced−sold without the assignment join).
- `backend/scheduler.ts` / `shifts.ts` — any snapshot/report math touching assignments.

## Frontend Changes

- `desktop/ui/types/electron.d.ts` — update `CookingRecord` shape (menuId,
  platesRemaining); remove assignment array usage; update `CookedMenuItem`.
- `desktop/ui/lib/api.ts` — update cooking-record + assignment API functions
  (create with menuId; assign/top-up updates remaining); cooked-menus type.
- `desktop/ui/pages/Kitchen.tsx` — cook dialog: pick the menu item the record feeds
  (link the stock item to a menu); show produced/remaining per the simplified model.
- `desktop/ui/pages/admin/Menu.tsx` + `desktop/ui/components/menu/CookedFoodTable.tsx`
  — list shows each menu's live remaining; remove shared-pool column logic.
- `desktop/ui/components/menu/AssignmentModal.tsx` — rewrite: assign/top-up adds to
  `platesRemaining` (no pool-capped validation); show live remaining, not stale.

## Verification Gates

- `tsc -b` passes (root) + backend `tsc` passes.
- `npm run lint` clean on changed UI files.
- After wipe + re-seed:
  - Create a cooking record for a menu → `platesRemaining = produced`, `Menu.stock = produced`.
  - Assign/top-up more → both increment.
  - Place a waiter order → `Menu.stock` AND `platesRemaining` both decrement.
  - Waiter feed hides item only when `Menu.stock ≤ 0`; cooked table remaining matches.
