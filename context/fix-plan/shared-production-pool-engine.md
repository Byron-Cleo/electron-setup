# Dual-Engine Production Pools (Shared + Weighted Allocation)

## Status
Not Started

## Platform
fullstack

## Goals
1. Let a supply's whole produced pool be sellable by every dish derived from it, with **zero allocation clicks** when the split cannot be guessed (Fish, milk, Chapati)
2. Keep today's hard-cap allocation where a real reservation decision exists, but make it **weighted** so fractional servings deduct correctly (Boiled Meat Half `0.5` deducts `2.0` plates for 4 servings, not `4`)
3. Support **portions** (Fried Eggs 1pc / 2pc) reusing the existing accompaniment convention, priced separately and summed
4. Preserve exact traceability: every sold plate recorded against its `CookingRecord` + menu, void restores to the same batch
5. Preserve carry-over semantics: unallocated (`ALLOCATED`) or unconsumed pool (`SHARED`) becomes the next shift's opening stock
6. Make fractional pools survive shift boundaries — a 9.5 pool must carry over as **exactly 9.5**
7. Ship with **Fish left on `ALLOCATED`** (behaviour byte-identical to today) as the safety net

---

## Problem Statement

### 1. Allocation is infeasible for multi-variant supplies

The kitchen cooks Tilapia → one tray of 10 plates. Today a manager must pre-split it:

```
Boiled Fish ....... 3
Coconut Fish ...... 3
Dry Fish .......... 2
Special Fish ...... 2
```

This is guesswork. *"We cannot know how many will dry fish or coconut fish or special fish be ordered in advance."* It requires someone permanently monitoring the POS and adjusting `+`/`-` while orders come in. Verified in a real restaurant — unworkable.

### 2. But allocation IS correct where a real reservation exists

For Boiled Meat the manager genuinely decides how much is earmarked Full vs Half. So allocation must stay a **hard cap**: ordered plates must never leak into the unallocated remainder, and the unallocated remainder carries over untouched.

### 3. Half-servings break the integer ledger

Boiled Meat Half is `0.5` plates per serving. A 20-plate pool selling one Half leaves **19.5**. Eight stock columns are `Int` and would truncate that to `19`.

---

## Solution: Two Engines, Chosen Per Supply

| | `ALLOCATED` (default) | `SHARED` |
|---|---|---|
| `+`/`-` buttons | shown | hidden |
| What is sellable | only the allocated amounts | the entire pool |
| Allocation role | hard cap | unused |
| Unallocated stock | not sellable → carry-over | n/a |
| Per-variant sold | `platesAllocated − platesRemaining` | from `OrderItemAllocation` |
| Fits | Boiled Meat, Beef, Liver | Fish, milk, Chapati Flour |

Both engines share: weighted decimals, FIFO drain, `OrderItemAllocation` traceability, void restore, pool-level carry-over.

### Engine selection rule

**SHARED is only legal when every dish on the supply consumes exactly 1 unit.** If servings compete for the pool at different rates, a real choice exists about who gets the plates, and a person must make it.

Enforced in `KitchenStockConfig`, not at runtime — the illegal state is unreachable, not merely detected.

### Mode is frozen onto the batch

`sellingMode` is read from `StockSupply` **at cook time only** and copied to `CookingRecord`. A mid-service flip cannot rewrite the meaning of a batch cooked an hour earlier. `ALLOCATED` and `SHARED` batches coexist safely, so supplies can be migrated one at a time with zero downtime.

---

## Worked Examples

### Boiled Meat (ALLOCATED, weighted) — 20 plates cooked

```
Pool = 20

Allocate:
  Boiled Meat Full   6 servings × 1.0 = 6.0
  Boiled Meat Half   4 servings × 0.5 = 2.0
  ─────────────────────────────────────────
  assigned 8.0    unassigned 12.0

Cards:  Full → floor(6.0 ÷ 1.0) = 6 servings
        Half → floor(2.0 ÷ 0.5) = 4 servings

Order 5 × Full  → ✅ succeeds (5 ≤ 6), allocation 6.0 → 1.0
Order 2 × Full  → ❌ 409 (needs 7 > 6)
Unassigned 12.0 → untouched, carries to next shift

Order 3 × Half  → consumes 1.5, allocation 2.0 → 0.5
Pool = 12.0 + 1.0 + 0.5 = 13.5   (20 − 5 − 1.5 = 13.5 ✓)
```

### Fish Tilapia (SHARED) — 10 plates cooked

