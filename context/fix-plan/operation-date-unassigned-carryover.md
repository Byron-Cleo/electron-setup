# Operation-Date Unassigned Carry-Over + Production Guidance

## Overview

The restaurant operates on **operation dates**: each 24h window (anchored to the earliest active shift config's `autoOpenTime`, default `anchorIntervalMinutes = 1440`) contains ONE day shift and ONE night shift. The goal is to track the **remaining unallocated cooked food** with full attribution — which operation date it was produced in and which shift of that window — while ensuring **every new morning shift starts produced at 0**, so fresh food is always cooked and sold to customers.

## Problem

- `GET /api/stock/remaining` only surfaces unassigned batches from the **single most recent closed shift** (`computeShiftUnassignedBatches` scopes to that shift's window). An unassigned batch produced 2+ operation dates ago silently vanishes from the carry-over UI.
- There is no explicit rule that a previous operation date's unallocated production is **invalid** for the current window (should read **0**), forcing a decision: manually re-include it or mark it as wasted.
- No attribution (operation date + shift) is shown next to an unassigned batch.
- Admins/kitchen have no dashboard cue for "cook more" vs "assign more from an existing unassigned pool".

### Current State

| Metric | How Tracked | Operation-Date Scoped? |
|---|---|---|
| Opening stock | `ShiftSnapshot.openingPlates` = previous shift's `closingStockAtManualClose`, else `Menu.stock` | Yes (shift-to-shift) |
| Produced (per menu) | Σ `CookingRecordMenu.platesAllocated` for records in shift window (`dailyReport.ts`) / Σ `platesRemaining` (`menu.ts` stock-status) | Shift-window only, inconsistent |
| Sold | `ShiftSnapshot.platesSold` | Yes |
| Unassigned carry-over | `computeShiftUnassignedBatches(previousShift)` | Previous shift only |
| Wastage of unallocated | Not tracked | No |

## Confirmed Desired Behavior (user-verified)

1. **24h operation-date window** = one day shift + one night shift. A batch is "valid" if its `createdAt` falls inside the current window `[cycleStart, cycleStart + anchorIntervalMinutes)`.
   - Food cooked during the day shift can still be allocated during the night shift of the **same** operation date.
2. **Every new morning shift starts produced at 0.** Production is only attributed to batches cooked inside the current operation-date window.
3. An unallocated batch from a **previous** operation date:
   - Stays in the DB **forever**, tagged with its production time and the operation date + shift it was produced in.
   - Reads **valid unassigned = 0** in the current window (it is **not** assignable by default).
   - Can only be used again via an explicit manager action — **manual carry-over** (re-included "from a starting expected 0") — or be **marked as wasted**.
4. **Mark as wasted** finalizes an expired batch (no effect on `Menu.stock` — unassigned plates never entered menu stock).
5. Guidance: menus at **Sold Out (0)** clearly flag "cook more"; if unassigned plates still exist in a batch pool, the decision is **assign more** instead.

## Solution

### Task 1 — Shared cycle helper

**File:** `backend/routes/shiftCarryOver.ts`

Add `computeCurrentCycle()` mirroring the scheduler's anchor math (`scheduler.ts:37-64`):

```ts
{ cycleStart: Date, cycleEnd: Date, operationDay: Date }
```

- Earliest **active** `ShiftConfig` = anchor; `intervalMinutes = anchorIntervalMinutes || 1440`.
- `cycleStart` = most recent anchor-open boundary at/before now; `cycleEnd = cycleStart + interval`.
- `operationDay` = UTC date of `cycleStart` (same `dateOnly` as scheduler).

### Task 2 — All-unassigned computation

**File:** `backend/routes/shiftCarryOver.ts`

Add `computeAllUnassignedBatches(cycleStart, cycleEnd)`:

- Fetch all cooking records with `createdAt` in the window, each with its splits + stock-supply linked menus.
- Sold per menu from snapshots of the cycle's shifts (`autoOpenTime` within the window).
- Per batch: `unassigned = produced − Σ platesRemaining − batchSold` (replicates AssignmentModal pool).
- Attribute each batch to its shift via the `[autoOpenTime, nextShift.autoOpenTime ?? autoCloseTime)` rule → `{ shiftId, shiftType, operationDay, autoOpenTime, autoCloseTime, cookedAt }`.

Keep existing `findPreviousClosedShift` + `computeShiftUnassignedBatches` for compatibility (used by the shift open snapshot path / daily report).

### Task 3 — `GET /api/stock/remaining` rewrite

**File:** `backend/routes/stockRemaining.ts`

- `carryForwardPerMenu` unchanged (previous closed shift's closing → opening).
- `unassignedBatches` = valid batches in the current window (day + night), each with attribution.
- `expiredBatches` = batches with `unassigned > 0`, `disposed = false`, `createdAt < cycleStart`, attributed to their production shift/operation date; `validUnassigned = 0`.
- No config / no cycle → empty arrays.

### Task 4 — Wastage

**Files:** `backend/prisma/schema.prisma`, `backend/routes/cookingRecords.ts`

- Add `disposed Boolean @default(false)` + `disposedAt DateTime?` to `CookingRecord`; `prisma db push` + generate.
- `POST /api/cooking-records/:id/dispose` → marks disposed (does not touch `Menu.stock`).

### Task 5 — stock-status produced fix + per-menu assignable

**File:** `backend/routes/menu.ts`

- In `getShiftBasedStockStatus`, "produced" per menu = Σ `platesAllocated` (not `platesRemaining`) for records in the window — matches `dailyReport`.
- Add `assignable` per menu = Σ over the window's unassigned batches whose stock supply links to that menu.

### Task 6 — Electron/IPC + API + types

- `preload.cts` / `ipc-handlers.ts`: `cookingRecord.dispose`.
- `lib/api.ts`: `disposeCookingRecord()`.
- `electron.d.ts`: extend `StockRemainingUnassignedBatch` (attribution, `expired`, `validUnassigned`), add `StockRemaining.expiredBatches`, add `CookingRecord.disposed/disposedAt`, add `MenuStockStatusItem.assignable`.

### Task 7 — Frontend `RemainingStockCard`

**File:** `desktop/ui/components/menu/RemainingStockCard.tsx`

- "Unassigned Carry-over" (valid) table gains **Shift** (type + op date) and **Cooked At** columns; day + night batches both listed.
- New **Expired (previous operation date)** section: dimmed rows, "valid 0" badge, **Assign disabled**; per-row actions **Carry over** (opens AssignmentModal; the exception path) and **Mark as wasted** (calls dispose).

### Task 8 — `AssignmentModal` expired banner

**File:** `desktop/ui/components/menu/AssignmentModal.tsx`

- Optional `expired` prop → amber banner: previous-op-date batch, valid 0 by default, manual carry-over is an exception.

### Task 9 — `ProductionGuidanceCard`

**File:** `desktop/ui/components/menu/ProductionGuidanceCard.tsx` (new), wired into `desktop/ui/pages/admin/Menu.tsx` dashboard below `MenuStockStatusCard`.

Per menu: Open / Produced / Sold / On Hand / Assignable.
- On Hand 0 + assignable 0 → red **COOK MORE**.
- On Hand 0 + assignable > 0 → amber **ASSIGN MORE** (plates exist in a pool).
- Running low (≤5) + assignable 0 → amber "cook soon".

## Notes

- Branch: `feature/admin/opdate-unassigned-carryover` (from `restaurant-build`).
- Schema change: `CookingRecord.disposed`, `disposedAt` (additive, no data migration).
- Allocation endpoint stays permissive — the "valid 0" rule is enforced in the UI; manual carry-over is the sanctioned exception.
- No change to the scheduler (auto-open at 5:30 is the production model; orders already require an open shift).

## Verification Gates

- Root `tsc -b`, backend `tsc`, `npm run lint`.
- E2E: cook in day shift → valid in night shift (same op date); prior-op-date batch → expired/valid 0 with attribution; carry-over override → `Menu.stock` increases; mark-as-wasted hides batch; new morning window shows produced 0; guidance card shows COOK MORE / ASSIGN MORE correctly; existing shift reports unchanged.