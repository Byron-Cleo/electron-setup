# Kitchen Adjustable Requests + Returns to Store

> **Queued** — implement AFTER `production-guidance-removal-running-low-10` completes and merges
> on the current branch. Platform: `backend` (DB + API logic) with frontend actions.

## Branch
`feature/kitchen/adjustable-requests-returns`

## Problem
1. **Requested amounts are locked** once submitted — kitchen cannot correct an amount up/down while
   the stock is still raw, even when nothing (or only part) has been delivered
2. **Delivered-but-uncooked stock can never go back** — the kitchen's Raw Stock Pending just sits
   there; the store's records never learn that a remainder exists and can be cooked later
3. Decimal quantities are already supported end-to-end (see context below) — verification/polish only

## Current behavior (from exploration)
- `POST /api/stock-requests` **immediately decrements** `StockSupply.currentStock` by
  `quantityRequested` — the request reserves the stock (`stockRequests.ts:105-137`)
- Fulfillment (`PUT /:id/fulfill`) accumulates `quantityDelivered` per item; status auto-computes
  PENDING → PARTIAL → COMPLETED; cannot deliver more than requested
- Kitchen inventory (`kitchenInventory.ts`) walks fulfillments vs cooking records oldest-first
  **per supply**: `rawStockPending = activeOrdered − activeCooked` — the uncooked remainder
- Cooking records link only `stockSupplyId` (NOT request items) — cooked amounts are global per
  supply, so the return cap must be computed per supply, not per request item
- `/api/cooking-records/carry-over` runs the same walk
- `quantityRequested` / `quantityDelivered` / `quantityCooked` are all `Decimal(12,2)`; the request
  input is `min={0.01} step={0.01}` (`Kitchen.tsx:514`) — decimals already work

## Solution

### 1. Adjust action — My Requests (any kitchen user, ALL statuses, decimals)
New endpoint: `PUT /api/stock-requests/:id/adjust`
Body: `{ adjustedById, notes?, items: [{ stockRequestItemId, quantityRequested }] }`

Per item:
- New amount > 0, decimals allowed
- **new ≥ quantityDelivered** → pure adjust:
  - reduce ⇒ refund the difference to `StockSupply.currentStock` automatically
  - increase ⇒ allowed only if the store has enough (400 otherwise); difference deducted
- **new < quantityDelivered** (stock still raw) ⇒ implicit **return** of `(delivered − new)`:
  - set `quantityRequested` and `quantityDelivered` to the new amount
  - create a `StockReturn` row (audit: who/when/how much)
  - increment `currentStock` by the returned amount
  - **Capped** by the supply's uncooked remainder: `Σ delivered − Σ cooked − Σ prior returns`
    (cooked stock can never go back — 400 with the max returnable figure when exceeded)
- Recompute request status after adjust (requested = delivered ⇒ COMPLETED)

**Adjust lock (operator refinement):** pending/partial requests are ALWAYS adjustable, but a
COMPLETED request only stays adjustable through the day it was last touched — `updatedAt`
(Nairobi calendar date) is the allowance window because Prisma bumps it on every touch, so a
request completed today auto-locks tomorrow. A request made yesterday that only completed today
keeps its window (operator: updatedAt is the correct basis, not createdAt). **Enforced twice**:
the endpoint 400s (`completed on a past date and can no longer be adjusted`) and the UI hides the
button via `isAdjustableRequest()`.

