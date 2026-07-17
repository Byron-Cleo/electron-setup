# Remove StockSupplyCategory — Backend

## Platform

backend

## Status

Not Started

## Goals

- Remove StockSupplyCategory model from Prisma schema
- Remove categoryId from StockSupply model
- Delete stock supply category CRUD routes
- Remove category route from Express app
- Remove categoryId handling from stock supply create/update routes
- Update seed data

## Notes

- Migration will drop the StockSupplyCategory table and categoryId column
- Existing stock supply data will lose category association
- Stock supply create no longer requires categoryId
- Stock supply update no longer accepts categoryId

## Files Modified

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Remove StockSupplyCategory model, remove categoryId + category from StockSupply |
| `backend/routes/itemCategories.ts` | Delete |
| `backend/app.ts` | Remove import + route registration |
| `backend/routes/items.ts` | Remove categoryId from POST/PUT destructuring, validation, Prisma queries |
| `backend/db/seed.ts` | Remove category seeding, update stock supply seed |
| `backend/db/sample-data.ts` | Remove stockSupplyCategories array |

## Verification

1. `npx prisma generate` passes
2. `npx prisma db push` succeeds
3. `npx tsc --noEmit` passes
4. POST /api/stock-supplies works without categoryId
5. PUT /api/stock-supplies/:id works without categoryId
