# Kitchen Cooking Production — Complete Plan

## Overview

Connect stock items to menu items through kitchen cooking. Kitchen staff records what was cooked from requested stock, system calculates plates produced, and admin assigns plates to menu variants for waiters to sell.

---

## Implementation Phases

| Phase | File | Focus | Platform |
|-------|------|-------|----------|
| 1 | `kitchen-cooking-phase-1.md` | Schema + Backend Foundation | backend |
| 2 | `kitchen-cooking-phase-2.md` | Kitchen Tab UI | frontend |
| 3 | `kitchen-cooking-phase-3.md` | Menu Tab — Cooked Food | frontend |
| 4 | `kitchen-cooking-phase-4.md` | Menu Tab — Plate Assignment | frontend |
| 5 | `kitchen-cooking-phase-5.md` | Daily Report + Carry Over | backend |
| 6 | `waiter-availability-phase-6.md` | Waiter UI Update | frontend |

---

## The Complete Flow

```
STOCK REQUEST → FULFILLMENT → KITCHEN COOKING → PLATE ASSIGNMENT → WAITER SALES
```

### Visual Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KITCHEN → MENU → WAITER FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. STOCK REQUEST (Kitchen)                                                 │
│     Kitchen requests: 20 chicken pieces                                     │
│     Store fulfills → StockRequestItem.quantityDelivered = 20                │
│                                                                             │
│  2. KITCHEN COOKING (Kitchen Tab)                                           │
│     Kitchen cooks 12 pieces (8 remain PENDING COOK)                         │
│     Expected: 12 × 4 (platesPerUnit) = 48 plates                           │
│     Actual: 45 plates (kitchen inputs)                                      │
│     → CookingRecord created with platesActual = 45                          │
│                                                                             │
│  3. PLATE ASSIGNMENT (Menu Tab)                                             │
│     Admin assigns 45 plates to menu variants:                               │
│     - Chicken Fry: 20 plates                                                │
│     - Chicken Stew: 25 plates                                               │
│     → CookingRecordAssignment records created                               │
│                                                                             │
│  4. WAITER SALES (Frontend)                                                 │
│     Customer orders: 15 Chicken Fry                                         │
│     Available: 20 - 15 = 5 remaining                                        │
│     → Auto-deduct from Menu.availablePlates                                 │
│                                                                             │
│  5. REPLENISHMENT (When Sold Out)                                           │
│     Chicken Fry SOLD OUT (0 remaining)                                      │
│     Kitchen cooks more from PENDING COOK stock                              │
│     → New CookingRecord, new assignments                                    │
│                                                                             │
│  6. END OF DAY                                                              │
│     Unsold plates: 5 Fry + 20 Stew = carry to tomorrow                     │
│     Uncooked stock: 8 chicken = carry to tomorrow (PENDING COOK)            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Two Types of Stock Items

| Type | platesPerUnit | Example | Tracked? |
|------|---------------|---------|----------|
| **Ingredient** | Has value (e.g., 4) | Chicken, Fish, Beef | Yes → becomes menu items |
| **Supply** | NULL or 0 | Oil, Salt, Onions | No → just consumed |

**Rule:** Only stock items with `platesPerUnit > 0` appear in kitchen cooking form and menu generation.

### Two Inventory Tracking

| Inventory | What | Carries Over? |
|-----------|------|---------------|
| **Raw Stock (PENDING COOK)** | Ordered but not yet cooked | Yes → cook tomorrow |
| **Cooked Plates** | Produced but not yet sold | Yes → sell tomorrow |

### Kitchen vs Menu Responsibilities

| Action | Who | Where |
|--------|-----|-------|
| Record cooking amount | Kitchen staff | Kitchen Tab |
| Input actual plates produced | Kitchen staff | Kitchen Tab |
| Assign plates to menu variants | Admin | Menu Tab |
| Add more plates when sold out | Kitchen cooks, then Admin assigns | Both tabs |

---

## Files Summary

### New Files (6)

| File | Phase | Purpose |
|------|-------|---------|
| backend/routes/cookingAssignments.ts | 1 | Assignment CRUD |
| backend/routes/kitchenInventory.ts | 1 | Kitchen inventory endpoint |
| backend/routes/dailyReport.ts | 5 | Daily report endpoint |
| desktop/ui/components/menu/CookedFoodTable.tsx | 3 | Cooked food display |
| desktop/ui/components/menu/AssignmentModal.tsx | 4 | Plate assignment UI |

### Modified Files (11)

