
## Platform

Not Specified

## Status

Complete

## Goals

## Notes

## History

### fullstack - 2026-10-05 — Batch Number FIFO + Shift Enforcement (Production Quality)

- **Shift enforcement (new records only):** `CookingRecord` creation requires an active shift (`findShiftIdForTime`); PUT rejects clearing `shiftId`/`batchNumber`. Schema remains nullable to preserve legacy NULL-shift rows; enforcement applies only to new records.
- **Batch numbering per (stockSupplyId, shiftId):** Next batch is computed per supply+shift starting at 1; FIFO enforced in allocate/top-up (cannot allocate from newer batch while older batches in same shift have unallocated plates). Legacy rows with NULL shift retain their existing batch numbers.
- **Batch traceability surfaced:** `batchNumber` included in remaining/expired/wasted batch payloads (shiftCarryOver); Remaining Stock Production table adds "Batch No." column with horizontal scroll (`overflow-x-auto`, `min-w-[1200px]`).
- **Batch-strict sold/remaining (UI + API):** Remaining Stock Production shows per-batch-menu sold as `(platesAllocated - platesRemaining)`. Menu/Dispatch (`/api/menu/cooked`) computes `totalSold = allocatedTotal - remainingTotal` (batch-local) and `totalAvailable = allocatedTotal > 0 ? remainingTotal : produced` to avoid cross-batch leakage in display.
- **Deduction remains FIFO:** Order creation consumes splits oldest-first (`createdAt ASC`) and records `OrderItemAllocation` per consumed chunk; void/cancel restores plates to consumed splits. Core accounting already batch-isolated; presentation aligned to batch-strict semantics.
- **Type safety + build:** Interfaces updated to include `batchNumber`; backend builds clean (`tsc`), frontend builds clean (`vite build`), UI TypeScript compiles clean.

### frontend - 2026-10-03 — Kitchen Config Search & Edit (Drop the Add Flow)
- **Obsolete add-flow removed** — `GET /api/kitchen-config` already returns **every** active stock supply (`where: { isActive: true }`), so **Add Configuration** had nothing left to add: its dropdown only picked an item out of the list that *was* the table. Deleted the button, `openCreate()`, `selectedSupplyId`, the stock-item `Select`, and the now-redundant `getStockSupplies()` call — `getKitchenConfig()` is the single source for the view
- **Search across the whole row** — new `search` state matches stock item name, **unit**, or any linked **menu item name** (case-insensitive, trimmed). No manual page reset is needed because `usePagination` already clamps `currentPage` to `totalPages`, so the pager self-corrects as the filtered list shrinks
- **Edit-only dialog** — title fixed to **Edit Configuration**; the stock item renders as read-only `name (unit)` instead of a disabled select. `handleSave()` now saves against `editItem.id` and still validates `platesPerUnit > 0`
- **Status column** — new column reads **Configured** (`platesPerUnit > 0`, green) / **Not set** (`null`/`0`, amber), so unset items are visible without opening each row. On the 15 seeded items: 4 configured, 11 not set
- **Copy corrected** — the empty message pointed at the button that no longer exists ("Click 'Add Configuration' to get started"); it now names the active query, and the header paragraph tells the user to search then Edit
- **Verified live on :3001 + `eraevadb`** — Edit → Save persisted to Postgres (`Cabbage` → `4.50`) and the Status badge flipped in step; reverted afterwards, so data is unchanged (still Beef 6, Chapati Flour 23, Fish 1, Liver 6). Search confirmed by unit (`"pcs"` → Chicken, Fish) and by menu name alone (`"chapatis"`, which the stock item name "Chapati Flour" does not contain); a no-match search shows `No stock items match "zzzz".` with the pager at `Page 1 of 1`
- **No backend change** — `GET /api/kitchen-config` and `PUT /api/kitchen-config/:id` already covered it, so no schema change and **no rebuild/restart of `EraevaBackend`**
- Checks: `tsc -b` clean for this file (remaining errors are pre-existing in `desktop/ui/tests/` — the known `@testing-library/dom` gap); ESLint 3 errors, byte-identical to HEAD (2× `no-explicit-any`, 1× `react-hooks/set-state-in-effect`)
- Branch: `feature/admin/kitchen-config-search-dropdown` (kept, not deleted) · Ref: `context/fix-plan/kitchen-config-search-and-dropdown.md` · Commit `d6335d6`, merged fast-forward into `restaurant-build`; **not pushed**