```
Pool = 10, no splits, no clicks

Cards:  Boiled Fish 10   Coconut Fish 10   Dry Fish 10   Special Fish 10

Order 2 × Boiled Fish → pool 8. That card alone shows "Sold: 2"; all 4 read 8.
Order 3 × Coconut Fish → pool 5. All 4 read 5.
Order 4 × Dry Fish     → pool 1.
Order 1 × Special Fish → pool 0. All 4 dishes vanish from the grid.
New batch cooked       → all 4 reappear within 5s (grid polls every 5s).
```

### Fried Eggs (ALLOCATED with portions) — 40 eggs cooked

```
Pool = 40 eggs
Allocate 10 eggs to "Fried Eggs"      assigned 10, unassigned 30

Card:  Fried Eggs — 10 eggs
       (up to 5 × two-piece, or 10 × one-piece)

Guest wants 3 eggs:
   Fried Eggs (2 pieces)  1 plate × 2 eggs = 2   @ 2,800
   Fried Eggs (1 piece)   1 plate × 1 egg  = 1   @ 1,500
   ────────────────────────────────────────────────────
   Total 3 eggs · 4,300     allocation 10 → 7 eggs remaining
   unassigned 30 carries to next shift
```

**Allocation stays at menu level in base units.** The manager allocates *"10 eggs to fried eggs"*, never *"4 two-piece and 2 one-piece"*. So they only ever guess their own cooking decision, never the customer split.

### Boiled Half / Boiled Full — needs nothing special

Same pot, same unit, one egg per serving. This is the ordinary shared-pool case with `platesPerServing = 1`. **No portions required.**

---

## Phase 1 — Prerequisite Bug Fixes (do first)

Three latent defects that a shared-pool cap would turn dangerous.

### 1.1 Over-order error is swallowed, and the page reloads

`backend/routes/orders.ts:201-210` throws a useful message:

```typescript
throw new Error(`Insufficient stock for ${item.name}: only ${currentStock} plates remaining`);
```

…inside `prisma.$transaction` (opened at `:149`), caught by the generic handler at `:269-275`:

```typescript
console.error("Error creating order:", e);   // message dies here
res.status(500).json({ error: "Failed to create order" });
```

The waiter sees a generic 500, then `desktop/ui/pages/waiterPos/WaiterMenu.tsx:283` runs `setTimeout(() => window.location.reload(), 1500)` — **losing the entire order table mid-service**.

**Fix:** dedicated `409` carrying the real numbers, before the generic catch. Compare `stockRequests.ts:99`, which already returns a proper `400` + specific message — `orders.ts` is the inconsistent one. Remove the reload.

### 1.2 `AssignmentModal` double-writes `Menu.stock`

`desktop/ui/components/menu/AssignmentModal.tsx:162-170` calls `/allocate` (which recomputes `Menu.stock` server-side via `recomputeMenuStock`, `cookingRecords.ts:381-385`) and **then** issues `updateMenu(m.id, { stock: m.stock + delta })` from a pre-allocation snapshot. The second write overwrites the correct server value with a stale one.

**Fix:** server becomes the sole writer; delete the client-side `updateMenu` loop.

### 1.3 `totalAvailable` gates the wrong thing

`backend/routes/menu.ts:270-272` returns `remainingTotal` (sellable) as `totalAvailable`, but `CookedFoodTable.tsx:176-186` uses `totalAvailable` to gate **assignment**. Assignment capacity is `produced − allocated`, not remaining. Today they coincide only because `platesAllocated` includes sold plates; under weighted consumption they will not.

**Fix:** separate the two concepts — `assignmentCapacity = produced − totalAllocated` (gates the button) from `sellableRemaining` (the display figure).

---

## Phase 2 — Schema & Migration

### New enum

```prisma
enum SellingMode {
  ALLOCATED
  SHARED
}
```

### Model additions

