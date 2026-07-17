# Reusable DataTable Component

## Platform
frontend

## Status
Complete

## Goals
- Create a single reusable `DataTable` component that encapsulates all table settings
- Eliminate repeated table boilerplate across 10+ tables
- Consistent styling, sizing, and behavior across all tables
- Non-data columns (Actions, Details) flex to fill remaining space
- Data columns use fixed minimum width (150px default)
- Pagination built-in
- Horizontal scroll when data columns exceed container

## Notes
- Component lives in `desktop/ui/components/ui/data-table.tsx`
- Uses existing shadcn Card and Pagination components
- Column sizing: data columns get `min-w-[150px]`, non-data columns flex to fill
- Scroll appears naturally when data columns × 150px > container width
- Refactor all 10 existing tables to use DataTable

## Implementation Steps

1. Create `data-table.tsx` with full component + types
2. Refactor each table one at a time:
   - StockSupplies.tsx
   - Store.tsx
   - Kitchen.tsx (3 tables)
   - DepartmentManager.tsx
   - KitchenStockConfig.tsx
   - FulfillRequest.tsx
   - MealTypeList.tsx
   - MenuList.tsx
3. Remove old `usePagination.ts` hook
4. Type-check with `tsc --noEmit`
5. Lint with `npm run lint`

## History

- Created data-table.tsx with generic typing, built-in pagination
- Refactored 10 tables across 8 files
- Column sizing: data columns min 150px, action columns flex
- Committed: `2ff67ea` — "feat: create reusable DataTable component, refactor all tables"