### fullstack - 2026-09-26 — Cashier Marked-Unpaid UI: Actor Attribution, Action Parity & Chase Columns
- **Who marked it unpaid** — new `unpaidMarkedByLabel()` in `lib/utils.ts` plus a `useUserRoles()` hook and a shared `MarkedByBadge` render **Cashier Marked** / **Manager Marked** / **System Marked** on all four surfaces (Orders All, Orders Marked Unpaid, Payment Marked Unpaid, order details). No schema or migration: the three flows already persist an actor, so it reads `unpaidAcknowledgedById` and resolves the role live. `null` actor = system auto-close; a missing or deleted user falls through to Manager Marked. Roles are read live by decision — no historical snapshot, and a later promotion changes the label
- **Mark Unpaid button** — recoloured red and relabelled from "Can't Pay — Mark Unpaid" to **Mark Unpaid**, matching the shift-close dialog's button for the same action. It had been the same green as the adjacent **Pay** button, so marking unpaid and taking money looked identical
- **Hidden on already-parked orders** — the button is now gated on `!unpaidAcknowledged`. Beyond being a no-op, it called `markOrderUnpaidWithCustomer`, which re-stamps `unpaidAcknowledgedAt = now()`, so a stray click silently reset a 3-day-old order's Marked age to 0m and could flip its warning colour. **Pay** is now the only action on a parked-unpaid order
- **Action parity** — Payment's Marked Unpaid rows gained the same **Change/Assign Customer · Remove · Undo Mark** actions Orders already had, via a second `CustomerPickerDialog` (the existing one is wired to the mark-unpaid call, so reusing it would have re-marked instead of assigning)
- **Chase columns trimmed** — both Marked Unpaid tables reduced to **Order # · Customer · Total · Marked By · actions**. This **removed the live "Marked" age column from the row** (it remains readable in the details dialog) — noting the deliberate loss, since ageing was the original point of that tab. Payment needed its own column set, as the New Unpaid category still needs Meal/Waiter and has no "Marked By" by definition
- **Date column scoped** — dropped when a view is entered from a shift card, since those rows are all one operation day and the column repeated the same value; kept in **All Shifts**, which spans days and filters by date
- **Entry cards centred** — `ShiftEntryRow` / `ShiftEntryCard` / `shiftTimeRange` extracted and shared by Orders, Payment and Voids: one `flex-nowrap` row of `w-60 shrink-0` cards, centred with `w-fit mx-auto` rather than `justify-center` (which clips the first card on overflow). Root cause of narrow-viewport clipping was `AdminLayout`'s content column lacking `min-w-0`, so it could not shrink and the row never scrolled. Verified at 1440/1024/760/700
- Tests: `unpaid-marked-by.test.ts` 6/6, with `elapsed.test.ts` 9/9 (15 total). `waiter-menu-grid.test.tsx` still fails to collect on a missing `@testing-library/dom` — pre-existing. Verified live against `eraevadb`: order #39 re-marked by an `admin` correctly reads Manager Marked, and both tables agree on the five columns
- Branch: `feature/cashier/customer-accounts` · Ref: `context/fix-plan/customer-accounts.md` · Merged fast-forward into `main`; **not pushed**