| File | Phase | Changes |
|------|-------|---------|
| backend/prisma/schema.prisma | 1 | Add platesActual, cookedDate, CookingRecordAssignment |
| backend/routes/cookingRecords.ts | 1, 5 | Enhance with date filtering, actual plates, carry over |
| backend/app.ts | 1, 5 | Register new routes |
| desktop/ui/pages/Kitchen.tsx | 2 | Filter by platesPerUnit, date selector |
| desktop/ui/components/kitchen/CookingRecordForm.tsx | 2 | PENDING stock display, platesActual input |
| desktop/ui/components/kitchen/CookingHistoryTable.tsx | 2 | Variance column, date filter |
| desktop/ui/pages/Menu.tsx | 3, 4 | Cooked food tab, assignment UI |
| desktop/ui/components/menu/MenuForm.tsx | 3 | Stock item dropdown (filtered) |
| desktop/ui/lib/api.ts | 1-6 | Add all new API functions |
| desktop/ui/types/electron.d.ts | 1-4 | Add new types |
| desktop/ui/pages/waiterPos/WaiterMenu.tsx | 6 | Use availablePlates, disable when sold out |

### Total: 17 files (6 new, 11 modifications)

---

## Schema Changes

### Modify: CookingRecord

```prisma
model CookingRecord {
  // ... existing fields
  platesActual    Decimal?  @db.Decimal(12, 2)  // NEW: actual plates produced
  cookedDate      DateTime  @default(now()) @db.Date  // NEW: for daily reset
  assignments     CookingRecordAssignment[]  // NEW: menu assignment relation
}
```

### New: CookingRecordAssignment

```prisma
model CookingRecordAssignment {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cookingRecordId   String        @db.Uuid
  menuId            String        @db.Uuid
  quantityPlates    Decimal       @db.Decimal(12, 2)
  createdAt         DateTime      @default(now())
  cookingRecord     CookingRecord @relation(fields: [cookingRecordId], references: [id], onDelete: Cascade)
  menu              Menu          @relation(fields: [menuId], references: [id])

  @@unique([cookingRecordId, menuId])
}
```

---

## API Endpoints Summary

### Phase 1 (Backend Foundation)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/cooking-records?date= | List cooking records by date |
| POST | /api/cooking-records | Create cooking record |
| PUT | /api/cooking-records/:id | Update platesActual |
| GET | /api/cooking-assignments/available?date= | Get available plates per variant |
| POST | /api/cooking-assignments | Assign plates to menu variant |
| PUT | /api/cooking-assignments/:id | Update assignment |
| DELETE | /api/cooking-assignments/:id | Remove assignment |
| GET | /api/kitchen/inventory | Kitchen inventory with PENDING stock |

### Phase 5 (Daily Report)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/reports/daily?date= | Daily cooking/sales report |
| GET | /api/cooking-records/carry-over | Raw stock carry over |
| GET | /api/cooking-assignments/carry-over | Cooked plates carry over |

---

## Validation Rules

### Cooking Record
1. `stockSupplyId` must reference a StockSupply with `platesPerUnit > 0`
2. `quantityCooked` must be > 0
3. `quantityCooked` cannot exceed rawStockPending (ordered - already cooked)
4. `platesActual` is optional but if provided must be > 0
5. `cookedDate` is auto-set to today

### Assignment
1. `cookingRecordId` must reference a valid CookingRecord
2. `menuId` must reference a Menu linked to the same stock supply
3. `quantityPlates` must be > 0
4. `quantityPlates` cannot exceed unassigned plates from cooking record
5. Total assignments per cooking record cannot exceed `platesActual`

### Menu Item
1. `stockSupplyId` must reference a StockSupply with `platesPerUnit > 0`
2. One stock supply can link to multiple menu items (variants)

---

## Edge Cases

### Cooking
- **Zero PENDING stock:** Show "No stock available to cook" message
- **Actual > Expected:** Allow (kitchen produced more than configured rate)
- **Actual < Expected:** Allow (kitchen produced less than configured rate)
- **No platesPerUnit:** Item not shown in cooking form

### Assignment
- **Over-assignment:** Block if total assignments exceed platesActual
- **Remove assignment:** Plates return to unassigned pool
- **Edit assignment:** Validate new total doesn't exceed available

### Carry Over
- **Raw stock:** Stays in PENDING COOK state, visible tomorrow
- **Cooked plates:** Carry to tomorrow, available for new assignments
- **Date boundary:** Reset at midnight, new day starts fresh

---

## Implementation Order

1. **Phase 1** — Backend Foundation (must be first)
2. **Phase 2** — Kitchen Tab UI (depends on Phase 1)
3. **Phase 3** — Menu Tab Cooked Food (depends on Phase 1)
4. **Phase 4** — Menu Tab Assignment (depends on Phase 3)
5. **Phase 5** — Daily Report (depends on Phase 1)
6. **Phase 6** — Waiter UI (depends on Phase 1)

**Note:** Phases 2, 3, 5, 6 can be done in parallel after Phase 1.
**Note:** Phase 4 must be done after Phase 3.
