# Plan: Plate Movement Column Rename + Drift Sold

## Status

Plan — ready for implementation

## Summary

Rename and restructure the plate movement section in shift reports (ShiftReport, ShiftCloseDialog, printed receipt) to match the agreed snapshot lifecycle definitions. Includes schema field renames, computed drift sold, dropped redundant fields, and updated column layout.

## Backstory / Agreed Model

Each `ShiftSnapshot` represents one menu item within a shift. Its physical stock travels through distinct lifecycle moments, each captured in a differently-named field (same data, different context):

1. **Shift opens** → `openingPlates` = previous shift's `closingStockAtManualClose` (falls back to `Menu.stock`)
2. **Kitchen cooks & assigns** → Cooked = `Σ platesAllocated` over cooking-record splits in the shift's window
3. **Waiter sells** → `platesSold` = total ordered (opening → manual close, includes drift)
4. **Auto-close tick** (at `autoCloseTime`) → `closingStockAtAutoClose` (physical stock remaining) + `platesSoldAtAutoClose` (cumulative sold at tick, i.e. pre-drift)
5. **Manual close** (manager) → `closingStockAtManualClose` (physical stock remaining) + final `platesSold` (total)
6. **Drift sold** = `platesSold − platesSoldAtAutoClose` (incremental sales during the drift period) — computed, not stored

## Column Layout

| # | Column header | Field source |
|---|---------------|--------------|
| 1 | Opening | `openingPlates` |
| 2 | Cooked | `Σ platesAllocated` (kitchen production assigned per menu) |
| 3 | Sold | `platesSold` (total, opening→manual close) |
| 4 | Closing Stock | `openingPlates + cooked − sold` |
| 5 | Wasted | `platesWasted` |
| 6 | Auto Closing Stock | `closingStockAtAutoClose` |
| 7 | Drift Minutes | `driftMinutes` |
| 8 | Drift Sold | `platesSold − platesSoldAtAutoClose` |
| 9 | Final Closing Stock | `closingStockAtManualClose` |

**Removing:** Variance column

## Schema Renames

| Old field | New field | Notes |
|-----------|-----------|-------|
| `autoClosePlates` | `closingStockAtAutoClose` | Stock remaining at auto-close tick |
| `manualClosePlates` | — | **Drop** (redundant with `closingPlates`) |
| `closingPlates` | `closingStockAtManualClose` | Stock remaining at manual close |
| `platesSoldAfterAutoClose` | `platesSoldAtAutoClose` | `platesSold` snapshot at auto-close tick (pre-drift) |

**New computed (report only, not stored):** `driftSold = platesSold − platesSoldAtAutoClose`

## Files & Changes

### `backend/prisma/schema.prisma`
- Rename `autoClosePlates` → `closingStockAtAutoClose`
- Rename `closingPlates` → `closingStockAtManualClose`
- Drop `manualClosePlates`
- Rename `platesSoldAfterAutoClose` → `platesSoldAtAutoClose`
- Update `platesSold` comment: "total plates sold from shift open to manual close"

### `backend/prisma/migrations/`
- New migration: `npx prisma migrate dev --name rename-shift-snapshot-stock-fields`

### `backend/scheduler.ts` — `autoCloseExpiredShifts()`
- Line 203: rename `autoClosePlates` → `closingStockAtAutoClose`
- **NEW**: also capture `platesSoldAtAutoClose: snapshot.platesSold` at the same tick

### `backend/routes/shifts.ts` — manual close
- Rename `autoClosePlates` → `closingStockAtAutoClose`
- Rename `closingPlates` → `closingStockAtManualClose`
- Drop `manualClosePlates`
- Update `driftPlates = currentStock − closingStockAtAutoClose`
- `platesSoldAfterAutoClose` → `platesSoldAtAutoClose`; set value to `snapshot.platesSold − snapshot.platesSoldAtAutoClose` (incremental drift)
- Update all field references throughout

### `backend/routes/dailyReport.ts`
- Snapshot include: add `platesSoldAtAutoClose` to select
- Plate movement row:
  - Remove `expectedClosing` (replaced by Closing Stock formula)
  - Remove `variance`
  - Keep `isLiveCurrent` logic unchanged (uses `shift.isOpen`)
  - Add `driftMinutes` from `shift.driftMinutes`
  - Add `driftSold = snapshot.platesSold − snapshot.platesSoldAtAutoClose`
  - Rename `closingPlates` → `closingStockAtManualClose`
  - Rename `autoClosePlates` → `closingStockAtAutoClose`

### `backend/routes/stockRemaining.ts`
- All `closingPlates` references → `closingStockAtManualClose`

### `backend/routes/shiftCarryOver.ts`
- All `closingPlates` references → `closingStockAtManualClose`

### `backend/routes/menu.ts`
- Check `closingPlates` references; rename if present

### `backend/routes/cookingRecords.ts`
- No changes needed (only uses `openingPlates`)

### `desktop/ui/types/electron.d.ts`
- **ShiftSnapshot interface**: rename `autoClosePlates` → `closingStockAtAutoClose`; remove `manualClosePlates`; rename `platesSoldAfterAutoClose` → `platesSoldAtAutoClose`
- **ShiftPlateMovementRow interface**: rename `expectedClosing` → `closingStock`; remove `variance`; add `driftMinutes`, `driftSold`; rename `closingPlates` → `closingStockAtManualClose`
- **ShiftReportData `plateMovement`**: same changes as ShiftPlateMovementRow

### `desktop/ui/components/reports/ShiftReport.tsx`
- Remove "Variance" column
- Rename "Expected" header → "Closing Stock"; update formula
- Add "Wasted" column
- Rename "At Auto-Close" header → "Auto Closing Stock"
- Add "Drift Minutes" column
- Add "Drift Sold" column
- Rename "Actual Close" header → "Final Closing Stock"
- Remove `expectedClosing`/`variance` from row data object

### `desktop/ui/components/shift/ShiftCloseDialog.tsx`
- Same column renames as ShiftReport

### `desktop/electron/receiptTemplate.ts`
- plateMovement type: rename fields
- Print rendering: update column headers and values to match new layout

### `desktop/electron/receipt.ts`
- Rename `closingPlates` in print output; update column set

## Lifecycle Data Map

| Moment | Fields captured |
|--------|----------------|
| Shift open | `openingPlates` = previous shift's `closingStockAtManualClose` |
| Auto-close tick | `closingStockAtAutoClose = currentStock`; `platesSoldAtAutoClose = current_platesSold` |
| Manual close | `closingStockAtManualClose = currentStock`; `driftPlates = closingStockAtManualClose − closingStockAtAutoClose` |
| Report | `Closing Stock = opening + cooked − sold`; `Drift Sold = platesSold − platesSoldAtAutoClose` |

## Verification Gates

- [ ] `npx prisma migrate dev` succeeds
- [ ] Backend starts without errors
- [ ] `npm run lint` clean
- [ ] `tsc --noEmit` clean
- [ ] Browser: shift report plate movement shows all 9 columns with correct values
- [ ] ShiftCloseDialog plate movement matches ShiftReport
- [ ] Printed receipt shows updated column layout
- [ ] Historical closed shift reports still render correctly