### fullstack - 2026-09-26 — Customer Accounts Phase 2: Unpaid Backlog, Auto-Close & Chase Ageing
- **Auto-close marks unpaid orders** — `autoCloseExpiredShifts()` now acknowledges every pending non-void order of a fully auto-closing shift in the same transaction that closes it (`unpaidAcknowledgedById: null`) and emits `order.unpaid-ack` per order; manual-close shifts are deliberately skipped so the close gate still needs a manager. Verified idempotent — a second pass never re-stamps `unpaidAcknowledgedAt`
- **New `GET /api/orders/unpaid-count`** counting `unpaidAcknowledged && !isPaid && !isVoid`; `/orders/count` is untouched (the waiter preview depends on it). Badge moved from Customers to the **Cashier** nav item and now counts assigned *and* unassigned acknowledged orders
- **Shift scoping fixed** — all three Cashier views (Orders/Payment/Void) were receiving `operationDay` and dropping it on the floor, so a DAY card showed every DAY shift in history. Each now requires `shiftType` **and** `operationDay`; the date picker and its filter are All-Shifts-only. Entry cards prefer the open shift's `operationDay` over the newest
- **Chase ageing** — `formatElapsed` / `elapsedSeverity` in `lib/utils.ts`; **Waiting** (from `createdAt`), **Marked** (from `unpaidAcknowledgedAt`), **Paid At** (on paid tabs, replacing `createdAt`), with `< 12h` neutral / `12h–2d` amber / `> 2d` red colouring via a new `columnsForOrdersTab()` selector
- **Process-crash fix** — removing the dead `/customers/needs-customer` route exposed `GET /customers/:id` to non-UUID input, and the resulting unhandled rejection took down the entire backend. All three `:id` routes now validate the UUID (400) and return 500 instead of rethrowing
- **Live-refresh gap** — `PaymentView` was the only view not listening for `order.customer-assigned` / `order.customer-unassigned`; all 4 arrays now do
- Marked-unpaid actions relabelled to **Assign Customer** / **Change Customer**, still routed through `assign-customer` so the mark timestamp survives
- Dead `needs-customer` path deleted end-to-end (Express route, `customer:get-needs-customer` IPC, preload method, `ElectronAPI` type, `getOrdersNeedingCustomer()`)
- Reports/shift-close deliberately unchanged — a late payment keeps its original `shiftId` and reports derive live from `shift.orders`
- Tests: `customer-assignment.test.ts` 11/11 (also repaired 2 pre-existing broken tests + a `Customer`/`ShiftConfig` truncation gap in `setup.ts` that leaked fixed phone numbers between runs); new `elapsed.test.ts` 9/9
- Note: `backend/tests/` is gitignored, so the backend suite is force-added (`git add -f`) with this change

### fullstack - 2026-09-26 — Customer Accounts (Simplified — No Auth)
- **Phase 1 (complete, verified end-to-end):** cashier flow is live — All Shifts entry cards, "Can't Pay" marks an order unpaid *and* attaches a customer in one call, and the **Marked Unpaid** tab gained a Customer column with Assign / Change / Remove / Undo Mark actions
- `CustomerPickerDialog` now debounces its search, loads on open, enforces `disabledReason`, surfaces errors, and can create a customer inline
- `GET /api/customers/:id` now returns the real ledger: `orders` (open), `settledOrders`, `cancelledOrders`, `outstandingTotal`, plus a reverse `replacedByOrderNumber` lookup so "Replaced by #N" is accurate
- Removed dead code: customer display in `ShiftCloseDialog` (impossible by construction — it lists `!unpaidAcknowledged` orders, which `assign-customer` rejects) and the misleading "or customer" search placeholder
- `GET /orders` now returns `Customer` on every order; `order.customer-assigned` / `order.customer-unassigned` added to all live-refresh arrays; `MARKED_UNPAID` badge count no longer counts voided orders
- Backend rejects non-UUID `*ById` values with `400` instead of an opaque Prisma `P2007` 500
- **Verified live against the running backend:** assign, remove (keeps unpaid mark), undo mark (clears customer), combined unpaid-ack+assign, needs-customer worklist, ledger totals, `409` on linked-customer delete, `409` on duplicate phone. Test data removed; order restored to its original state
- Added `Customer` model (`name`, `phone` unique stripped of spaces, `notes`) + 3 nullable `Order` fields (`customerId`, `customerAssignedById`, `customerAssignedAt`, `onDelete: SetNull`); DB applied via `prisma db push` (additive, no data loss)
- New `routes/customers.ts` (+ list/search, CRUD, needs-customer worklist, ledger); `routes/orders.ts` extended (include Customer in GET, `unpaid-ack` with optional `customerId`, `unpaid-ack-undo` clears customer I8, assign/unassign endpoints)
- `app.ts` registers `/api/customers`; `tests/customer-assignment.test.ts` written (note: `backend/tests/` is gitignored, so it is not committed)
- Plan: `context/fix-plan/customer-accounts.md` (simplified, auth deferred, trusted LAN); branch: `feature/cashier/customer-accounts`
- Note: `prisma migrate dev` chain is broken on pre-existing `Category` drift, so the migration was written by hand at `backend/prisma/migrations/20260926000000_customer_accounts/migration.sql` and applied with `prisma db push` (repo convention)

