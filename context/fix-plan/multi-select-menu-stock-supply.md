# Multi-Select Menu Items for Stock Supplies

## Problem

Currently, a `StockSupply` has a single `menuId` — it can only link to ONE menu item. When the kitchen cooks a stock supply (e.g., 8 kg of Beef → 48 plates), only the one linked menu (e.g., "Beef Fry") can see the produced plates. Other menus that use the same stock supply (e.g., "Beef Stew") have no visibility.

## Solution

Replace the single `menuId` with a many-to-many relationship via a junction table `StockSupplyMenu`. This allows one stock supply to be linked to multiple menus, and each menu sees the shared cooked plates.

## Example Flow

1. Admin creates "Beef" stock supply with `isMenuStock = true` and links it to **both** "Beef Fry" and "Beef Stew"
2. Kitchen cooks 8 kg of Beef → produces 48 plates
3. Menu tab's Cooked Food table shows:
   - **Beef Fry** — Stock Item: Beef, Produced: 48, Assigned: 0, Available: 48
   - **Beef Stew** — Stock Item: Beef, Produced: 48, Assigned: 0, Available: 48
4. User assigns 20 plates to Beef Fry, 28 plates to Beef Stew
5. Both menus now show correct Available counts

## Phases

| Phase | Platform | Description | File |
|-------|----------|-------------|------|
| 1 | Backend | Prisma schema: junction table + migration | `context/features/backend/multi-select-menu-phase-1-schema-migration.md` |
| 2 | Backend | Routes: update create/update/serialize + clean cooking records | `context/features/backend/multi-select-menu-phase-2-routes.md` |
| 3 | Frontend | Create `MultiSearchableSelect` component | `context/features/frontend/multi-select-menu-phase-1-component.md` |
| 4 | Frontend | Update TypeScript types + API layer | `context/features/frontend/multi-select-menu-phase-2-types-api.md` |
| 5 | Frontend | Update forms (Store, EditDialog, StockSupplyForm) + detail display | `context/features/frontend/multi-select-menu-phase-3-forms-display.md` |

## Files Modified

### Backend
- `backend/prisma/schema.prisma` — junction table, remove `menuId` from StockSupply
- `backend/routes/items.ts` — accept `menuIds[]`, update create/update/serialize
- `backend/routes/cookingRecords.ts` — remove `menuId` auto-update logic, update includes
- `backend/routes/menu.ts` — update cooked query for junction table

### Frontend
- `desktop/ui/components/shared/MultiSearchableSelect.tsx` — **new file**
- `desktop/ui/types/electron.d.ts` — `menuId` → `menuIds`, `menu?` → `menus[]`
- `desktop/ui/pages/Store.tsx` — use MultiSearchableSelect in StockView form
- `desktop/ui/components/admin/StockSupplyEditDialog.tsx` — use MultiSearchableSelect
- `desktop/ui/pages/admin/StockSupplyForm.tsx` — use MultiSearchableSelect
- `desktop/ui/components/admin/StockSupplyDetailDialog.tsx` — show multiple menus
- `desktop/ui/lib/api.ts` — update create/update functions for `menuIds`

## What Stays the Same

- `AssignmentModal` flow (assign plates to menus) — no changes needed
- Kitchen tab's cook flow — still records cooking against a stock supply
- Department assignments — already multi-select, untouched
- `SearchableSelect` component — left unchanged, reused elsewhere
