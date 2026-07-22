# Add `isMenuStock` Flag to StockSupply

## Overview

Replace the `platesPerUnit > 0` check with a dedicated `isMenuStock` boolean field. Currently `platesPerUnit` serves double duty as both a flag and a value. This fix separates concerns: `isMenuStock` = "is this stock used for menu items?", `platesPerUnit` = "how many plates does one unit produce?".

## Problem

`platesPerUnit > 0` is used as a proxy to determine if a stock item is menu-related. This is fragile — a zero value could be intentional, and the semantic meaning is unclear from the field name alone.

## Solution

### 1. Database
- Add `isMenuStock Boolean @default(false)` to `StockSupply` in Prisma schema
- Run `npx prisma db push` + `npx prisma generate`

### 2. Backend Routes
- `kitchenInventory.ts` — Filter by `isMenuStock: true` instead of `platesPerUnit: { not: null }` + JS filter
- `cookingRecords.ts` — Validate `stockSupply.isMenuStock` instead of `!stockSupply.platesPerUnit`
- `items.ts` — Include `isMenuStock` in select/return
- `kitchenConfig.ts` — Include `isMenuStock` in responses

### 3. Frontend Types
- Add `isMenuStock: boolean` to `StockSupply`, `KitchenStockItem`, `KitchenConfigItem`, `KitchenInventory`

### 4. Frontend Components
- `MenuForm.tsx` — Filter stock dropdown by `isMenuStock` instead of `platesPerUnit > 0`
- `Kitchen.tsx` — Use `item.isMenuStock` for Cook button disabled check
- `StockSupplyForm.tsx` — Add `isMenuStock` toggle field
- `StockSupplyEditDialog.tsx` — Add `isMenuStock` toggle
- `StockSupplyDetailDialog.tsx` — Show `isMenuStock` status

### 5. KitchenStockConfig
- No functional change — still configures `platesPerUnit` for menu stock items
- Dropdown should filter to only `isMenuStock: true` items

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | Add `isMenuStock Boolean @default(false)` |
| 2 | `backend/routes/kitchenInventory.ts` | Filter by `isMenuStock: true` |
| 3 | `backend/routes/cookingRecords.ts` | Validate `isMenuStock` |
| 4 | `backend/routes/items.ts` | Include `isMenuStock` |
| 5 | `backend/routes/kitchenConfig.ts` | Include `isMenuStock` |
| 6 | `desktop/ui/types/electron.d.ts` | Add `isMenuStock` to interfaces |
| 7 | `desktop/ui/components/MenuForm.tsx` | Filter by `isMenuStock` |
| 8 | `desktop/ui/pages/Kitchen.tsx` | Use `isMenuStock` for disabled check |
| 9 | `desktop/ui/pages/admin/StockSupplyForm.tsx` | Add `isMenuStock` toggle |
| 10 | `desktop/ui/components/admin/StockSupplyEditDialog.tsx` | Add `isMenuStock` toggle |
| 11 | `desktop/ui/components/admin/StockSupplyDetailDialog.tsx` | Show `isMenuStock` |
| 12 | `desktop/ui/components/admin/KitchenStockConfig.tsx` | Filter dropdown by `isMenuStock` |

## Validation

1. `npx prisma db push` succeeds
2. `npx tsc --noEmit` passes (frontend + backend)
3. `npm run lint` passes (no new errors)
4. Stock supply create/edit forms show `isMenuStock` toggle
5. Kitchen inventory only shows `isMenuStock: true` items
6. MenuForm stock dropdown only shows `isMenuStock: true` items
7. Cooking validation checks `isMenuStock` not `platesPerUnit`