### fullstack - 2026-08-28 — One Cooking Record Per Menu (Cooked Food Pool Consistency)
- Dropped `CookingRecordAssignment` table entirely; `CookingRecordMenu` now stores `platesAllocated` + `platesRemaining` directly (was `quantityPlates`)
- `recomputeMenuStock()` recalculates `Menu.stock` as sum of all `platesRemaining` per menu (FIFO across splits)
- Order decrement picks the menu's earliest active split (remaining > 0) for that date — never below 0
- Assignment modal rewritten: pool-cap display, delta +/- per menu, drift check, top-up support
- Cooked food table: single row per cooking record with per-menu split breakdown
- Plate movement report: Cooked column from `CookingRecordMenu.platesAllocated`, variance highlighting
- Schema: `CookingRecordMenu` replaces composite PK with single `id`, unique index on `[cookingRecordId, menuId]`; `platesRemaining` added; `quantityPlates` removed
- Deleted `backend/routes/cookingAssignments.ts` (382 lines) — all logic merged into `cookingRecords.ts`
- DB wipe + re-seed of kitchen/cooking/assignment data onto new model
- `ShiftReport.tsx` + `ShiftCloseDialog.tsx` plate movement: opened/closed section, Cooked column, variance highlight
- `lib/api.ts` + `electron.d.ts`: `allocateCookingRecord`, `topUpCookingRecord`, updated types
- `WaiterMenuGrid.tsx` + `Menu.tsx` minor fixes
- Branch: `feature/kitchen/one-record-per-menu`
- Ref: `context/fix-plan/cooked-food-one-record-per-menu.md`


### backend - 2026-09-12 — Remote Ops (SSH) + Isolated Dev Scope
- Local admin `ops` created; OpenSSH hardened, key-only (pending Mac key install) so this server is fully operable over SSH while staff use the console (RDP no longer needed) — restart bridge `pos-backend-restart` (SYSTEM/Highest) runs `scripts/restart-backend.cmd` over SSH with no UAC; Access: `ssh -N -L 3111:127.0.0.1:3111 -L 5123:127.0.0.1:5123 -L 5433:127.0.0.1:5432 ops@<tailscale-ip>`
- Dev isolation: `eraevadb_dev` + role `era_dev` (no prod DB access), schema pushed + dev admin/users seeded, gitignored `backend/.env.development` (PORT=3111, BIND=127.0.0.1, scheduler off), `backend/load-env.ts` (loads `.env` on production, `.env.development` otherwise), `app.listen(PORT, BIND)`; verified dev backend 127.0.0.1:3111 only, prod :3001 + `eraevadb` untouched
- Detached dev stack via `dev:remote:start|stop` (survives SSH disconnect); killed pre-existing 0.0.0.0 dev leftovers
- Browser live view: rebuilt `dist-react` with `build:web -- --server http://192.168.100.45:3001` so `http://192.168.100.45:3001` shows live operations in a browser (re-run after every plain `vite build`)

