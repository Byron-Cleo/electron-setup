# Kitchen Cooking Production — Phase 3: Menu Tab — Cooked Food Management

## Platform

frontend

## Status

Not Started

## Goals

- Create CookedFoodTable component to display cooked food from kitchen
- Update MenuForm with stock item dropdown (filtered by platesPerUnit)
- Display cooked food with available plates per variant

## Notes

- Menu tab has no existing data — this is all new content
- Only stock items with `platesPerUnit > 0` appear in stock dropdown
- One stock item can produce multiple menu variants (e.g., Chicken → Fry, Stew)
- This phase depends on Phase 1 (backend API must be ready)

## Backend Dependency

This phase uses endpoints created in Phase 1:
- `GET /api/cooking-assignments/available?date=` — cooked food with assignments
- `GET /api/kitchen/inventory` — stock items with platesPerUnit

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/pages/Menu.tsx | Modify | Add cooked food management tab |
| desktop/ui/components/menu/CookedFoodTable.tsx | **Create** | New component for cooked food display |
| desktop/ui/components/menu/MenuForm.tsx | Modify | Add stock item dropdown (filtered) |
| desktop/ui/lib/api.ts | Modify | Add assignment and availability API functions |

---

## Tasks

### Task 1: Add API Functions

1. Open `desktop/ui/lib/api.ts`
2. Add `getCookingAssignments(date?: string)` function
3. Add `getMenuAvailability()` function
4. Add `getStockSuppliesWithPlatesPerUnit()` function (or filter existing)

### Task 2: Create CookedFoodTable Component

1. Create `desktop/ui/components/menu/CookedFoodTable.tsx`
2. Display table with columns: Stock Item, Total Produced, Assigned, Available, Variants
3. Show date selector at top
4. Show "Assign..." button per row (opens assignment modal in Phase 4)
5. Show variant list with plate counts in parentheses
6. Show "SOLD OUT" badge when available = 0

### Task 3: Update Menu Tab

1. Open `desktop/ui/pages/Menu.tsx`
2. Add "Cooked Food" section/tab
3. Render CookedFoodTable component
4. Add "+ Create New Menu Item" button
5. Wire up to assignment modal (Phase 4 will complete this)

### Task 4: Update MenuForm

1. Open `desktop/ui/components/menu/MenuForm.tsx`
2. Add "Stock Item" dropdown field
3. Filter dropdown to only show stock items with `platesPerUnit > 0`
4. Link menu item to selected stock supply
5. Update form validation schema

---

## UI Mockups

### Cooked Food Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Menu — Cooked Food & Variants                                                   │
│  Date: [Today ▼]                                                                │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Stock Item   │ Produced │ Assigned │ Available │ Variants                │  │
│  │  ─────────────┼──────────┼──────────┼───────────┼───────────────────────  │  │
│  │  Chicken      │ 45       │ 20       │ 25        │ Fry(20) Stew(25)       │  │
│  │  [Assign...]  │          │          │           │                         │  │
│  │  ─────────────┼──────────┼──────────┼───────────┼───────────────────────  │  │
│  │  Fish         │ 45       │ 45       │ 0         │ Fry(25) Stew(20)       │  │
│  │  [Assign...]  │          │          │ (SOLD OUT)│                         │  │
│  │  ─────────────┼──────────┼──────────┼───────────┼───────────────────────  │  │
│  │  Beef         │ 12       │ 8        │ 4         │ Curry(8)               │  │
│  │  [Assign...]  │          │          │           │                         │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  [+ Create New Menu Item]                                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Menu Form with Stock Dropdown

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Create Menu Item                                                                │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Name: [________________]                                                       │
│                                                                                 │
│  Stock Item: [Chicken ▼]  ← dropdown shows ONLY items with platesPerUnit > 0   │
│                                                                                 │
│  Category: [________________]                                                   │
│                                                                                 │
│  Price: [____]                                                                  │
│                                                                                 │
│  Description: [________________]                                                │
│                                                                                 │
│  [Cancel]  [Create Menu Item]                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## State Management

```typescript
interface MenuCookedState {
  selectedDate: Date;
  cookedItems: CookedItemWithAssignments[];
  menuVariants: MenuItem[];
  isLoading: boolean;
}

interface CookedItemWithAssignments {
  stockSupplyId: string;
  stockSupplyName: string;
  totalPlatesProduced: number;
  totalPlatesAssigned: number;
  totalPlatesAvailable: number;
  assignments: PlateAssignment[];
}

interface PlateAssignment {
  id: string;
  menuId: string;
  menuName: string;
  quantityPlates: number;
  sold: number;
  remaining: number;
}
```

---

## Testing Checklist

- [ ] CookedFoodTable displays correctly
- [ ] Table shows only items with platesPerUnit configured
- [ ] Date selector filters data correctly
- [ ] Available plates calculated correctly (produced - assigned)
- [ ] Variants listed with plate counts
- [ ] SOLD OUT badge shows when available = 0
- [ ] MenuForm has stock item dropdown
- [ ] Dropdown only shows items with platesPerUnit > 0
- [ ] Menu item links to stock supply correctly
- [ ] API functions work correctly
- [ ] Loading and error states handled
