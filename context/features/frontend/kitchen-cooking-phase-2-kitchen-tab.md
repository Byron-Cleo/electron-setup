# Kitchen Cooking Production — Phase 2: Kitchen Tab UI

## Platform

frontend

## Status

Not Started

## Goals

- Filter kitchen stock items to only those with `platesPerUnit` configured
- Add date selector for viewing different days
- Enhance cooking modal with PENDING stock display and platesActual input
- Update cooking history table with variance column and date filter

## Notes

- Only stock items with `platesPerUnit > 0` appear in kitchen cooking table
- Kitchen staff ONLY records cooking — they do NOT assign plates to variants
- Conversion rate can vary from configured value (kitchen inputs actual)
- This phase depends on Phase 1 (backend API must be ready)

## Backend Dependency

This phase uses endpoints created in Phase 1:
- `GET /api/kitchen/inventory` — kitchen stock items
- `GET /api/cooking-records?date=` — cooking history
- `POST /api/cooking-records` — create cooking record

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/pages/Kitchen.tsx | Modify | Filter by platesPerUnit, add date selector, update cooking tab |
| desktop/ui/components/kitchen/CookingRecordForm.tsx | Modify | Show PENDING stock, add platesActual input, expected plates display |
| desktop/ui/components/kitchen/CookingHistoryTable.tsx | Modify | Add variance column, date filter, formatted timestamps |
| desktop/ui/lib/api.ts | Modify | Add kitchen inventory and cooking record API functions |
| desktop/ui/types/electron.d.ts | Modify | Add new types for KitchenStockItem, CookingRecord |

---

## Tasks

### Task 1: Add API Functions

1. Open `desktop/ui/lib/api.ts`
2. Add `getKitchenInventory(date?: string)` function
3. Add `getCookingRecords(date?: string, stockSupplyId?: string)` function
4. Add `createCookingRecord(data: CreateCookingRecordData)` function
5. Add `updateCookingRecord(id: string, data: UpdateCookingRecordData)` function

### Task 2: Add TypeScript Types

1. Open `desktop/ui/types/electron.d.ts`
2. Add `KitchenStockItem` interface
3. Add `CookingRecord` interface (with platesActual, cookedDate)
4. Add `CreateCookingRecordData` interface
5. Add `UpdateCookingRecordData` interface

### Task 3: Update Kitchen Tab

1. Open `desktop/ui/pages/Kitchen.tsx`
2. Fetch kitchen inventory on mount (only items with platesPerUnit)
3. Add date selector dropdown (Today, Yesterday, Custom)
4. Filter cooking records by selected date
5. Display stock items in table with: Name, Plates/Unit, Ordered, Cooked, Remaining, Plates Made
6. Add "Cook More" button per row (opens cooking modal)

### Task 4: Enhance Cooking Modal

1. Open `desktop/ui/components/kitchen/CookingRecordForm.tsx`
2. Show PENDING stock (ordered - cooked) at top
3. Add quantity input with max validation (cannot exceed PENDING)
4. Show configured platesPerUnit rate
5. Auto-calculate expected plates (quantity × platesPerUnit)
6. Add "Actual Plates Produced" input field
7. Add notes textarea
8. Validate: quantity > 0, actual plates > 0

### Task 5: Update Cooking History Table

1. Open `desktop/ui/components/kitchen/CookingHistoryTable.tsx`
2. Add "Variance" column (Actual - Expected)
3. Color code variance: green if positive, red if negative, gray if zero
4. Add date filter (matches parent date selector)
5. Format timestamps nicely

---

## UI Mockups

### Kitchen Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Kitchen Stock — Cooking Production                                              │
│  Date: [Today ▼]                                                                │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Stock Item   │ Plates/Unit │ Ordered │ Cooked │ Remaining │ Plates Made  │  │
│  │  ─────────────┼─────────────┼─────────┼────────┼───────────┼───────────── │  │
│  │  Chicken      │ 4           │ 20      │ 12     │ 8 PENDING │ 45          │  │
│  │  [Cook More]  │             │         │        │           │              │  │
│  │  ─────────────┼─────────────┼─────────┼────────┼───────────┼───────────── │  │
│  │  Fish         │ 3           │ 15      │ 15     │ 0         │ 45          │  │
│  │  [Cook More]  │             │         │        │           │              │  │
│  │  ─────────────┼─────────────┼─────────┼────────┼───────────┼───────────── │  │
│  │  Beef         │ 2           │ 10      │ 6      │ 4 PENDING │ 12          │  │
│  │  [Cook More]  │             │         │        │           │              │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  💡 PENDING = Ordered but not yet cooked (carries to tomorrow)                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cooking Modal

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Cook: Chicken                                                                  │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Stock Ordered: 20 pieces                                                       │
│  Already Cooked: 12 pieces                                                      │
│  Remaining (PENDING): 8 pieces                                                  │
│                                                                                 │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Quantity to Cook: [____] pieces                                                │
│                                                                                 │
│  Configured Rate: 4 plates per piece                                            │
│  Expected Plates: 32 (= 8 × 4)                                                 │
│                                                                                 │
│  Actual Plates Produced: [____]                                                 │
│  (Kitchen inputs what was actually produced)                                    │
│                                                                                 │
│  Notes: [________________________________]                                      │
│                                                                                 │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  [Cancel]  [Record Cooking]                                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cooking History

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Cooking History — Today                                                         │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Time     │ Item    │ Cooked │ Expected │ Actual │ Variance │ Notes       │  │
│  │  ─────────┼─────────┼────────┼──────────┼────────┼──────────┼─────────── │  │
│  │  14:30    │ Chicken │ 12 pcs │ 48       │ 45     │ -3       │ Lunch batch│  │
│  │  13:00    │ Fish    │ 15 pcs │ 45       │ 45     │ 0        │ Full batch │  │
│  │  11:30    │ Beef    │ 6 pcs  │ 12       │ 12     │ 0        │ Breakfast  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  Variance = Actual - Expected (negative = under-produced)                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## State Management

```typescript
interface KitchenCookingState {
  selectedDate: Date;
  stockItems: KitchenStockItem[];
  cookingRecords: CookingRecord[];
  isLoading: boolean;
}

interface KitchenStockItem {
  stockSupplyId: string;
  name: string;
  platesPerUnit: number;
  totalOrdered: number;
  totalCooked: number;
  rawStockPending: number;
  totalPlatesProduced: number;
}
```

---

## Testing Checklist

- [ ] Kitchen tab only shows items with platesPerUnit configured
- [ ] Date selector filters records correctly
- [ ] Cooking modal shows PENDING stock (ordered - cooked)
- [ ] Expected plates auto-calculates correctly
- [ ] platesActual input saves correctly
- [ ] History shows variance column with correct colors
- [ ] API functions work correctly
- [ ] Loading and error states handled
- [ ] All components use shadcn/ui primitives
