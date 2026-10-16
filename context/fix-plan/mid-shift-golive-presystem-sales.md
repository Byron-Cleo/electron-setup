# Mid-Shift Go-Live: Pre-System Sales (Go-Live Only Input)

## Problem statement recap

Operator: shift already open (e.g. 05:30), kitchen sold on paper/off-system for ~4h before keying production into the system. Example: beef 2kg → 14 plates produced, 6 already gone physically (no system orders). POS must show 8, report must show "Cooked 14 / Sold 6 pre-system (+ later system sales) / Closing 8". Revenue must NOT include the 6. Must be used only on day-one/go-live or rare late-keying; leave 0 on normal days. Input must be very obvious (red styling) and placed separately. Add a Settings kill-switch to hide it once go-live is complete.

## Core design

- Add `platesPreSystemSold` per batch/dish to account for sales that happened before recording into the system.
  - `CookingRecord.platesPreSystemSold Decimal(12,2) @default(0)` — batch-level (for SHARED pools, no splits).
  - `CookingRecordMenu.platesPreSystemSold Decimal(12,2) @default(0)` — per-dish (for ALLOCATED splits).
- Sellable maths: `remaining = allocated − orderSold − preSold`, `poolRemaining = produced − sold − wasted − preSold`. POS/showing caps follow remainders; `recomputeMenuStock` unchanged in shape.
- Report: `sold = orderSold + preSold`, surface breakdown `soldPreSystem` in plate movement rows so report can print "Sold … (6 pre-system)". Revenue only from system orders.
- Kill-switch: singleton `SystemSettings { id 1, showGoLiveInput Boolean @default(true) }`. API + IPC + Settings UI toggle (admin-only). Hiding removes red cards from Kitchen; history remains intact.

## Schema (Prisma + migration)

Add to `backend/prisma/schema.prisma`:
```prisma
model CookingRecord {
  // ...
  platesPreSystemSold Decimal @default(0) @db.Decimal(12,2)
}

model CookingRecordMenu {
  // ...
  platesPreSystemSold Decimal @default(0) @db.Decimal(12,2)
}

model SystemSettings {
  id               Int      @id @default(1) // singleton
  showGoLiveInput  Boolean  @default(true)
  createdAt        DateTime @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime @updatedAt @db.Timestamptz(6)
}
```

Migration: `20261016_migration_name` with hand-written SQL (or rely on `prisma db push` locally per convention) — at least seed singleton: `INSERT INTO "SystemSettings" (id,"showGoLiveInput") VALUES (1,true) ON CONFLICT DO NOTHING;`.

## Backend

1. **routes/systemSettings.ts** (new)
   - `GET /api/system-settings` → public (Kitchen reads flag). Return singleton or `{ id:1, showGoLiveInput:true }` if missing.
   - `PUT /api/system-settings` → admin-only (require role check consistent with existing: roles include admin). Body `{ showGoLiveInput: boolean }`. Update singleton (upsert by id=1).
   - Export router, mount in `app.ts` as `/api/system-settings`.

2. **pools.ts**
   - `batchPools` (SHARED): include `platesPreSystemSold` on batch; `poolRemaining = round2(produced - sold - wasted - Number(b.platesPreSystemSold ?? 0))`.
   - `soldByMenuForBatches` unchanged (order allocations). Guard `BELOW_SOLD` becomes `allocated >= orderSold + preSold`.
   - ALLOCATED: split `remaining = allocated − orderSold − preSold` — set `platesRemaining = platesAllocated − orderSold − ps`, `platesPreSystemSold = ps` in allocate.
   - Void path untouched (restores order allocations only).

3. **routes/cookingRecords.ts**
   - `POST /`: accept batch-level `preSystemSold` (SHARED). If ALLOCATED batch context, reject batch-level. Validate ≥0. Write to batch.
   - `POST /:id/allocate`: accept per-dish `preSystemSold`; compute `orderSold = soldForMenu(menuId)`, `ps = round2(p.preSystemSold ?? 0)`, validate `ps >= 0` and `plates >= orderSold + ps`. On upsert: `platesAllocated=plates`, `platesRemaining = round2(plates−orderSold−ps)`, `platesPreSystemSold=ps`. Drop-dish check: cannot remove if `orderSold+ps>0`.
   - `POST /:id/menu/:menuId/top-up`: unchanged (never touches preSold).
   - Same-day edit lock for preSold-sensitive edits on old batches (reuse `isCookedToday`).

4. **routes/dailyReport.ts**
   - Aggregate `preSoldByMenu` from in-window splits and SHARED batches. `sold = orderSold + pre`, expose `soldPreSystem = pre`. `closing = opening + cooked + received − sold`. Revenue unchanged (order-only).

