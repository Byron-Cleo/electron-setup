# Shift-Scoped Stock & Assignment

## Overview

When a new shift opens, production data ("Produced: X plates") from the **previous shift** bleeds into the current shift's AssignmentModal and CookedFoodTable. This is confusing because no cooking has happened yet in the current shift. All data — produced, opening stock, unassigned carry-over — must be shift-scoped. Additionally, a new "Remaining Stock" card is needed to handle carry-over assignment at the start of a new shift.

## Problem

- **AssignmentModal** shows "Produced: X plates" for cooking records from the **previous shift** — not shift-scoped
- **CookedFoodTable** shows all cooking records for the day, mixing previous-shift and current-shift data
- **Opening stock** at shift start = `Menu.stock` (global), doesn't include unassigned produced plates from previous shift
- **Produced** = `CookingRecord.platesActual/Expected` (global), not scoped to current shift
- **Unassigned plates** from previous shift are not tracked or displayed separately
- **Plate movement report** doesn't show carry-forward or unassigned carry-over

### Current State

| Metric | How Tracked | Shift-Scoped? |
|---|---|---|
| Opening stock | `ShiftSnapshot.openingPlates` = `Menu.stock` at open | Partially (no carry-over) |
| Produced | `CookingRecord.platesActual/Expected` (global) | No |
| Sold | `ShiftSnapshot.platesSold` (incremented per order) | Yes |
| Closing stock | `ShiftSnapshot.closingPlates` = `Menu.stock` at close | Yes |
| Unassigned | Not tracked separately | No |

## Confirmed Desired Behavior (user-verified)

Three distinct numbers with separate lifecycles:

1. **Opening stock** (shift start) = previous shift's `closingPlates` + unassigned produced carry-over per menu
   - Set once at shift open in `ShiftSnapshot.openingPlates`
   - Includes carry-forward from previous shift

2. **Produced this shift** = only cooking records created **within the current shift's time window** `[openingTime, autoCloseTime)`
   - At shift start: 0 (no cooking yet)
   - Incremented as kitchen cooks during the shift
   - Same scoping as `soldThisShift` already uses

3. **Sold this shift** = `ShiftSnapshot.platesSold` (already correct, unchanged)

### Data Already Available (no schema changes needed)

- `ShiftSnapshot.closingPlates` — previous shift's closing per menu
- `CookingRecordMenu.platesRemaining` — unassigned plates per menu from assigned splits
- `CookingRecord.createdAt` — can filter by shift time window
- `StockSupplyMenu` — links stock supply to menus (determines which menus a batch feeds)
- Carry-over calculation logic already exists in `dailyReport.ts` (lines 212-235)

## Solution

### Task 1: Backend — New Endpoint `GET /api/stock/remaining`

**File:** `backend/routes/stockRemaining.ts` (new)

Returns carry-forward per menu + total unassigned from the previous shift.

- Find the previous closed shift (most recent closed shift before today)
- For each active menu: `carryForward = ShiftSnapshot.closingPlates` from previous shift
- Find unassigned plates from previous shift's cooking records:
  - Cooking records where `createdAt` falls in previous shift's `[openingTime, autoCloseTime)` window
  - `platesActual/platesExpected` minus sum of `CookingRecordMenu.platesAllocated` = unassigned
- Group unassigned by stock supply (for display in Remaining Stock card)
- Return shape:

```json
{
  "previousShift": { "id": "...", "type": "DAY", "date": "...", "closeTime": "..." },
  "carryForwardPerMenu": [
    { "menuId": "...", "menuName": "Grilled Fish", "closingPlates": 10, "stockSupplyId": "...", "stockSupplyName": "Fish" }
  ],
  "unassignedBatches": [
    {
      "cookingRecordId": "...",
      "stockSupplyName": "Fish",
      "stockSupplyId": "...",
      "totalProduced": 20,
      "totalAssigned": 17,
      "unassigned": 3,
      "menus": [
        { "menuId": "...", "menuName": "Grilled Fish", "platesAllocated": 10 },
        { "menuId": "...", "menuName": "Fish Stew", "platesAllocated": 7 }
      ]
    }
  ]
}
```