| Model | Change | Note |
|---|---|---|
| `StockSupply` | `sellingMode SellingMode @default(ALLOCATED)` | default keeps all 5 existing supplies on today's path |
| `CookingRecord` | `sellingMode SellingMode` | frozen at cook |
| `CookingRecord` | `wastedPlates Decimal @default(0) @db.Decimal(12, 2)` | completes the pool derivation |
| `StockSupplyMenu` | `platesPerServing Decimal @default(1) @db.Decimal(12, 2)` | `0.5` for Boiled Meat Half |
| `Menu` | `defaultQty Int @default(1)` | per-dish starting quantity |
| `Menu` | `hasPortion Boolean @default(false)`, `portionId String? @db.Uuid` | default portion |
| `MenuAccompaniment` | `AccompanimentType` += `PORTION` | reuse the accompaniment convention |
| `MenuAccompaniment` | `platesPerServing Decimal @default(1) @db.Decimal(12, 2)` | 1pc → 1, 2pc → 2 |
| `OrderItem` | `portionId String? @db.Uuid` | + relation |
| `ShiftSnapshot` | `sellingMode SellingMode @default(ALLOCATED)` | stops reports double-counting shared pools |
| `OrderItemAllocation` | index on `cookingRecordId` | pool derivation + per-variant sold |

`OrderItem` unique `[orderId, menuId, starchId, vegetableId]` (map `orderitems_order_menu_starch_veg_key`) → **include `portionId`**. Requires drop + recreate.

`CookingRecordMenu` is **unchanged** — `platesAllocated` / `platesRemaining` are already `Decimal(12, 2)`, so weighted allocation needs no new storage. Servings are recoverable as `platesAllocated ÷ platesPerServing`.

### Int → Decimal(12,2) migration — MANDATORY

A 9.5 pool truncated to `9` at a snapshot compounds every shift. These 8 columns must change:

- `Menu.stock` (`schema.prisma:49`)
- `ShiftSnapshot.openingPlates` (`:413`)
- `ShiftSnapshot.platesSold` (`:414`)
- `ShiftSnapshot.closingStockAtAutoClose` (`:415`)
- `ShiftSnapshot.closingStockAtManualClose` (`:418`)
- `ShiftSnapshot.platesSoldAtAutoClose` (`:419`)
- `ShiftSnapshot.driftPlates` (`:420`)
- `ShiftSnapshot.platesWasted` (`:422`)

Already `Decimal(12,2)`, no change needed: `platesExpected`, `platesActual`, `CookingRecordMenu.platesAllocated/platesRemaining`, `OrderItemAllocation.plates`, `StockSupply.currentStock`.

Migration written by hand (repo convention — the `prisma migrate dev` chain is broken on pre-existing `Category` drift) and applied with `prisma db push`.

---

## Phase 3 — Backend

### 3.1 Order guard — mode-aware, weighted, in one transaction

`backend/routes/orders.ts:201-210` currently guards `menu.stock >= qty`. Replace with a branch on the batch mode:

- **`ALLOCATED`** — drain `CookingRecordMenu` splits FIFO (`createdAt ASC`), consuming `platesPerServing × qty` per split. Never touches unallocated.
- **`SHARED`** — resolve batches whose `stockSupplyId` links to the ordered menu (via `StockSupplyMenu`), drain their pools FIFO, recording `OrderItemAllocation` with `cookingRecordMenuId = null` (already nullable, `onDelete: SetNull`).

Both record `OrderItemAllocation` with the weighted `plates` value. Both fail with `409` + real numbers (fix 1.1).

### 3.2 Void restore

`backend/routes/orders.ts:522-528` mirrors the order path: restore to the exact batches recorded in `OrderItemAllocation`, both modes.

### 3.3 `recomputeMenuStock` — pool-level

`backend/routes/orders.ts:22-30` currently sets `Menu.stock = Σ cookingRecordMenu.platesRemaining`. Change to:

```
ALLOCATED → Σ platesRemaining over the menu's splits
SHARED    → Σ poolRemaining over batches whose supply links to the menu
```

Server is the only writer (fix 1.2).

### 3.4 Cook

`backend/routes/cookingRecords.ts:257` — copy `StockSupply.sellingMode` onto the batch. `ALLOCATED` keeps the existing split flow with weighted arithmetic; `SHARED` creates no splits. `/dispose` records `wastedPlates` so the pool derivation stays complete.

### 3.5 Availability

`backend/routes/menu.ts:375` — `availablePlates` becomes mode-aware (see 3.3), then divided by the dish's `platesPerServing` and floored for display. The sold-out filter at `:381` and `isAvailable` filter at `:354` are unchanged — hiding sold-out dishes is the confirmed behaviour.

### 3.6 Config guard

`backend/routes/kitchenConfig.ts:33-62` — reject `SHARED` when any linked dish (or any of its portions) has `platesPerServing ≠ 1`. Back it with a single helper, `consumptionFactorsForMenu(menuId)`, returning the dish's own factor or its portions' factors — so boiled meat (factor on the supply link) and fried eggs (factors on portions) are validated by one code path.