5. **app.ts**: mount `/api/system-settings`.

## IPC/Electron/types/API

- `preload.cts`: `systemSettings: { get: () => Promise<SystemSettings>, update: (data: SystemSettingsUpdate) => Promise<SystemSettings> }`
- `electron.d.ts`: `SystemSettings { id:1; showGoLiveInput:boolean }`, `SystemSettingsUpdate { showGoLiveInput:boolean }`
- `desktop/electron/ipc-handlers.ts`: handlers `system-settings:get/update` (or new module)
- `desktop/ui/lib/api.ts`: `getSystemSettings()`, `updateSystemSettings(data)` with Electron-first, fetch fallback.

## Frontend

**A. Settings → Go-Live Mode (admin-only)** (`Manager.tsx` + `GoLiveModeSettings.tsx`)
- New card `view: "golive-mode"`, `adminOnly: true`. Render new component.
- Toggle `showGoLiveInput` with shadcn Switch; save calls API, success toast/text. Warning: hiding removes red cards; existing pre-system figures remain in history/reports.

**B. AssignmentModal.tsx (ALLOCATED)**
- Fetch/pass `showGoLiveInput` from Kitchen. Red card below dish list, above Save: border `border-red-300 bg-red-50`, bold red heading "GO-LIVE ONLY — Already sold before keying in". Helper text: "Paper sales, no system order. Deducts now, shows as pre-system. Leave 0 normally." Per-dish red number input `preSystemSold` (default 0). Include in payload. Clamp `0 ≤ v ≤ assigned − sold`.

**C. Kitchen.tsx cook dialog (SHARED)**
- Same red card at bottom (after notes), batch-level `cookPreSystemSold`. Only shown when `showGoLiveInput` and supply is SHARED (or always when creating batch; server validates). Send in `createCookingRecord`.

## Verification

- `tsc -b`, backend `tsc`/build, `npm run lint` green.
- Dev: cook 14 ALLOCATED + pre 6 → POS cap 8; report shows Sold 6 pre + system → totals correct; over-order 9 → 409; flip toggle off → cards hidden, history intact.

## Stopgap

If must trade today: key `platesActual = 8`, note "14 produced, 6 pre-system sold off-system" (report understates cooked by 6). Preferred: implement this.

## Implementation Notes (as built)

- **Branch:** `feature/kitchen/mid-shift-golive-presystem-sales`.
- **Key deviation from plan — pool math must include split-level pre.** `pools.ts` `batchPools` originally read only `CookingRecord.platesPreSystemSold` (batch level). For ALLOCATED the pre lives per-split, so `poolRemaining` overcounted and `unassigned` showed the pre-system plates as never-sold remainder. Fixed: `batchPools` now sums batch-level + split-level `platesPreSystemSold` (`BatchRow.cookingRecordMenus` selects the field) and subtracts the total. The two levels are mutually exclusive by construction (SHARED has no splits; ALLOCATED rejects batch-level pre), so the sum never double-counts. `sellableForMenu` was already correct for ALLOCATED (uses split `platesRemaining`, which the allocate route writes as `plates − sold − pre`).
- **No shadcn `Switch` exists** — the Settings toggle uses `Checkbox`.
- **No server-side auth** (LAN trust model) — `systemSettings` GET/PUT are unauthenticated; "admin-only" is enforced by `Manager.tsx` `adminOnly` card only.
- **Tests added** to `backend/tests/pool-engine.test.ts` (4 cases, all green): SHARED batch pre deducted; SHARED pre counted against later orders; can't sell past the pre deduction; ALLOCATED split pre stays out of pool and sellable.
- **Test DB:** schema pushed to `eraevadb_test` (`platesPreSystemSold` ×2 + `SystemSettings`). The test suite is broadly broken at HEAD on this branch (baseline 29 failed / 13 passed; with this feature 27 failed / 19 passed — no regressions, 2 pre-existing failures incidentally fixed). The 2 `consumptionFactorsForSupply` failures are pre-existing: the function does not exist in `pools.ts` at HEAD.
- **Smoke-tested live** (:3111): `GET/PUT /system-settings` incl. boolean validation; ALLOCATED allocate with pre 6 → split remaining 8, `batchSoldByMenu` excludes pre; `BELOW_SOLD` guard fires; test batch deleted (menu stock restored).
- `tsc -b`, `npm run build --prefix backend`, `npm run build` + `npm run build:web -- --server same-origin` all clean; ESLint clean on every changed file.
