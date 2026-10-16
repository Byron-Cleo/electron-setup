# Keyed Supply (Eggs) — Direct Key-In Pool Without Cooking

Branch: `feature/store/keyed-egg-supply`
Platform: backend + frontend

## Problem

Cooking (`CookingRecord`) is a **frozen, irreversible** event: once a batch is
cooked the pool math owns it and it cannot be edited back. For supplies like
**Eggs** the kitchen does not want that rigidity — eggs are counted as they are
used, topped up ad-hoc, and reconciled by hand. Today `Eggs` is `SHARED` with a
stale cooked batch; other egg dishes are unlinked and unsellable.

The operator wants a generic **keyed** engine: a manager keys an amount
("available now"), the amount is adjust up/down at will, all linked dishes share
one pool with their portion rates preserved, and every change leaves an
append-only audit trail. If it works for eggs, any supply can opt in.

## Design

Add a third `SellingMode` — `KEYED` — alongside `ALLOCATED` / `SHARED`.

- `StockSupply.sellingMode = KEYED` means the supply has **no cooking batches**;
  its sellable pool is the admin-keyed `StockSupply.keyedStock` (plates).
- Every dish linked to the supply sells from that one shared pool at its own
  `platesPerServing` / portion rate (identical weighting to `SHARED`).
- Sales decrement `keyedStock` directly (no `OrderItemAllocation` rows — there is
  no batch FK). Voids restore it from `factorForServing × qty`.
- `Menu.stock` stays a derived mirror for the waiter grid / buckets; it is
  recomputed from `keyedStock` like any pool (no special guard needed, unlike
  direct-sale whose `Menu.stock` *is* the ledger).
- Admin key/adjust writes a `StockAdjustment` row (who / when / before → after /
  delta / reason) and stamps the running shift's `platesReceived` with the
  **net** delta so the shift report reconciles: increase → **Received**,
  decrease → **Adjustment**.

Keyed ≠ direct-sale: direct-sale is a per-**Menu** ledger
(`Menu.requiresCooking = false`, `Menu.stock` is truth); keyed is a per-**Supply**
shared pool feeding many dishes with portions.

## Placement (settled with operator)

- **The selling engine is declared on the STOCK, at entry.** The "Selling Engine"
  selector lives in the stock input form — both `pages/admin/StockSupplyForm.tsx`
  (page) and `components/admin/StockSupplyEditDialog.tsx` (dialog) — inside the
  "Is Menu Item?" block, right under "Menu Items". This is the earliest point the
  operator declares it, so they "know in advance" how the stock will sell.
  - Backend: `items.ts` create/update accept `sellingMode` (validated
    `ALLOCATED | SHARED | KEYED`); a changed engine re-mirrors the linked dishes.
- **Rates + keyed count live in the Menu section, not Settings.** The
  Stock-Kitchen Configuration screen (plates/unit, per-dish plates/serving, and
  the KEYED amount + audit trail) is surfaced under **Menu/Dispatch**. It no
  longer picks the engine — the engine shows read-only there because it is
  declared on the stock. Settings (`Manager.tsx`) drops the "Stock-Kitchen
  Configuration" card.
- **Keyed is reusable.** Any supply may be KEYED; every linked dish draws from
  the one pool, and a dish fed by **several** keyed supplies shows the **SUM** of
  their amounts — e.g. Milk Packets 8 + Milk JerryCan 12 → **20 cups** on the
  waiter POS (existing `sellableInfoForMenu` already sums linked keyed pools).