### 3.7 Carry-over

`backend/routes/shiftCarryOver.ts` + `backend/routes/stockRemaining.ts` — carry-over is unallocated (`ALLOCATED`) or unconsumed pool (`SHARED`). Same rule as today, pool-level. Confirmed rule: *unallocated is never sellable; it becomes the next shift's opening stock.*

### 3.8 Reports

`backend/routes/dailyReport.ts:275,396`, `backend/routes/menu.ts:137-174`, `backend/routes/shifts.ts:317-319`, `backend/scheduler.ts:126,231-241` — Decimal snapshot arithmetic; mode-aware stock totals using `ShiftSnapshot.sellingMode` so one 10-plate Tilapia tray never totals as 40.

Note `menu.ts:165-174` computes `soldOut` using "in production" (has any split `platesAllocated > 0`). Under `SHARED` there are no splits, so in-production must be redefined as "has a batch with pool remaining > 0".

---

## Phase 4 — Frontend

### 4.1 `desktop/ui/components/admin/KitchenStockConfig.tsx`

Selling-mode selector + per-dish `platesPerServing`, with the SHARED≠1 guard surfaced as a disabled option rather than a save-time error.

### 4.2 `desktop/ui/components/menu/AssignmentModal.tsx`

Weighted arithmetic — show **both** servings and plates per dish, since "4 halves" and "2.0 plates" are both meaningful. Hidden entirely in `SHARED`. Client `updateMenu` loop removed (fix 1.2).

### 4.3 `desktop/ui/components/menu/CookedFoodTable.tsx`

Mode-aware columns; no **Assign Plates** button when the batch is `SHARED`.

### 4.4 Waiter — `desktop/ui/pages/waiterPos/`

| File | Change |
|---|---|
| `WaiterMenuGrid.tsx` | Card shows `floor(pool ÷ platesPerServing)`; per-variant `Sold: N` only where sold; **portion picker** beside starch/vegetable |
| `WaiterOrderContext.tsx` | Opens at `Menu.defaultQty` (replaces hardcoded `quantity: 1` at `:156`); `portionId` joins `orderLineKey` (`:11-13`); cap is `floor(pool ÷ platesPerServing)` |
| `WaiterMenu.tsx` | `409` shows the real message, no reload |

### 4.5 Types & API

`desktop/ui/types/electron.d.ts` — `sellingMode`, `platesPerServing`, `defaultQty`, `portionId`, `hasPortion`, `PORTION` accompaniments, Decimal-aware `availablePlates`.
`desktop/ui/lib/api.ts` — kitchen-config selling mode + `platesPerServing`, portion-aware order payload.

---

## Phase 5 — Data Configuration

| Supply | Mode | Factors |
|---|---|---|
| Fish (Tilapia) | `ALLOCATED` | all 1 — **left untouched, unchanged behaviour** |
| milk | `ALLOCATED` | all 1 |
| Chapati Flour | `ALLOCATED` | all 1 |
| Boiled Meat | `ALLOCATED` | Full `1.0`, Half `0.5` |
| Beef | `ALLOCATED` | single variant, auto-100% |
| Liver | `ALLOCATED` | single variant, auto-100% |
| Fried Eggs | `ALLOCATED` | portions: 1pc → 1, 2pc → 2 |

Menu work: create `Fried Eggs (1 piece)` / `Fried Eggs (2 piece)` as `PORTION` rows on a single `Fried Eggs` menu. Boiled Egg (Half) / Boiled Egg (Full) need **nothing** — already handled as two dishes sharing one pool.

---

## Verification

| Scenario | Expected |
|---|---|
| Cook 20 meat, allocate 6 Full + 4 Half | assigned 8.0, unassigned 12.0; cards show 6 and 4 |
| **Order 5 × Full** | **✅ succeeds**, allocation 6.0 → 1.0 |
| Then order 2 more | `409` — needs 7 > 6. **No page reload** |
| Unassigned 12 plates | never sellable; carries to next shift |
| Cook 20, sell 1 Half | carry-over **exactly 9.5**, not 9 |
| Fish left `ALLOCATED` | behaviour identical to today (regression check) |
| Cook Tilapia 10 → flip to `SHARED`, cook again | no clicks; all 4 cards read 10 |
| Order 2 + 3 + 4 | 9 sold, pool 1; 10th rejected `409` |
| Last plate sold | all 4 dishes vanish; reappear within 5s of a new batch |
| `SHARED` + set Half `platesPerServing = 0.5` | config save **rejected** |
| Cook Tilapia 10, flip mode mid-shift | new batch `SHARED`, old batch still `ALLOCATED` |
| Void a `SHARED` order | pool restored to the exact recorded batch |
| Void an `ALLOCATED` order | splits restored FIFO-ascending as today |
| Order 3 fried eggs | 2pc line + 1pc line, priced 4,300, allocation −3 eggs |

