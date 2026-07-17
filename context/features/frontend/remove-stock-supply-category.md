# Remove StockSupplyCategory — Frontend

## Platform

frontend

## Status

Not Started

## Goals

- Remove StockSupplyCategory types from electron.d.ts
- Remove stockSupplyCategory namespace from ElectronAPI
- Remove 5 category API functions from lib/api.ts
- Delete StockSupplyCategories.tsx and StockSupplyCategoryForm.tsx
- Remove category routes from App.tsx
- Remove category card from Manager.tsx settings view
- Remove category select from StockSupplyForm and StockSupplyEditDialog
- Remove category filter from StockSupplies and Store tables
- Remove categoryId from StockSupply types

## Notes

- Stock supply forms no longer have a category dropdown
- Stock tables no longer have a category filter dropdown
- Settings page shows only Departments and Kitchen Config cards
- Stock supply search still works by name

## Files Modified

| File | Change |
|------|--------|
| `desktop/ui/types/electron.d.ts` | Remove 3 interfaces, categoryId from 3 types, namespace from ElectronAPI |
| `desktop/ui/lib/api.ts` | Remove 5 functions |
| `desktop/ui/pages/admin/StockSupplyCategories.tsx` | Delete |
| `desktop/ui/pages/admin/StockSupplyCategoryForm.tsx` | Delete |
| `desktop/ui/App.tsx` | Remove 3 routes + 2 imports |
| `desktop/ui/pages/admin/Manager.tsx` | Remove category card from settings |
| `desktop/ui/pages/admin/StockSupplyForm.tsx` | Remove categoryId from schema, state, form |
| `desktop/ui/components/admin/StockSupplyEditDialog.tsx` | Same as above |
| `desktop/ui/pages/admin/StockSupplies.tsx` | Remove category filter |
| `desktop/ui/pages/Store.tsx` | Remove category filter + form field |

## Verification

1. `npx tsc --noEmit` passes
2. `npm run lint` passes
3. Stock supply forms have no category field
4. Stock tables have no category filter
5. Settings page shows Departments + Kitchen Config only
6. No references to StockSupplyCategory in frontend code