### Migration of the old "direct-sale shortcut" supplies
Before the keyed engine existed, drinks/retail were linked to a supply **and**
marked direct-sale so stock could be typed in. Those links are now inert
(`sellableInfoForMenu` short-circuits direct-sale). Once the guards below land,
migrate each such supply → `KEYED` (seed `keyedStock` = the dish's current stock)
and flip its dishes to supply-backed. The one shared group is **Milk Packets +
Milk JerryCan → African Tea / White Chocolate / White Coffee** (both stay as
separate keyed pools; the dishes show the sum).

Keyed ≠ direct-sale: direct-sale is a per-**Menu** ledger
(`Menu.requiresCooking = false`, `Menu.stock` is truth); keyed is a per-**Supply**
shared pool feeding many dishes with portions.

## Schema (`backend/prisma/schema.prisma`)

- `enum SellingMode { ALLOCATED; SHARED; KEYED }`
- `StockSupply`:
  - `keyedStock Decimal @default(0) @db.Decimal(12, 2)`
  - `adjustments StockAdjustment[]`
- New model `StockAdjustment` (append-only audit):
  - `id`, `stockSupplyId`, `userId?`, `action` (`KEY` | `ADJUST`),
    `delta`, `amountBefore`, `amountAfter`, `reason?`, `createdAt`
  - relations: `stockSupply` (Cascade), `user` (User?); index on `stockSupplyId`
- `User` back-relation `stockAdjustments StockAdjustment[]`
- Apply with `npm run db:sync` (post-squash convention: push-only).

## Backend

- `pools.ts`
  - `sellableInfoForMenu()`: for each non-excluded link whose supply is `KEYED`,
    add `Number(keyedStock)` to the sellable total; report engine `KEYED`
    (`MIXED` when combined with live allocated/shared).
  - `consumeForOrderItem()`: after the direct-sale branch, decrement each linked
    `KEYED` supply's `keyedStock` (capped at available) before the batch loop.
- `routes/orders.ts`
  - Shift-snapshot `sellingMode` stamp already reads
    `stockSupply.sellingMode`, so keyed rows stamp `KEYED` automatically.
  - Void: add a keyed branch (mirror of the direct-sale branch) that increments
    `keyedStock` by `factorForServing × qty`, pulls the snapshot `platesSold`
    down, and re-mirrors siblings.
- `routes/kitchenConfig.ts`
  - Allow `"KEYED"` in the `sellingMode` validation.
  - `POST /:id/key` — body `{ amount, reason?, userId? }`; validate `amount ≥ 0`
    (and, for a decrease, `amount ≥ 0` allowing anything — no floor below sold);
    write `StockAdjustment`; set `keyedStock`; if a shift is open stamp its
    snapshots' `platesReceived` by the net delta; re-mirror linked menus;
    `emitLiveEvent(pool.updated)`.
  - `GET /:id/adjustments` — recent adjustments (newest first, capped).
- `routes/cookingRecords.ts`
  - `POST /` rejects a `KEYED` supply (`400`, code `KEYED_HAS_NO_COOKING`).
  - `POST /:id/allocate` — already guards `SHARED`; extend to `KEYED`.
- `routes/dailyReport.ts`
  - Dedupe `KEYED` mirrors exactly like `SHARED` (one shared pool → many dishes;
    count once, others `isSharedMirror`), so receipts don't multiply the pool.
  - Keyed rows show `platesCooked = 0`; `platesReceived` carries the net keyed
    delta (may be negative → surfaced as **Adjustment**).

## Frontend

- **Selling Engine selector (stock input form)** — `pages/admin/StockSupplyForm.tsx`
  and `components/admin/StockSupplyEditDialog.tsx`: a three-option engine picker
  (Allocated / Shared / Keyed) shown under "Menu Items" when "Is Menu Item?" is
  on; stored on `StockSupply.sellingMode`.
- `components/admin/KitchenStockConfig.tsx` — relocated to the **Menu/Dispatch**
  section (rendered from `pages/admin/Menu.tsx`; removed from `Manager.tsx`).
  Shows the engine **read-only** (declared on the stock) and keeps the per-dish
  rates; for **KEYED** supplies it shows the **Key amount** input + Save, a live
  current-amount display, and an **Adjustment history** list (who / when /
  before → after / delta / reason).
- `lib/api.ts`: `keyStockSupply(id, amount, reason?)`, `getStockAdjustments(id)`.
- Electron parity: `ipc-handlers.ts`, `main.ts`, `preload.cts`,
  `types/electron.d.ts` (`SellingMode` += `"KEYED"`, `StockAdjustment` type).
- `components/reports/ShiftReport.tsx` (+ close dialog/prints): keyed rows show
  **Cooked "—"**, **Received** for positive and **Adjustment** for negative.

## Data setup (prod)

- Flip `Eggs` supply → `KEYED`; seed `keyedStock = 2`; dispose the stale batch;
  link `Scrambled Eggs`, `Boiled Eggs`, `Omelette`, `Egg One Piece` to `Eggs`
  (`platesPerServing` default 1 — operator adjusts per dish). `Pancake Eggs`
  untouched.

## Verify + deploy

`tsc -b` + `npm run build --prefix backend` + touched-file ESLint → `db:sync`
(generate + push) → backend build → `npm run server:restart` →
`curl :3001/health` → `npm run build` + `npm run build:web -- --server same-origin`.

Live smoke: key 30 → sell 1pc/2pc across dishes → adjust down then up → shift
report Opening/Received/Adjustment/Sold/Closing balances → adjustment trail
shows every event → 0 = Sold Out.

## Open items

- 4 orphan egg dishes linked at `platesPerServing` 1 pending operator per-dish
  values (editable in KitchenStockConfig).