---

## Files to Modify

### Backend
- `backend/prisma/schema.prisma` — `SellingMode` enum + all additions + Int→Decimal
- `backend/prisma/migrations/<timestamp>_shared_production_pool/migration.sql` — **new**, hand-written
- `backend/routes/orders.ts` — mode-aware weighted guard, `409`, void restore, `recomputeMenuStock`
- `backend/routes/cookingRecords.ts` — snapshot mode at cook, weighted allocate, `wastedPlates`
- `backend/routes/menu.ts` — mode-aware availability + `/cooked` totals, `totalAvailable` split, `inProduction` fix
- `backend/routes/kitchenConfig.ts` — `sellingMode` + `platesPerServing` + SHARED guard, `consumptionFactorsForMenu()`
- `backend/routes/shiftCarryOver.ts`, `stockRemaining.ts` — pool-level carry-over
- `backend/routes/dailyReport.ts` — mode-aware totals
- `backend/routes/shifts.ts`, `backend/scheduler.ts` — Decimal snapshot arithmetic

### Frontend
- `desktop/ui/types/electron.d.ts`
- `desktop/ui/lib/api.ts`
- `desktop/ui/components/admin/KitchenStockConfig.tsx`
- `desktop/ui/components/menu/AssignmentModal.tsx`
- `desktop/ui/components/menu/CookedFoodTable.tsx`
- `desktop/ui/pages/Kitchen.tsx`
- `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx`
- `desktop/ui/pages/waiterPos/WaiterOrderContext.tsx`
- `desktop/ui/pages/waiterPos/WaiterMenu.tsx`

---

## Deployment

```bash
npm run db:sync                     # generate + push (hand-written migration)
npm run build --prefix backend
npm run server:restart              # or: schtasks /run /tn pos-backend-restart over SSH
npm run server:status               # expect RUNNING
curl http://localhost:3001/health   # expect {"status":"ok",...}
```

---

## Notes & Decisions

- **`ALLOCATED` is the default**, so all 5 existing supplies land on today's code path. Zero behaviour change, zero migration risk. This is the deliberate safety net: if `SHARED` misbehaves in service, flip that one supply back and it works exactly as before.
- **`SHARED` ships with no production user.** Fish is left on `ALLOCATED` by request, so the new path cannot be proven in the real restaurant until a supply is flipped. `milk` or `Chapati Flour` are the natural first candidates. This is an accepted, understood gap — not an oversight.
- **Engine choice is never inferred from existing data.** Today's Fish splits were guesses made under duress; inferring `SHARED` from them would cement the broken behaviour and hide the decision. Fish stays `ALLOCATED` until deliberately changed.
- **`SHARED` is legal only when every factor is 1.** Enforced at config time so the state is unreachable.
- **Allocation is at menu level in base units**, never per portion. The manager guesses only their own cooking decision.
- **Sold-out dishes are hidden entirely** (confirmed) — same as today. The existing greyed "Sold Out" card at `WaiterMenuGrid.tsx:374-398` remains unreachable dead code; deliberately not revived, because under `SHARED` a whole 4-dish category can vanish at once and a busier grid hurts more mid-rush than it helps. Dishes reappear automatically within 5s (grid polls at `WaiterMenu.tsx:240`).
- **Report inflation is real:** 4 shared fish menus each mirror one tray, so summing them reads 40 on a tray of 10. Solved via `ShiftSnapshot.sellingMode`, but the daily report must be walked end to end.
- **Fractional pools:** display floors, storage never does. Every `Number()` on stock must be audited for accidental truncation, and the admin screens that assume whole numbers (`AllMenuTable`, `MenuStockStatusCard`, `EditMenuDialog`) need review.
- **Two coexisting modes is intended.** Every stock query must branch, so the branch belongs in one shared helper rather than scattered across routes.
- Related plans: `context/fix-plan/batch-number-fifo-shift-tracking.md` (shift-scoped batches + FIFO this builds on), `context/fix-plan/cooked-food-one-record-per-menu.md` (origin of `CookingRecordMenu`).