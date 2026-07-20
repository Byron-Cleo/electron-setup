# Stock Deduction at Request Creation

## Platform
backend

## Status
Not Started

## Goals
- Deduct `quantityRequested` from `StockSupply.currentStock` when a stock request is created
- Validate that requested quantity doesn't exceed available stock before deduction
- Remove stock deduction from fulfillment endpoint (already done at request time)
- Fulfillment trail still captured via `StockFulfillment` + `StockFulfillmentItem`
- Wrap request creation in a Prisma transaction for atomicity

## Notes
- Single file modification: `backend/routes/stockRequests.ts`
- No schema changes needed
- POST `/api/stock-requests` — add stock validation + deduction in transaction
- PUT `/api/stock-requests/:id/fulfill` — remove stock deduction (lines 175-178) + remove stock validation (lines 152-157)
- Edge case: concurrent requests for same stock handled by Prisma transaction atomicity
- Branch: `feature/backend/stock-deduction-at-request`

## Implementation Steps
1. Add stock validation to POST — check each item's `quantityRequested <= currentStock`
2. Wrap POST create in `prisma.$transaction` — deduct stock then create request
3. Remove stock deduction from PUT fulfill — delete `stockSupply.update` decrement block
4. Remove stock availability check from PUT fulfill — delete "Cannot deliver more than available store stock" block
5. Run `npm run lint` and `npm run build` to verify

## Files to Modify
| File | Action |
|---|---|
| `backend/routes/stockRequests.ts` | Modify POST (add deduction), Modify PUT (remove deduction) |

## History

(none yet)
