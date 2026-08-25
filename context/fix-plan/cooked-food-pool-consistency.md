# Consistent Available Plates Across Menu Variants of the Same Stock Item

## Overview

When a stock item is cooked (e.g., Chicken → 40 plates), the kitchen can assign those plates to multiple menu variants produced from that stock item (Chicken Fry, Chicken Stew, Chicken Tikka). The **Available** column must reflect a single shared pool per cooking record and be identical across all sibling variants during assignment. Once assigned, each variant's `Menu.stock` becomes independent and is decremented only when THAT variant is ordered by a waiter.

## Problem

- Every assignment **increments only the target variant's** `Menu.stock` (`backend/routes/cookingAssignments.ts` POST ~line 188, PUT ~line 259)
- The available plates shown for menu items read **per-variant stock**: `GET /api/menu` returns `availablePlates: menu.stock` (`backend/routes/menu.ts:169`), and `AllMenuTable.tsx:31` / `WaiterMenuGrid.tsx:39` display `availablePlates ?? stock`
- Result: siblings show different numbers (Fry shows 12 after being assigned 12; Stew shows its own value) — no shared-pool consistency for the assignment workflow

## Confirmed Desired Behavior (user-verified)

Two distinct numbers with separate lifecycles:

1. **Pool Available** (assignment phase) = `produced (CookingRecord.platesActual)` − `Σ(quantityPlates of ALL assignments on that cooking record)`
   - Beef cooked 30 → assign 12 to Beef Fry → **Beef Fry AND Beef Stew both display 18**
   - Assign 10 more to Stew → all three chicken/beef siblings show 8
   - Any sibling can still be assigned from the pool until it reaches 0
   - This number is IDENTICAL on every variant derived from the same stock item's cooking record

2. **Menu.stock** (sales phase) = independent per assigned variant
   - Waiter sells 2 Beef Fry → only Fry drops 12→10; Stew/Tikka untouched
   - Sales NEVER change the pool number or sibling variants
   - Pool check on new assignments stays as-is (`produced − totalAssigned`)

## Solution

### Phase 1: Backend — Serve pool-based availability alongside per-variant stock

- In the menu list endpoints (`GET /api/menu`, `GET /api/menu/cooked`), compute pool availability per menu item by resolving its linked stock supply's cooking records (today/active) and returning e.g. `cooking: { totalProduced, totalAssigned, totalAvailable }` where `totalAvailable = produced − Σ(all sibling assignments)` — identical for all variants sharing the record(s)
- Keep `stock` (per-variant sellable count) unchanged in responses
- Ensure the records queried are the same set for every sibling (query by stockSupplyId, NOT per-menu assignment existence), otherwise totals diverge between siblings

### Phase 2: Frontend — Display rules

- Admin Menu tab "Today's Cooked Food" table + assignment UI (`CookedFoodTable.tsx`, `AssignmentModal.tsx`): Available column = pool `totalAvailable` (already partly implemented at stock level — verify consistency across sibling rows)
- `AllMenuTable.tsx`: plates badge for cooked/unassigned items should use pool availability so sibling rows agree during assignment review
- Waiter side (`WaiterMenuGrid.tsx`, `WaiterOrderContext.tsx`): NO behavior change — keeps selling against each variant's own `Menu.stock`

## Files To Touch

| # | File | Change |
|---|------|--------|
| 1 | `backend/routes/menu.ts` | Compute shared-pool availability per stock supply consistently across siblings |
| 2 | `desktop/ui/components/menu/CookedFoodTable.tsx` | Verify/show pool Available per row |
| 3 | `desktop/ui/components/menu/AssignmentModal.tsx` | Already pool-based — verify refresh reflects cross-sibling changes |
| 4 | `desktop/ui/components/menu/AllMenuTable.tsx` | Use pool availability where appropriate |
| 5 | `desktop/ui/types/electron.d.ts` | Extend types if response shape gains fields |

## Validation

1. Cook Chicken 40 → assign 12 Fry → Fry/Stew/Tikka rows ALL show 28 available
2. Assign 10 Stew → all show 18; add-assignment max input shows 18 on both
3. Sell 2 Fry via waiter order → Fry stock 12→10; Stew/Tikka AND pool number unchanged (pool still 18)
4. Assign remaining pool to zero → further assignment blocked with correct message
5. Edit/delete an assignment → pool number updates identically on all sibling rows
6. `npx tsc --noEmit` + `npm run lint` clean
