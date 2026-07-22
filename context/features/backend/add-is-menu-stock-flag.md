# Add `isMenuStock` Flag — Backend

## Platform

backend

## Status

Not Started

## Goals

- Add `isMenuStock Boolean @default(false)` to `StockSupply` in Prisma schema
- Update all backend routes to use `isMenuStock` instead of `platesPerUnit > 0` checks
- Include `isMenuStock` in all StockSupply responses

## Notes

- `platesPerUnit` stays — it still holds the numeric conversion rate
- `isMenuStock` becomes the single source of truth for "is this stock item used for menu variants"
- KitchenStockConfig continues to set `platesPerUnit` on items already marked `isMenuStock`

## Tasks

### Task 1: Schema Change

1. Add `isMenuStock Boolean @default(false)` to `StockSupply` model in `backend/prisma/schema.prisma`
2. Run `npx prisma db push`
3. Run `npx prisma generate`

### Task 2: Update Kitchen Inventory Route

1. Open `backend/routes/kitchenInventory.ts`
2. Change Prisma `where` from `platesPerUnit: { not: null }` to `isMenuStock: true`
3. Remove the JS `.filter()` — Prisma filter is sufficient
4. Include `isMenuStock` in response

### Task 3: Update Cooking Records Route

1. Open `backend/routes/cookingRecords.ts`
2. Change validation from `!stockSupply.platesPerUnit || Number(stockSupply.platesPerUnit) <= 0` to `!stockSupply.isMenuStock`
3. Include `isMenuStock` in all `stockSupply` selects

### Task 4: Update Stock Supplies Route

1. Open `backend/routes/items.ts`
2. Add `isMenuStock` to `serializeStockSupply` function
3. Add `isMenuStock` to POST create route (accept from body)
4. Add `isMenuStock` to PUT update route (accept from body)
5. Include `isMenuStock` in kitchen-inventory endpoint select

### Task 5: Update Kitchen Config Route

1. Open `backend/routes/kitchenConfig.ts`
2. Include `isMenuStock` in GET select
3. Include `isMenuStock` in PUT response select
4. Filter GET to only return `isMenuStock: true` items (config is only for menu stock)

### Task 6: Update Cooking Assignments Route

1. Open `backend/routes/cookingAssignments.ts`
2. Include `isMenuStock` in all `stockSupply` selects

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | Add `isMenuStock Boolean @default(false)` |
| 2 | `backend/routes/kitchenInventory.ts` | Filter by `isMenuStock: true` |
| 3 | `backend/routes/cookingRecords.ts` | Validate `isMenuStock`, add to selects |
| 4 | `backend/routes/items.ts` | Add to serialize, create, update, selects |
| 5 | `backend/routes/kitchenConfig.ts` | Add to selects, filter by `isMenuStock` |
| 6 | `backend/routes/cookingAssignments.ts` | Add to selects |

## Validation

1. `npx prisma db push` succeeds
2. `npx tsc --noEmit` passes
3. `npm run lint` passes (no new errors)
4. `GET /api/kitchen/inventory` only returns `isMenuStock: true` items
5. `POST /api/cooking-records` rejects items where `isMenuStock: false`
6. `GET /api/kitchen-config` only returns `isMenuStock: true` items
7. `POST /api/stock-supplies` accepts `isMenuStock` in body
