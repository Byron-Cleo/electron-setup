# Direct-Sale Stock: Key In Amount, Sell Without Cooking

## Overview

Every menu item today is only sellable through the cooking-batch pool engine — including ready-to-sell items like sodas, water, and packaging. Staff must create a fake "cooking record" for a soda before a waiter can sell it. This fix adds a `requiresCooking` flag to Menu. Items flagged `false` ("direct-sale") get a stock amount keyed in directly by the admin; orders decrement it, voids restore it, and the waiter card sells down to 0 exactly like cooked dishes do.

## Problem

- `assertLinesServable` (backend/routes/orders.ts:244) checks every order line against sellable plates derived **only** from `CookingRecord` batches (`pools.ts` → `sellableForMenu`)
- `Menu.stock` is a derived mirror, recomputed from batch math (`recomputeMenuStock`) — a menu with no live batch reads 0 and the waiter grid shows Sold Out (WaiterMenuGrid.tsx:413)
- So a soda/water/packaging item cannot be sold until someone fakes a cooking batch for it
- Waiter flow: orders go to the cashier for payment — there is no kitchen order-ticket screen, so nothing needs a "cooked" signal for these items

## Solution

### Phase 1: Database — `requiresCooking` flag + snapshot `platesReceived`

- `backend/prisma/schema.prisma` → `Menu` model: add `requiresCooking Boolean @default(true)`
- `backend/prisma/schema.prisma` → `ShiftSnapshot` model: add `platesReceived Decimal @default(0) @db.Decimal(12, 2)` — direct-sale amounts keyed in **while a shift is running** (cooked items keep it at 0; their inflow is cooking batches, already reported as Cooked)
- All existing items default to `true` (cooked) — zero behavior change for real dishes
- One-time data flag: the 5 **Package** items (Big Bag, Small Bag Package, Take Away Cup, Tin-Bag, Tin TakeAway) → `requiresCooking = false`, stock left at 0 (admin keys in amounts after deploy)
- Package items' existing `StockSupply` links (Big Bag, etc.) go **dormant** — links are kept, never consulted for direct-sale availability. Store tracking is untouched and can be re-enabled later by flipping the flag back
- Run `npm run db:sync` (generate + push) before rebuild + restart

### Phase 2: Backend — pool engine guards (`backend/pools.ts`)

For direct-sale items, `Menu.stock` becomes the **true ledger** (admin-keyed), never recomputed from batch math:

- `recomputeMenuStock()`: if `menu.requiresCooking === false` → return current stock unchanged; **never overwrite** keyed stock (this is the critical guard — the scheduler, void path, and sibling recompute all funnel through it)
- `sellableForMenu()` / `sellableInfoForMenu()`: for direct items return `Number(menu.stock)` directly (skip split/shared batch math)
- `assertLinesServable()`: for direct lines check combined demand (qty summed across lines of the same menu) against keyed stock; cooked lines unchanged. Direct items have no portions — factor is always 1
- `consumeForOrderItem()`: for direct items `menu.update({ stock: { decrement: qty } })` and write **no** `OrderItemAllocation` rows (allocation requires a `cookingRecordId` FK — direct items have no batches)

### Phase 3: Backend — routes