UI: an **Adjust** (pencil) action on request items in `RequestStockDesign` behind a new
`allowAdjust` prop (kitchen My Requests passes `true`; the store's view stays unchanged), gated by
the lock. The adjust dialog keys a decimal amount, shows delivered + uncooked-remainder context,
and refreshes the table on success. Column backgrounds (operator, refined after a first-pass
font-colour attempt was reverted): the **Requested column washes blue** (`bg-blue-100`), the
**Delivered column washes gray** (`bg-gray-100`), the **Remaining column washes green**
(`bg-green-100`), and the **Adjust column washes red** (`bg-red-100` — operator first said yellow,
then corrected to red) — the column `className` paints the header and every data cell the same
colour; font colours stay the ORIGINAL status colouring (`STATUS_TEXT_COLOR`
restored — delivered text keeps its pending/partial/completed colour).

**My Requests tab pills (operator refinement):** the "My Requests" tab link carries **one pill per
status** — Pending (amber `bg-status-pending-bg text-status-pending-text`) and Partial
(`bg-status-partial-bg text-status-partial-text`), each with its dot + count + label, mirroring the
kitchen dashboard card pill design exactly (an initial combined red pill was rejected by the
operator). Counts are kitchen-department requests still in flight, derived from the same
`getStockRequests()` fetch as the tab itself — clear trace. Refreshes on tab click and after every
adjust/fulfil via `onRequestFulfilled={loadCounts}`; each pill hides when its count is zero.

### 2. Return to Store — Kitchen Production table
New endpoint: `POST /api/stock-returns`
Body: `{ stockSupplyId, quantityReturned, returnedById, notes? }` (supply-level, no request item)

- Cap: the same uncooked remainder per supply (the figure the Inventory tab already shows as
  Raw Stock Pending) — return of the cook-more remainder, e.g. delivered 1.0, cooked 0.4 ⇒ return
  at most 0.6
- Effect: `currentStock` restored; Raw Stock Pending drops

UI: **Return to Store** button on Kitchen Production → Inventory tab items with
`rawStockPending > 0`; dialog with decimal amount ≤ remainder + notes.

### 2b. Kitchen Production polish (operator, mid-feature)
- **Vertical action stack** — the three row actions stack top-to-bottom: **Cook More** (green) →
  **Edit** (default) → **Return** (red, `text-red-600 border-red-200`) — compact `h-5 text-[10px]`
  buttons in a `w-24` column so records stay thin (was: horizontal side-by-side)
- **Production table column washes (operator)** — the Action column washes **green**
  (`bg-green-100`; operator tried gray first, then switched), the Remaining column washes
  **gray** (`bg-gray-100`) — header + every data cell, fonts untouched
- **Cooking edit lock** — only batches cooked TODAY (Nairobi date) can be corrected: the Edit button
  hides for past-date/never-cooked supplies (`isCookedToday(item.lastCookedDate)`), and
  `PUT /cooking-records/:id` 400s for past-date records — sold/assigned batches are immutable history

### 3. StockReturn model (audit trail for both paths)
```prisma
model StockReturn {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  stockSupplyId      String    @db.Uuid
  stockRequestItemId String?   @db.Uuid   // set when the return came from an adjust below delivered
  quantityReturned   Decimal   @db.Decimal(12, 2)
  returnedById       String    @db.Uuid
  notes              String?
  createdAt          DateTime  @default(now()) @db.Timestamptz(3)
  // relations: stockSupply, stockRequestItem?, returnedBy
}
```
- Hand-written migration per repo convention + `npm run db:sync`

### 4. Inventory truthfulness
- `kitchenInventory.ts` and the carry-over walk subtract `Σ returns` per supply so
  Raw Stock Pending reflects returns
- The store's `currentStock` remains the single source of shelf truth

### 5. Decimals
- Already supported — verify `formatQuantityWithUnit` renders fractions cleanly; add a
  "decimals allowed" hint in the request, adjust, and return dialogs

### Safety rules (server-enforced)
1. Cooked stock never goes back — only the uncooked remainder can be returned
2. The store can't give what it doesn't have — increases gated on availability
3. Every adjust/return is recorded — who, when, how much

## Files Modified (planned)
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `StockReturn` model |
| `backend/prisma/migrations/<new>/migration.sql` | Hand-written CREATE TABLE |
| `backend/routes/stockRequests.ts` | `PUT /:id/adjust` — adjust + implicit return + cap + status recompute |
| `backend/routes/stockReturns.ts` (new) | `POST /` supply-level return with cap |
| `backend/routes/kitchenInventory.ts` | Subtract returns from Raw Stock Pending |
| `backend/routes/cookingRecords.ts` | carry-over walk subtracts returns |
| `backend/app.ts` | Register `/api/stock-returns` |
| `desktop/electron/ipc-handlers.ts` | `stock-request:adjust` + `stock-return:create` |
| `desktop/electron/preload.cts` | Expose adjust + return |
| `desktop/ui/lib/api.ts` | `adjustStockRequest()` + `returnToStore()` |
| `desktop/ui/types/electron.d.ts` | New types |
| `desktop/ui/components/shared/RequestStockDesign.tsx` | `allowAdjust` prop + Adjust action + adjust dialog |
| `desktop/ui/pages/Kitchen.tsx` | Pass `allowAdjust`; Inventory tab Return to Store button + dialog; decimal hints |
| `desktop/ui/lib/api.ts` (`formatQuantityWithUnit`) | Verify decimal display |

## Testing Checklist
- [ ] Request 10 → adjust to 4 while PENDING → store `currentStock` +6
- [ ] Adjust 4 → 6 while PENDING (stock available) → `currentStock` −2
- [ ] Increase beyond store availability → 400
- [ ] Deliver 3 (PARTIAL) → adjust requested 10 → 3 → status flips to COMPLETED
- [ ] Requested 1.0 / delivered 1.0 / cooked 0.4 → adjust requested to 0.4 → 0.6 returned, store +0.6, `StockReturn` row logged
- [ ] Adjust below delivered blocked when remainder is insufficient → 400 with max returnable
- [ ] Kitchen Production: Raw Stock Pending 0.6 → Return to Store 0.6 → store +0.6, pending 0
- [ ] Return above remainder → 400
- [ ] Decimal request (e.g. 0.5 packets) displays correctly everywhere
- [ ] Adjust button hidden + endpoint 400 for COMPLETED requests last touched on a past date
- [ ] Completed-today requests stay adjustable; past-date PENDING/PARTIAL stay adjustable
- [ ] My Requests: Requested blue, Delivered gray, Remaining green, Adjust red column backgrounds (header + cells); delivered font keeps its status colour
- [ ] Kitchen Production: actions stack vertically (Cook More → Edit → Return in red), compact so rows stay thin
- [ ] Kitchen Production: Action column green background, Remaining column gray background (header + cells)
- [ ] Edit hidden for past-date cooking records; `PUT /cooking-records/:id` 400s on past-date records
- [ ] Edit hidden for never-cooked supplies
- [ ] My Requests tab shows separate Pending (amber) and Partial pills with the kitchen-department counts; each hides when zero; refresh after an adjust
- [ ] Raw Stock Pending reflects returns in kitchenInventory AND carry-over
- [ ] `npm run lint` + `npm run build` + `npm run build --prefix backend` clean

## Deploy (after operator dev-tests)
1. `npm run db:sync` (new table)
2. `npm run build --prefix backend`
3. `npm run server:restart`
4. Verify: `npm run server:status` → RUNNING and `curl http://localhost:3001/health`
5. Browser live-view rule: after any plain `npm run build` / `build:win`, re-run
   `npm run build:web -- --server same-origin`

## Related
- `context/fix-plan/reusable-stock-requests.md` — the request/fulfillment design this extends
- `context/fix-plan/cooked-food-pool-consistency.md` — kitchen production semantics