### backend - 2026-09-12 — Shift Data Scoped to Operation Date (per-shift membership)
- Every shift's data (orders, payments, voids, reports, unpaid close gate) stays scoped to the shift's OWN orders intersected with its operationDay window `[operationDay, operationDay + 1d)` — no leakage across dates or between DAY/NIGHT shifts on the same date
- `shifts.ts`: new `belongsToOperationDay()` helper; manual-close `blockingUnpaid` now only counts the closing shift's own orders within its operation date; shift-list orderCount/revenue summaries date-scoped
- `orders.ts`: new orders attach to the open shift of the current operation date first (fallback: newest open shift keeps the no-orphan + "No active shift" guard)
- `dailyReport.ts`: shift report aggregates the shift's membership filtered to its operation date (was: all orders of the date), keeping DAY/NIGHT reports separate; summary totals use the same scoped list
- `ShiftCloseDialog.tsx`: close-dialog stats (unpaid, blocking, cash/M-Pesa, revenue) filtered to the same operation-day window
- Verified live on :3001 — DAY 09-06 report shows its own 3 orders, NIGHT 09-11 shows 0
- Deployed: backend rebuilt + `EraevaBackend` service restarted, `/health` 200; merged to `restaurant-build` (impact `4613d04`)
- Branch: `feature/cashier/operation-date-scoping`

### frontend - 2026-09-12 — Waiter Accompaniment Picker Redesign + "None" Option
- Waiter detail panel now shows accompaniments via the Free/Charged toggle: Free group (with an always-present "None" card at the end) is the default view; tapping Charged hides free cards and shows charged options (Ugali Brown, etc.); tapping Free restores them; toggling never clears a selection
- "None" is a real fourth selection: captured as null starchId/vegetableId on the order, shown as a "None" chip in the order column, and printed as "No starch"/"No vegetables" on both the customer and kitchen tickets (note-style, no FREE/+KSH tag)
- Add-to-Order no longer disabled for missing accompaniments; backend `orders.ts` requirement relaxed accordingly (no schema change — OrderItem.starchId/vegetableId were already nullable)
- Occurrence in `WaiterMenuGrid.tsx`, `WaiterMenu.tsx`, `receiptTemplate.ts`, `electron.d.ts`, `backend/routes/orders.ts`
- Deployed: backend rebuilt (`npm run build --prefix backend`) + EraevaBackend service restarted, `/health` 200 on :3001; merged to `restaurant-build` (feature branch kept)
- Cleanup: removed stale committed duplicate client `backend/prisma/generated`, pm2 `ecosystem.config.cjs`, and `scripts/start-backend.bat`; `server:*` npm scripts repointed to the NSSM service
- Branch: `feature/waiter/accompaniment-picker-none`
### frontend - 2026-10-04 — Shift-Scoped Batch Numbers with FIFO Enforcement
- **Shift-scoped batches:** Batch numbers reset per (stockSupplyId, shiftId) starting at 1 for each shift. Carried-over unallocated batches from prior shifts retain their original batch numbers and must be allocated first (FIFO within shift).
- **Schema:** Updated `CookingRecord` unique constraint to `@@unique([stockSupplyId, shiftId, batchNumber])`.
- **Backend logic:** Assignment computes next batch number per supply and shift on create; FIFO enforcement in allocate and top-up checks only earlier batches within the same shift.
- **UI:** Added "BAT No." column to Kitchen Production and Cooking History; tables made horizontally scrollable when >10 columns; Kitchen Production shows latest batch number per item; Cooking History sorted ascending (oldest first) with edit dialog selecting latest by `createdAt`.
- **Migration/backfill:** Created shift-scoped backfill script and updated types.

### backend - 2026-10-04 — Order Allocation Traceability (Batch/Shift)
- Added `OrderItemAllocation` model to track which `CookingRecord`/`CookingRecordMenu` (batch/shift) consumed plates for each sold `OrderItem`.
- On order creation: record allocations during FIFO split consumption with `cookingRecordId`, `cookingRecordMenuId`, and plates consumed.
- On order void/cancel: delete allocations and restore plates back to the consumed splits.
- Enables per-batch, per-shift sold consumption tracking for accurate FIFO and reporting.
