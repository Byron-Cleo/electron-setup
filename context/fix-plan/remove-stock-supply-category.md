# Remove StockSupplyCategory

## Overview

Remove the StockSupplyCategory model and all references. Stock supplies will no longer have categories.

## Problem

StockSupplyCategory adds complexity (CRUD pages, forms, filters, FK relationships) without clear value now that stock supplies have images for visual identification.

## Solution

### 1. Database
- Remove `StockSupplyCategory` model from Prisma schema
- Remove `categoryId` field + `category` relation from `StockSupply`
- Create migration to drop table and column

### 2. Backend
- Delete `backend/routes/itemCategories.ts` entirely
- Remove category route registration from `backend/app.ts`
- Remove `categoryId` from POST/PUT in `backend/routes/items.ts`
- Update seed data to remove categories

### 3. Electron
- Remove `registerStockSupplyCategoryHandlers` from `ipc-handlers.ts`
- Remove import + call from `main.ts`
- Remove `stockSupplyCategory` namespace from `preload.cts`

### 4. Frontend Types + API
- Remove `StockSupplyCategory`, `StockSupplyCategoryCreateData`, `StockSupplyCategoryUpdateData` from `electron.d.ts`
- Remove `categoryId` from `StockSupply`, `StockSupplyCreateData`, `StockSupplyUpdateData`
- Remove `stockSupplyCategory` namespace from `ElectronAPI`
- Remove 5 category API functions from `lib/api.ts`

### 5. Frontend Pages
- Delete `StockSupplyCategories.tsx` and `StockSupplyCategoryForm.tsx`
- Remove 3 routes + 2 imports from `App.tsx`
- Remove category card from `Manager.tsx` settings view
- Remove category select from `StockSupplyForm.tsx`, `StockSupplyEditDialog.tsx`
- Remove category filter from `StockSupplies.tsx`, `Store.tsx`
- Remove `categoryId` from add item form in `Store.tsx`

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | Remove model + categoryId |
| 2 | `backend/routes/itemCategories.ts` | Delete |
| 3 | `backend/app.ts` | Remove import + route |
| 4 | `backend/routes/items.ts` | Remove categoryId handling |
| 5 | `backend/db/seed.ts` | Remove category seeding |
| 6 | `backend/db/sample-data.ts` | Remove stockSupplyCategories |
| 7 | `desktop/electron/ipc-handlers.ts` | Remove handlers |
| 8 | `desktop/electron/main.ts` | Remove import + call |
| 9 | `desktop/electron/preload.cts` | Remove namespace |
| 10 | `desktop/ui/types/electron.d.ts` | Remove types + categoryId |
| 11 | `desktop/ui/lib/api.ts` | Remove 5 functions |
| 12 | `desktop/ui/pages/admin/StockSupplyCategories.tsx` | Delete |
| 13 | `desktop/ui/pages/admin/StockSupplyCategoryForm.tsx` | Delete |
| 14 | `desktop/ui/App.tsx` | Remove routes + imports |
| 15 | `desktop/ui/pages/admin/Manager.tsx` | Remove category card |
| 16 | `desktop/ui/pages/admin/StockSupplyForm.tsx` | Remove category field |
| 17 | `desktop/ui/components/admin/StockSupplyEditDialog.tsx` | Remove category field |
| 18 | `desktop/ui/pages/admin/StockSupplies.tsx` | Remove category filter |
| 19 | `desktop/ui/pages/Store.tsx` | Remove category filter + form field |

## Validation

1. `npx prisma db push` succeeds
2. `npx tsc --noEmit` passes
3. `npm run lint` passes
4. Stock supply create/edit forms have no category field
5. Stock tables have no category filter
6. Settings page shows only Departments + Kitchen Config
7. No references to StockSupplyCategory remain in codebase
