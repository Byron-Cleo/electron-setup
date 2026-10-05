# Batch Number System + FIFO Enforcement + Shift Tracking Fix

## Status
Not Started

## Goals
1. Fix critical bug in shift carry-over calculation where batchSold incorrectly sums all menu sales for a stock supply
2. Implement per-supply batch numbering (Batch #1, #2 per stock supply)
3. Enforce strict FIFO allocation - cannot allocate from newer batch while older batch has unallocated plates
4. Ensure correct shift-based carry-over: food cooked & sold within same shift does NOT carry over; only genuinely unassigned inventory carries over
5. Enhance UI to display batch numbers in all relevant views
6. Maintain full traceability from cooking → allocation → order → sale

## Critical Bug (Fix First)

### Issue
In `backend/routes/shiftCarryOver.ts` (both `computeAllUnassignedBatches` and `computeExpiredUnassignedBatches`), the `batchSold` calculation is incorrect:

```typescript
// INCORRECT (current)
const batchSold = record.stockSupply.menus.reduce(
  (sum, sm) => sum + (soldByMenu.get(sm.menuId) ?? 0), 0);
```

This sums sold plates for ALL menu items that the stock supply CAN produce, not just those that THIS batch has been allocated to. This causes unassigned inventory to appear lower than it actually is.

### Fix
```typescript
// CORRECT
const totalEverAllocated = record.cookingRecordMenus.reduce(
  (sum, crm) => sum + Number(crm.platesAllocated), 0);
const currentlyAvailable = record.cookingRecordMenus.reduce(
  (sum, crm) => sum + Number(crm.platesRemaining), 0);
const batchSold = totalEverAllocated - currentlyAvailable;
// unassigned = produced - totalEverAllocated (conceptually)
// Also note: actual calculation is unassigned = produced - remainingTotal - batchSold
// where remainingTotal = currentlyAvailable
// So: unassigned = produced - currentlyAvailable - (totalEverAllocated - currentlyAvailable) = produced - totalEverAllocated
```

### Files to Modify
- `backend/routes/shiftCarryOver.ts` - Replace the `batchSold` calculation in:
  - `computeAllUnassignedBatches` (around line 237)
  - `computeExpiredUnassignedBatches` (around line 299)

## Schema Changes

### Prisma Schema
**File:** `backend/prisma/schema.prisma`

Add to `CookingRecord` model:
```prisma
batchNumber      Int?    // Sequence number per stockSupplyId (Batch #1, #2, etc.)
@@unique([stockSupplyId, batchNumber]) // Enforce uniqueness per supply
```

## Backend Implementation

### 1. Backfill Script (New)
**File:** `backend/scripts/backfill-cooking-batch-numbers.ts`

Assign batch numbers per stockSupplyId ordered by `createdAt ASC`:
- Batch #1 = oldest cooking record for that supply
- Batch #2 = second oldest, etc.
- Follow existing backfill script pattern (see `backfill-cooking-shifts.ts`)

### 2. Cooking Records API
**File:** `backend/routes/cookingRecords.ts`

**POST `/` Handler** (Create cooking record):
- Inside transaction, calculate next batch number:
```typescript
const maxBatch = await prisma.cookingRecord.aggregate({
  _max: { batchNumber: true },
  where: { stockSupplyId }
});
const nextBatch = (maxBatch._max.batchNumber ?? 0) + 1;
```
- Include `batchNumber: nextBatch` in create data
- Add retry logic for unique constraint violation (P2002) to handle concurrent creates
- Persist `shiftId` (already implemented via `findShiftIdForTime`)

**POST `/:id/allocate` Handler** (FIFO Enforcement):
- Before allocating, check if older batches have unallocated plates
- Find older batches: `batchNumber < record.batchNumber` for same `stockSupplyId`
- For each older batch, compute:
  ```typescript
  const produced = Number(batch.platesActual ?? batch.platesExpected);
  const totalEverAllocated = batch.cookingRecordMenus.reduce(
    (sum, crm) => sum + Number(crm.platesAllocated), 0);
  const hasUnallocated = produced > totalEverAllocated;
  ```
- If any older batch has unallocated plates, reject with error:
  ```typescript
  return res.status(400).json({ 
    error: `Cannot allocate from batch ${record.batchNumber} while batch ${batch.batchNumber} has unallocated plates` 
  });
  ```

**POST `/:id/menu/:menuId/top-up` Handler** (FIFO Enforcement):
- Same FIFO check as allocate handler

## UI Implementation

### 1. Type Definitions
**File:** `desktop/ui/types/electron.d.ts`

Add to `CookingRecord` interface:
```typescript
batchNumber: number | null;
```

### 2. Kitchen History View
**File:** `desktop/ui/pages/Kitchen.tsx` - `CookingHistoryView` function

**Columns Array:**
Add after "Item" or in logical position:
```typescript
{ label: "Batch", key: "batchNumber" }
```

**renderCell Function:**
Add case for batchNumber:
```typescript
case "batchNumber":
  return <span>#{record.batchNumber ?? '—'}</span>;
```

**Edit Dialog:**
Update dialog title when editing:
```typescript
<DialogTitle>Edit Batch #{editRecord?.batchNumber ?? editRecord?.id.slice(0, 6)}</DialogTitle>
```

## Shift Tracking Notes (Important)

- **Current system is correct**: 
  - Food cooked & sold within same shift → excluded from carry-over (fixed logic ensures correct batchSold calculation)
  - Food cooked but not sold during shift → carries over as unassigned
  - `CookingRecord.shiftId` persists which shift cooking occurred in (via `findShiftIdForTime`)
  - Sales track which shift via `shiftSnapshot.platesSold`

- **Carry-over timing**: Only occurs after shift closure; carry-over logic runs based on cycle boundaries and considers only batches from previous cycles

## Deployment Steps (per AGENTS.md)

1. **Apply schema changes and backfill**:
```bash
npm run db:sync          # Runs db:generate + db:push
```

2. **Build backend**:
```bash
npm run build --prefix backend
```

3. **Restart production service** (requires elevated shell):
```bash
npm run server:restart
```

4. **Verify**:
```bash
npm run server:status    # Should show RUNNING
curl http://localhost:3001/health  # Should return {"status":"ok",...}
```

## Files to Modify/Create

### Create
- `backend/scripts/backfill-cooking-batch-numbers.ts` - Backfill script

### Modify
- `backend/prisma/schema.prisma` - Add batchNumber + unique constraint
- `backend/routes/shiftCarryOver.ts` - Fix batchSold calculation (2 locations)
- `backend/routes/cookingRecords.ts` - 
  - POST /: assign batchNumber (with retry logic)
  - POST /:id/allocate: add FIFO check
  - POST /:id/menu/:menuId/top-up: add FIFO check
- `desktop/ui/types/electron.d.ts` - Add batchNumber to CookingRecord
- `desktop/ui/pages/Kitchen.tsx` - Add Batch column + update edit dialog

## Notes
- Batch numbers are per-stock-supply (independent per ingredient)
- FIFO enforcement prevents reallocation from newer batches until older batches fully allocated
- Backfill will assign sequential batch numbers to existing records ordered by createdAt ASC
- Legacy records with null batchNumber display as "—" in UI (non-backfilled) - backfill should cover all
- Consumption side (orders.ts) already has correct FIFO logic - no changes needed there
- Shift attribution remains unchanged (preserves existing behavior)
```