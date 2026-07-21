# Restock/Procure Items Table

## Platform
frontend

## Status
Not Started

## Goals
- Implement `RestockView` component in `Store.tsx` with data table of low stock items
- Add `getLowStockSupplies()` API function and backend endpoint
- Details button opens StockSupplyDetailDialog modal popup
- Restock button opens modal with quantity input
- Post-submit shows confirmation with "View Shopping List" option (no printing yet)

## Notes
- Backend endpoint `GET /api/stock-supplies/low-stock` needs to be added (returns items where `currentStock <= reorderLevel`)
- Frontend API function `getLowStockSupplies()` needs to be added to `lib/api.ts`
- Reuse existing `computeStockStatus()` function from Store.tsx
- Reuse existing `DataTable` component from `@/components/ui/data-table`
- Reuse existing `StockSupplyDetailDialog` for details modal
- Reuse existing `Dialog` components for restock modal
- `reorderLevel` in StockSupply is nullable — filter nulls in backend
- Restock Quantity = `reorderLevel - currentStock` (how much to order)
- Branch: `feature/store/restock-procure-items-table`

## Implementation Steps
1. Add `GET /api/stock-supplies/low-stock` endpoint to `backend/routes/items.ts`
2. Add `getLowStockSupplies()` function to `desktop/ui/lib/api.ts`
3. Implement `RestockView` component in `desktop/ui/pages/Store.tsx`
4. Add restock modal state and handlers
5. Run `tsc --noEmit` and `npm run lint` to verify

## Files to Create
| File | Action |
|---|---|
| `context/features/frontend/restock-procure-items-table.md` | This file |

## Files to Modify
| File | Action |
|---|---|
| `backend/routes/items.ts` | Add `GET /low-stock` endpoint before `/:id` |
| `desktop/ui/lib/api.ts` | Add `getLowStockSupplies()` function |
| `desktop/ui/pages/Store.tsx` | Implement `RestockView` with table + modal |

## History

(none yet)