| File | Change |
|---|---|
| `backend/routes/orders.ts` | Order create: pool path already branches via pools.ts. Void path (lines 615–647): the allocation ledger is empty for direct lines, so restore from `item.quantity` (`stock: { increment: qty }`) instead of `restoreForOrderItem()`; skip `recomputeMenuStockWithSiblings` for them. Shift-snapshot `platesSold` decrement (line 641) uses the same quantity |
| `backend/routes/menu.ts` | PUT `/api/menu/:id` (line 793): accept `requiresCooking`; accept `stock` **only when** `requiresCooking=false` (reject stock edits for cooked items — protects the derived mirror). **Top-up recording:** when a direct item's stock is raised while a shift is open, the positive delta (new − old) also increments that shift's snapshot `platesReceived`; reductions are corrections and touch nothing; top-ups while **no** shift is open just set `Menu.stock` (picked up as the next shift's `openingPlates` at auto-open). GET routes: include `requiresCooking` in menu list/detail responses. Menu-detail availability (line 601, reads the pool ledger): for direct items read keyed stock instead |
| `backend/routes/dailyReport.ts` | Audit allocation-based reads: direct-sale sales figures must come from snapshot `platesSold` / order lines, not allocations (direct lines have none). **Direct-row movement:** Cooked column renders "—" (not 0); a separate **Received** figure reads snapshot `platesReceived`; closing = `opening + received − sold` (cooked rows keep `opening + cooked − sold`) |

Snapshots/reports work without extra wiring: shift open snapshots `openingPlates` from live `Menu.stock` (scheduler.ts:127–141), and `platesSold` upserts per order line (orders.ts:307–316) — both already include direct items.

### Phase 4: Frontend

| File | Change |
|---|---|
| `desktop/ui/types/electron.d.ts` | `MenuItem`: add `requiresCooking?: boolean` |
| `desktop/ui/components/MenuForm.tsx` | New switch: **"Direct sale (no cooking)"**. ON → hide supply/portion/accompaniment sections; show **"Stock on hand"** number input (key in amount, e.g. 20 — this IS the top-up; editable anytime). OFF → exactly as today |
| `desktop/ui/components/menu/AllMenuTable.tsx` | For direct items show a stock column with the remaining number, inline-editable (top up or correct down) |
| `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | Already reads `availablePlates ?? stock` and grays Sold Out at 0 — **no structural change**. Optional polish: direct-item badge shows "18 left" instead of "18 plates" |
| Cashier screens | Zero changes — orders/bills flow exactly as today |
| Kitchen Production page (`Kitchen.tsx`) | Zero changes — direct items never get batches, so they never appear there |

Sold-out display (agreed): gray "Sold Out" card — the existing pattern; visible but unclickable.

## Admin Experience (how it appears once in effect)

- **Menu form**: a "Direct sale (no cooking)" switch. When on, cooking/supply options disappear and a simple Stock number box appears — key in 20, save, done
- **Menu table**: direct items show remaining stock (e.g. 18) inline — edit the number to top up
- **Waiter grid**: direct cards deplete ("18 left" → gray "Sold Out" at 0) and become orderable again right after a top-up
- **Daily report (direct rows)**: Cooked shows "—"; top-ups made during the shift show as a separate **Received** figure; Closing = Opening + Received − Sold. Top-ups keyed between shifts simply land in the next shift's Opening

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | `Menu.requiresCooking Boolean @default(true)`; `ShiftSnapshot.platesReceived Decimal @default(0)` |
| 2 | `backend/pools.ts` | Guards: recompute skip / sellable read / assert check / consume decrement for direct items |
| 3 | `backend/routes/orders.ts` | Void restore from `item.quantity` for direct lines |
| 4 | `backend/routes/menu.ts` | Accept `requiresCooking` + direct-only stock edits; stamp running shift's `platesReceived` on top-ups; expose flag in responses; detail availability branch |
| 5 | `backend/routes/dailyReport.ts` | Direct rows: Cooked = "—", Received from `platesReceived`, closing = opening + received − sold; audit allocation assumptions |
| 6 | `desktop/ui/types/electron.d.ts` | `MenuItem.requiresCooking?: boolean` |
| 7 | `desktop/ui/components/MenuForm.tsx` | Direct-sale switch + Stock on hand input; hide cooking config when on |
| 8 | `desktop/ui/components/menu/AllMenuTable.tsx` | Stock column for direct items (inline top-up) |
| 9 | `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | Optional badge wording ("N left") |

## Deployment (production — EraevaBackend runs compiled dist/)

1. Branch: `feature/admin/direct-sale-stock`
2. `npm run db:sync` (schema changed — generate + push BEFORE rebuild)
3. One-time SQL: flag the 5 Package items `requiresCooking = false`
4. `npm run build --prefix backend`
5. `npm run server:restart` → verify `server:status` RUNNING + `curl http://localhost:3001/health`
6. Frontend: `npm run build` then `npm run build:web -- --server same-origin` (browser live view stays correct; installed .exe terminals keep their packaged bundle)

## Validation

1. `npx tsc --noEmit` passes (frontend + backend)
2. `npm run lint` passes
3. Admin: key 20 into Big Bag → saved
4. Waiter: place order with qty 2 → grid shows 18 left; over-ordering (e.g. 19) is blocked with a clear error
5. Cashier: order shows for payment as usual
6. Void the order → stock back to 20, snapshot platesSold decremented
7. Key stock down to 0 (or sell out) → waiter card gray "Sold Out", unclickable
8. Daily report shows direct-sale units sold with opening/closing stock
9. **Mid-shift top-up:** key 20 into a direct item while a shift runs, sell 5 → report row reads Opening 0 / Received 20 / Sold 5 / Closing 15 — never negative
10. Cooked dishes unchanged: cook a batch → split → sell → verify old flow intact
