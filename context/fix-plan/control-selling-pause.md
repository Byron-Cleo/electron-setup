# Control Selling (Pause/Resume Cooked Plates)

**Branch:** `feature/waiter/control-selling-pause`  
**Platform:** `backend + frontend`  
**Status:** Not Started  
**Related:** pools.ts, orders.ts, cooking records, waiter POS, Menu/Dispatch, shift close/leftovers

## Problem statement recap
Large cooked batches (e.g. 70 fish) are produced; waiters see all and sell fast. Mid-service part may still be finishing/preparing. If receipts are printed for plates not ready, they must be voided (and voids get forgotten → cashier sees unpaid receipt). Need to pause selling of some plates so orders/receipts cannot be generated for them until released.

## Requirements (confirmed)
- **Per batch/split control**: List every batch/split row ready for serving (CookingRecord/CookingRecordMenu). For ALLOCATED pause per split row; for SHARED pause per batch; for KEYED pause by scope. All selling modes controllable.
- **Applies to already-cooked/ready food**: Any food ready for serving can be paused by admin/manager.
- **Availability formula**: `availableToSell = produced - sold - wasted - preSystemSold - pausedActive`. When `sold >= availableToSell`, card greyed/disabled.
- **Server enforces**: `assertLinesServable` must block orders exceeding `availableToSell`. Client UX only.
- **KEYED**: Pausing does **not** change `keyedStock` ledger. Only prevents placing new orders.
- **Reports/shift close**: Paused unsold plates are **not** revenue. At shift close they auto-convert to **assigned but not sold** (leftovers) and carry forward to next shift. They remain paused until manager **unpauses** them (become sellable). If marked waste later, normal waste flow applies.
- **Authorization**: Only admin/manager can control (pause/resume).
- **Linked dishes**: If main dish paused/has no `availableToSell`, selecting shows immediate message ("Selling paused for now... It’s not ready for serving yet.") and sides cannot be ordered through it.
- **Waiter messaging**: Show "Selling paused yet – X held. Only Y available to sell now." When ordering more than available, show "Only Y plates available to sell for [Dish]. The rest are paused (not ready yet). Please order Y or less, or choose another dish."
- **Multiple batches**: Each batch independent. Pausing batch 2 doesn't affect batch 1.

## Data model (Prisma)
Add `SellingPause` model:

```prisma
model SellingPause {
  id               String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  shiftId          String?     @db.Uuid
  operationDay     DateTime    @db.Date
  menuId           String      @db.Uuid
  cookingRecordId  String?     @db.Uuid  // null for KEYED scope
  sellingMode      SellingMode
  pausedPlates     Decimal     @db.Decimal(12,2)
  active           Boolean     @default(true)
  reason           String?
  pausedById       String      @db.Uuid
  createdAt        DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime    @updatedAt @db.Timestamptz(3)

  Menu             Menu             @relation(fields: [menuId], references: [id])
  CookingRecord    CookingRecord?   @relation(fields: [cookingRecordId], references: [id])
  PausedBy         User             @relation(fields: [pausedById], references: [id])
  Shift            Shift?           @relation(fields: [shiftId], references: [id])
}
```

Relations to add: `Menu.sellingPauses`, `CookingRecord.sellingPauses`, `User.sellingPauses`, `Shift.sellingPauses`.

Notes:
- Scope key enforced at app level: one active pause per `(menuId, cookingRecordId, sellingMode, shiftId, operationDay)` with `active=true`
- `cookingRecordId` required for ALLOCATED/SHARED batches, null for KEYED
- `pausedPlates > 0` when `active=true`

**Migration:** `npm run db:sync` on prod after schema change.

## Pool engine (`backend/pools.ts`)
Keep existing produced/sold/wasted/preSystemSold logic unchanged; subtract pauses after.

### Helpers
- `getActivePausedPlates(tx, scope)`: sum active `SellingPause.pausedPlates`
- Scopes: ALLOCATED per split row, SHARED per batch, KEYED by menu+shift/operationDay with null cookingRecordId

### Changes
- **`sellableInfoForMenu`**: `availableToSell = max(0, availableNow - pausedActive)`. For direct-sale (`requiresCooking=false`): `availableToSell = max(0, menu.stock - pausedActive)`.
- **`assertLinesServable`**: block if demand > `availableToSell` with pause-aware message.
- **`sourcesForMenu`/consumption**: no change to sold tracking.

## Backend API (`backend/routes/sellingPauses.ts`)
Require admin/manager. Mount in `backend/app.ts`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/selling-pauses` | List active pauses |
| POST | `/api/selling-pauses` | Create/upsert pause; validate against availableNow; disallow closed shifts |
| PUT | `/api/selling-pauses/:id` | Adjust or resume (`active=false`) |
| DELETE | `/api/selling-pauses/:id` | Prefer PUT `active=false` |

## IPC + API client
- `desktop/electron/ipc-handlers.ts`: register handlers
- `desktop/electron/preload.cts`: expose `window.electron.sellingPauses.*`
- `desktop/ui/types/electron.d.ts`: add types
- `desktop/ui/lib/api.ts`: add functions

## UI - Menu/Dispatch ("Today's cooked food")
Add "Control Selling" button per batch row. Modal with stats, batch table, controls (± input, toggle), reason, save/cancel. Admin/manager only.

## UI - Waiter POS
Grey card with badges/messages when paused; block ordering when `availableToSell <= 0` or qty > `availableToSell`; linked dish shows immediate pause message.

## Shift close / leftovers / reports
Active pauses auto-convert to unsold assigned at shift close (carry forward). Not revenue; excluded from sold totals. Manager can unpause carried-forward items or mark waste.

## Edge cases
Sales race, pause>available after sales, wasting paused, cooking edit down, multiple batches, KEYED top-up, direct-sale, past shifts immutable.

## Testing plan
SHARED/ALLOCATED/KEYED pause, linked dish, multiple batches, shift close carry-forward, resume.

## Deployment
1. Schema → `npm run db:sync`
2. Backend → build + restart EraevaBackend
3. Frontend/Electron → build + `npm run build:web -- --server same-origin`
4. Verify

**Server-side enforcement is mandatory.**