### Task 2: Frontend — New `RemainingStockCard` Component

**File:** `desktop/ui/components/menu/RemainingStockCard.tsx` (new)

Displays carry-forward stock and unassigned production from the previous shift at the start of a new shift.

- Summary header: "Remaining Stock from Previous Shift"
- Per-menu table: Menu Name | Carry-Forward (Closing) | Stock Supply
- Unassigned batches section: list of cooking records with unassigned plates
  - Each batch: Stock Supply Name | Produced | Assigned | Unassigned
  - Button to open `AssignmentModal` for each unassigned batch
- Empty state when no carry-over exists
- Hidden/removed once all unassigned batches are assigned

### Task 3: Frontend — Filter `CookedFoodTable` to Current Shift Only

**File:** `desktop/ui/components/menu/CookedFoodTable.tsx`

- Fetch the current open shift's time window (`openingTime`, `autoCloseTime`)
- Filter cooking records to only show those where `createdAt` falls within `[openingTime, windowEnd)`
- If no current shift exists, show empty state
- Table only shows production from the current shift

### Task 4: Frontend — Scope `AssignmentModal` Produced to Current Shift

**File:** `desktop/ui/components/menu/AssignmentModal.tsx`

- Fetch the current shift's time window when modal opens
- Check if the loaded cooking record's `createdAt` falls within the current shift's window
- If **current shift**: show "Produced: X plates" (normal behavior)
- If **previous shift**: show "Carry-over: X plates" instead of "Produced"
- Opening stock per menu in the modal should reflect the carry-forward value

### Task 5: Backend — Update Shift Open to Calculate Carry-Forward

**File:** `backend/routes/shifts.ts` POST `/open`

When creating the opening snapshot:

1. Find the previous shift (most recent closed shift before today)
2. If previous shift exists:
   - For each active menu, get `closingPlates` from previous shift's snapshot
   - Find unassigned plates from previous shift's cooking records:
     - Cooking records with `createdAt` in previous shift's window
     - `platesActual/platesExpected` minus sum of `CookingRecordMenu.platesAllocated`
   - `openingPlates = closingPlates + unassignedCarryOver` (distributed per menu via `StockSupplyMenu` links)
3. If no previous shift: `openingPlates = Menu.stock` (current behavior)

### Task 6: Backend + Frontend — Update Plate Movement Report

**Files:**
- `backend/routes/dailyReport.ts` (shift report endpoint)
- `desktop/ui/components/reports/ShiftReport.tsx`
- `desktop/ui/components/shift/ShiftCloseDialog.tsx`

Plate movement per menu shows:

```
Menu          | Opening (carry-forward) | Produced (this shift) | Sold (this shift) | Closing
Grilled Fish  | 10                      | 0                     | 0                 | 10
Fish Stew     | 7                       | 0                     | 0                 | 7

Total Unassigned Carry-over: 3 plates
```

- `openingPlates` = carry-forward (previous closing + unassigned)
- `produced` = only cooking records created in this shift's window
- `sold` = `ShiftSnapshot.platesSold`
- `closing` = actual closing from snapshot
- "Unassigned Carry-over" summary row at top of plate movement table
- Opening column header renamed to "Opening (carry-forward)" for clarity

## Notes

- No schema changes required — all data is already in existing tables
- The existing carry-over calculation in `dailyReport.ts` (lines 212-235) can be reused/adapted for the new endpoint
- `Menu.stock` is global (sum of all `CookingRecordMenu.platesRemaining`) — opening snapshot is what makes it shift-scoped
- AssignmentModal's `allocateCookingRecord` endpoint can be reused for assigning carry-over plates
- Branch naming: `feature/admin/shift-scoped-stock-assignment`
