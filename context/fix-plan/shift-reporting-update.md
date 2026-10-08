## Shift Reporting Update

### Objective
Update shift reporting to:
1. Filter orders using mutually exclusive shift time windows (based on actual shift operation times), not just shift.orders or operationDay filtering alone. This ensures correct attribution of orders including drift periods and prevents double-counting when shifts overlap.
2. Show both incoming and outgoing unassigned cooked food in shift reports and close dialog.
3. Rename Plate Movement column labels for clarity.
4. Remove unused /api/reports/daily endpoint (if present in source).

### Key Principle: Mutually Exclusive Time Windows
Order attribution must be strictly based on actual shift operations with no overlap between consecutive shifts:

- **operationDay is immutable**: Determined by shift.autoOpenTime at creation and never changes, even if the shift runs across midnight.
- **Actual end time**: finalClosedAt (if finalCloseSource === "MANUAL"), else autoClosedAt (if exists), else autoCloseTime (fallback).
- **Effective start time**: max(shift.autoOpenTime, previousShift.actualEndTime). This ensures the next shift starts at the actual close time of the previous shift, preventing double-counting.
- **Effective end time**: shift's actual end time (exclusive bound for filtering).
- **No splitting by calendar day**: Orders across midnight remain with the shift that owns them under that shift's operationDay.
- **Drift periods belong to the extending shift**: When a manual shift extends past scheduled end, all orders in that period belong to the manual shift.

### Example Scenario
- **Shift A** (Manual): Scheduled 8:00AM - 2:00PM, manually closed at 4:00PM (2-hour drift)
- **Shift B** (Auto): Scheduled 2:00PM - 11:00PM, auto-closes at 11:00PM

- **Shift A effective window**: [8:00AM, 4:00PM)
  - Starts at its defined start time (8:00AM) which determined its operationDay
  - Ends at its actual manual close time (4:00PM)
  - This captures all drift period orders (2:00PM - 4:00PM) under Shift A
  - All these orders belong to Shift A's operationDay (determined by its 8:00AM start)

- **Shift B effective window**: [4:00PM, 11:00PM)
  - Effective start = max(Shift B's scheduled start time, Shift A's actual end time) = max(2:00PM, 4:00PM) = 4:00PM
  - Effective end = Shift B's actual close time (11:00PM)
  - This ensures Shift B does NOT include the 2:00PM - 4:00PM drift period orders (those belong to Shift A), avoiding double-counting
  - Orders in this window belong to Shift B's operationDay (determined by Shift B's defined start time of 2:00PM)

### Implementation Logic
For each shift's report:
1. Determine actual end time of current shift:
   - If finalCloseSource === "MANUAL" and finalClosedAt exists → use finalClosedAt
   - Else if autoClosedAt exists → use autoClosedAt
   - Else → fallback to autoCloseTime
2. Find previous shift (chronologically, latest autoOpenTime < current shift.autoOpenTime) and compute its actual end time using same logic
3. Compute effectiveStart = max(shift.autoOpenTime, previousShift.actualEndTime if exists)
4. Compute effectiveEnd = current shift's actual end time (exclusive bound)
5. Filter orders and cooking records using [effectiveStart, effectiveEnd)

This approach gives us clean, non-overlapping time windows where every order belongs to exactly one shift, with drift orders correctly assigned to the manually extended shift under its proper operationDay.

### Files to Change
- backend/routes/dailyReport.ts
- desktop/ui/types/electron.d.ts
- desktop/electron/receiptTemplate.ts
- desktop/electron/receipt.ts
- desktop/ui/components/reports/ShiftReport.tsx
- desktop/ui/components/shift/ShiftCloseDialog.tsx

### Validation
- Type-check: npx tsc -b and npx tsc --noEmit -p backend/tsconfig.json
- Lint: npx eslint on changed files
- Dev smoke test: http://localhost:5123
  - Shift report totalOrders matches correct count for the shift's effective window
  - Unassigned In/Out panels present
  - Plate Movement columns show Sold and Closing-Sale
  - /api/reports/daily returns 404 (if it existed)