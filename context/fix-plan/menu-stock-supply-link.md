# Link Menu Items to Stock Supplies via Searchable Dropdown

## Overview

The Cooked Food table in the Menu tab is empty because no StockSupply records have a `menuId` set. The `GET /api/menu/cooked` endpoint requires a Menu → StockSupply relationship (via `menuId`) to find cooked menus. This fix adds a searchable dropdown to the StockSupply creation/edit forms so users can link a stock supply to a menu item by name.

## Problem

- `StockSupply.menuId` is `null` on all records
- The `/menu/cooked` query filters `Menu.StockSupply.some({ isMenuStock: true, CookingRecord: { some: {} } })` — this returns nothing because no StockSupply has a `menuId` linking it to a Menu
- The StockSupply create/edit forms have no field to select a Menu item

## Solution

### Phase 1: Backend — Accept `menuId` in StockSupply CRUD

- Add `menuId` to POST create and PUT update destructuring in `backend/routes/items.ts`
- Pass `menuId` to Prisma create/update data (as optional, nullable field)
- No schema change needed — `menuId String? @db.Uuid` already exists on StockSupply

### Phase 2: Frontend — Reusable SearchableSelect Component

- Create `desktop/ui/components/shared/SearchableSelect.tsx`
- Lightweight combobox: input + filtered dropdown list
- Shows ALL options by default, filters as user types
- Props: `options`, `value`, `onChange`, `placeholder`, `searchPlaceholder`
- Pure Tailwind + React, no new packages

### Phase 3: Frontend — Integrate SearchableSelect into StockSupply Forms

- Add `menuId` to `StockSupplyCreateData` and `StockSupplyUpdateData` types
- Add `menuId` to `createStockSupply()` and `updateStockSupply()` API functions
- Add `menuId: z.string().optional()` to zod schemas
- Add SearchableSelect to `StockSupplyForm.tsx` (show when `isMenuStock` checked)
- Add SearchableSelect to `StockSupplyEditDialog.tsx` (show when `isMenuStock` checked)
- Add SearchableSelect to `Store.tsx` Add Stock Item modal (show when `formIsMenuStock` checked)

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `backend/routes/items.ts` | Accept `menuId` in POST/PUT, pass to Prisma |
| 2 | `desktop/ui/components/shared/SearchableSelect.tsx` | **Create** — reusable searchable dropdown |
| 3 | `desktop/ui/types/electron.d.ts` | Add `menuId` to `StockSupplyCreateData` and `StockSupplyUpdateData` |
| 4 | `desktop/ui/lib/api.ts` | Pass `menuId` in `createStockSupply()` / `updateStockSupply()` |
| 5 | `desktop/ui/pages/admin/StockSupplyForm.tsx` | Add menu SearchableSelect when `isMenuStock` checked |
| 6 | `desktop/ui/components/admin/StockSupplyEditDialog.tsx` | Add menu SearchableSelect when `isMenuStock` checked |
| 7 | `desktop/ui/pages/Store.tsx` | Add menu SearchableSelect to Add Stock Item modal |

## Validation

1. `npx tsc --noEmit` passes (frontend + backend)
2. `npm run lint` passes (no new errors)
3. Create StockSupply with `isMenuStock=true` + menu selected → `menuId` saved in DB
4. Edit StockSupply → menu selection pre-populated, can change or clear
5. Cooked Food table shows items after cooking records exist
6. SearchableSelect shows all menus, filters as user types
