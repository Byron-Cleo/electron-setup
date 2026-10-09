
## Platform

frontend

## Status

In Progress

## Goals

- Remove the redundant **Production Guidance** table from the Menu/Dispatch home dashboard; delete the dead `ProductionGuidanceCard.tsx` component so the dashboard is 3 cards → Menu Plate Movement (last section)
- Keep `GET /api/menu/stock-status` / `getMenuStockStatus()` untouched — still feeds `MenuStockStatusCard` (menu plate movement), so it is NOT dead code
- Raise the **Running Low** threshold from 5 → **10** plates in the Menu Plate Movement section (backend `RUNNING_LOW_THRESHOLD` + "Running Low (≤ 10)" title)
- Apply the same 10 cutoff to the waiter POS grid cues (`runningLow` / `inStock` / `platesBadgeClass`) — operator opted in for consistency
- **DESSERT stays** everywhere (plate movement chips, waiter POS landing, ServingPeriodBar, AllMenuTable, Prisma enum) — removal request reversed mid-planning
- Dashboard cards renamed + reordered: **Leftover Food Stock** (operator iterated "Remaining Stock Production" → "Leftover Stock" → "Leftover Food Stock"; destination page heading updated to match) placed 2nd; **All Restaurant Menu** moved to the far end (3rd)
- Menu item create/edit dialog (`MenuForm.tsx` via `CreateMenuDialog.tsx`) restructured two-column: left = name/category/price/images/meal periods; right = Served with Starch? and Served with Vegetable? radios **side by side** (`grid-cols-2`), "Sold in Portions?" below them with portion cards (`max-h-[55vh]` internal scroll); **Cancel/Save centered** (`justify-center`) below both columns; dialog width `sm:max-w-3xl` (896px proved too wide — trimmed per operator)
- Waiter menu food cards compacted: `py-0` on the food Card strips the shared Card primitive's built-in 16px top/bottom padding (card's own `CardContent p-3` stays) — more dishes visible per screen
- Accompaniment radio option cards (Served With / Vegetables + None card) vertically compacted — `p-1.5`, `gap-1`, image `h-8`, radio `size-3.5`, Size rows `py-1` — so the detail panel fits the smaller restaurant screen and Add to Order is reachable without scrolling; **Free/Charged toggle untouched** (operator stress: radio options only)
- Receipt/report printing font centralized into one exported `RECEIPT_FONT` stack (`receiptTemplate.ts`) — applied to all tickets, shift report, plate-movement `<pre>`, and the printer test page; **candidate 1 = Consolas** (operator approved — kept), queue if ever needed: Lucida Console → Verdana → DejaVu Sans Mono → IBM Plex Mono/Roboto Mono/Courier Prime (one-line swap + `transpile:electron`)
- Apydy printed footers: `services` = "Hotel Systems, Supermarket Systems, Website Apps, Mobile Applications" (operator iterating wording: Web Design → Website Applications and Design → "Website Apps"; Mobile Development → "Mobile Applications"; an "AI Chatbots & WhatsApp Ordering" line was added then **withdrawn by operator — "for now"**); shift report printing **gained** the Apydy footer (template never printed poweredBy/tel/services before) — payloads updated in WaiterMenu.tsx (receipt + preview), ShiftReport.tsx, ShiftCloseDialog.tsx; raw ESC/POS path prints `r.services` automatically
- Dev-test locally first; production backend deploy deferred until the operator approves

## Notes

- **Spec**: `context/fix-plan/production-guidance-removal-running-low-10.md` · **Branch**: `feature/admin/remove-production-guidance`
- **Exact edits** (line numbers from current HEAD):
  - `desktop/ui/pages/admin/Menu.tsx` — delete import L14 + `{view === "dashboard" && <ProductionGuidanceCard />}` L176; ALSO swapped card order (Leftover Stock 2nd, All Restaurant Menu 3rd) + renamed the "Remaining Stock Production" card heading to "Leftover Stock" — applied manually per operator decision after unusable deepseek-coder output (fallback rule)
  - `desktop/ui/components/menu/ProductionGuidanceCard.tsx` — DELETE file (only consumer is Menu.tsx; local `RUNNING_LOW_THRESHOLD = 5` dies with it)
  - `backend/routes/menu.ts` L247 — `RUNNING_LOW_THRESHOLD = 5` → `10` (drives the `runningLow` bucket of `/api/menu/stock-status`)
  - `desktop/ui/components/menu/MenuStockStatusCard.tsx` L187 — `"Running Low (≤ 5)"` → `"Running Low (≤ 10)"`
  - `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` — L414 `servings <= 5` → `<= 10`; L415 `inStock = servings > 5` → `> 10`; L97 `platesBadgeClass` green cutoff `plates > 5` → `> 10` (used by grid card badge, detail panel, order-context badges)
- **Expected side effect**: admin sidebar badge via `GET /api/menu/running-low-count` (`AdminLayout.tsx`) shares the backend constant — it will now count items with 1–10 plates
- **Verification**: `npm run lint` + `npm run build`; backend `npm run build --prefix backend` (constant-only change, no schema/migration, no `db:sync`)
- **Deploy (deferred until operator dev-tests)**: `npm run build --prefix backend` → `npm run server:restart` → verify `server:status` RUNNING + `/health`; after any plain `npm run build` / `build:win`, re-run `npm run build:web -- --server same-origin` (browser live-view rule)

## History

### 2026-10-09 — Cashier M-Pesa + Cash Partial Payments, All-Shift Headings, Marked-Unpaid Traceability

- **M-Pesa + Cash (Partial)** — third payment method `"mpesa-cash-partial"` in BOTH payment dialogs (single-order Pay dialog + batch wizard Step 1), all three method cards side by side in a compact 3-column row (MC / M / C circles); cashier keys the M-Pesa and Cash portions (Smartphone / Banknote input icons) and **Confirm Payment stays disabled** with live `Remaining / Over by — keyed KSH X of KSH Y` feedback until the portions sum exactly to the order total (cents comparison); the split-input card itself renders red until balanced, green when it is
- **Persistence** — `Order.mpesaAmount` / `cashAmount` `Decimal(12,2)` nullable + hand-written migration `20261008130000_mpesa_cash_partial` (`db push` per convention); `PATCH /orders/:id/payment` whitelists the new method, requires non-negative amounts summing to `totalPrice` (400s: invalid method / missing amounts / negative / sum mismatch) and clears stale amounts on pure cash/mpesa re-payment; batch mode keys two batch-level totals ONCE and `allocateBatchSplit` (new `lib/payment.ts`) pours M-Pesa across the selected orders sequentially so per-order portions sum exactly — no rounding drift
- **Reports** — `cashTotal`/`mpesaTotal` now ALL-IN (direct + partial portions) so `cashTotal + mpesaTotal === paid revenue` and variance-vs-declared keep working; new `cashDirect/cashFromPartial/mpesaDirect/mpesaFromPartial` + `partial {count,total,mpesaTotal,cashTotal}`; 4-card reconciliation in ShiftCloseDialog (live stats, Step-1 summary, post-close view), ShiftReport and the printed HTML template — cards read `Direct … Amount:` → `From M-Pesa + Cash Orders' Amount:` → `Manager Declared Amount:` → bold Total (last, just before Variance); partial card: `Total Orders:` / portion amounts / bold `Total Partial Amount:`; declaration deliberately stays 2 inputs (partial money is physically mixed into drawer/M-Pesa — variance compares against all-in totals)
- **All-Shift headings** — "All Shift Orders" / "All Shift Payments" when the All Shifts card is selected (was generic "Orders" / "Payment")
- **Marked-unpaid traceability** — sidebar cashier badge recolored red (was amber); the same `GET /orders/unpaid-count` figure now shows as red badges on the All Shifts entry cards and as red pills on the Marked Unpaid tabs in BOTH Orders and Payment views; OrdersView MARKED_UNPAID filter/count aligned with the sidebar definition (`unpaidAcknowledged && !isPaid && !isVoid` — the missing `!isPaid` made the tab read 16 vs the sidebar's 2 on live data: 14 historically-marked orders had since been paid)
- **Lists** — Partial tab + "M-Pesa + Cash" badge in brown (new `brown-100..700` tokens in index.css); formatted method + split portions in the order details dialog and CustomerDetail
- Checks: `npm run db:sync` (client regenerated, columns pushed), `tsc -b` + backend `tsc` clean, ESLint zero new errors; live smoke on :3001 — all four 400 gates with no data mutation, report returns the new payments shape. Tests DEFERRED per operator (eraevadb_test server-pointer caveat recorded in the fix-plan)
- Ref: `context/fix-plan/mpesa-cash-partial-payment.md` · Branch: `feature/cashier/mpesa-cash-partial` (kept, not deleted) · Commit `3298b54`, merged `--no-ff` as `a43b575`, **pushed** to `origin/restaurant-build` · Deploy PENDING on the restaurant server (SSH flow): `git pull origin restaurant-build` → `npm run db:sync` → `npm run build --prefix backend` → `schtasks /run /tn pos-backend-restart` → verify `sc query EraevaBackend` + `/health`

### 2026-10-08 — Shift Reporting Update (Bounded Drift, Live-Pool Openings, Window-Accurate Reports)

- **Mutually exclusive time windows:** shift reports attribute orders by `[effectiveStart, effectiveEnd)` — actual end = `finalClosedAt` (MANUAL or FORCED) → `autoClosedAt` → `autoCloseTime` fallback; effective start = max(own open, immediately preceding shift's actual end). Drift-period orders belong to the extending shift; orders across midnight stay under the shift's immutable operationDay; no calendar-day splitting. Only the immediate predecessor clamps the start — an older stale close (the 10-06 case) must not swallow a successor's window, and the drift cap makes such out-of-order closes impossible going forward. Verified live on 10-07: DAY 8 / NIGHT 3 (was 1 / 10 by `shiftId`), 8+3 = 11 — no double-counting, no loss
- **Bounded drift policy:** `ShiftConfig.strictClose` (finalize exactly at scheduled close — no manager step, cash/M-Pesa declaration shows "—" as the tell) + `ShiftConfig.maxDriftMinutes` (manual-only, strictly user-defined, no enforced cap). Bounded shifts are force-closed by the scheduler at the **deadline** (`finalClosedAt = autoCloseTime + N`, not the tick moment — attribution stays deterministic), source `"FORCED"`, pending unpaid auto-acked, closing snapshot stamped; the manager can always close earlier — drift is a max, not a delay. Unlimited (`null`) is the migration default and a red flag: red `UNLIMITED ⚠` badges + inline warning until a limit is set; never force-closed. Synthetic live test: an overdue TEST shift stamped at exactly +300s, then cleaned up
- **Opening stock from the live pool (MANDATORY):** opening snapshots are ALWAYS the healed live pool (`recomputeMenuStock` → `Menu.stock`) at shift creation — the live pool IS the handover from the immediately preceding shift, whichever type. The old same-type carry (DAY→DAY / NIGHT→NIGHT recorded closing) is banned forever: it went stale whenever the other type sold after that shift closed (10-08 Liver: recorded 15 vs true 14 after NIGHT's 4:37AM sale). One-time data correction applied to the 10-08 DAY shift: Liver 15→14, Boiled Full 23→22, Boiled Half 23→22.50
- **Order-derived plate movement:** sold figures derive from the same window orders as revenue (`factor × qty`, non-void), pre-auto-close cut at `autoCloseTime`, `driftSold` = the difference — the report can never disagree with its own orders. Rows include menus sold without a snapshot (created mid-shift, e.g. Matumbo CFF — opening 0). Verified to the plate against the allocation ledger: DAY 43 plates / NIGHT 2.5. No backfill — 10-07 history self-corrected
- **Drift-window order attachment:** orders placed while a shift is inside its allowed drift attach to the drifting shift (oldest if several); the void guard shares the same resolver — close-gate/unpaid scoping and snapshot tallies stay coherent with window attribution
- **Window-consistent shift list:** `GET /api/shifts` orderCount/voidCount/revenue computed from the same windows via the shared `shiftActualEndTime` (bulk order fetch, bucketed per window) — the Reports landing-page table matches the report cards exactly (verified: DAY 8 / KSH 10,340 · NIGHT 3 / KSH 1,060)
- **Report UI:** Orders card capture span ("Orders Between 5:44 AM — 2:30 AM", orange, AM/PM); "opened by SYSTEM" in red caps; Revenue by Meal Period as reconciliation-style one-line pills (Breakfast green/Coffee · Lunch orange/UtensilsCrossed · Dinner red/MoonStar · others blue/Sparkles); Sold + Drift Sold Count columns red; Closing-Sale renamed **Closing Stock**; all report times 12-hour with AM/PM; Production vs Sales shows cost 0 with red **(Projection not yet implemented)** tag — raw-material costing deferred; closing drift reflects the true final close (10-07 DAY honestly shows 598 min late); `finalCloseSource`/`finalClosedAt` added to the payload; "System Closed — drift limit reached" badge
- **Schema:** migration `20261008120000_bounded_drift_policy` (`strictClose`, `maxDriftMinutes`), hand-written + `db push` per repo convention
- **Checks:** `tsc -b` + backend `tsc` clean; ESLint clean (2 pre-existing errors unchanged); config round-trip live-verified (strict clears drift, auto clears both, invalid → 400); 10-08 Liver reconciles 14 − 1 = 13
- **Deferred:** Mpesa-Cash Partial Payment card — `paymentMethod` supports only `cash` | `mpesa`; spec it in the fix-plan before building
- Files: `dailyReport.ts`, `orders.ts`, `shiftConfig.ts`, `shifts.ts`, `scheduler.ts`, `ShiftManagement.tsx`, `ShiftReport.tsx`, `ShiftCloseDialog.tsx`, `lib/api.ts`, `electron.d.ts`, `schema.prisma` + migration, fix-plan doc
- Ref: `context/fix-plan/shift-reporting-update.md` · Branch: `feature/cashier/shift-reporting-update` (kept, not deleted) · Commit `b92c053`, merged fast-forward into `restaurant-build`; **not pushed** · Deploy pending: `db:sync` → backend rebuild → `server:restart` → `/health`, plus the one-time 10-08 opening-stock correction on production if that shift exists there

### 2026-10-08 — Shared Production Pool Engine (Production Quality)

- **Shared production pool engine:** `ALLOCATED` (default hard-cap) and `SHARED` (whole pool sellable by every dish) modes implemented across backend routes, Prisma schema, and pool engine service
- **Pool-carry-over semantics:** unallocated/plates remaining carries over between shifts as `SHARED` mode; fractional values preserved as `Decimal(12,2)`
- **Portion support:** `MenuAccompaniment` PORTION category reuses existing price/receipt/kitchen-ticket machinery; `OrderItem.portionId` links to portion rows; portion price replaces `menu.price`
- **Backend routes:** `pools.ts`, updated `accompaniments.ts`, `menu.ts`, `orders.ts`, `shifts.ts`, `dailyReport.ts`, `cookingRecords.ts`, `kitchenConfig.ts`, `kitchenInventory.ts`, `stockRemaining.ts`, `carryOver.ts`, `scheduler.ts`
- **New Prisma migration:** `20261006000000_shared_production_pool/migration.sql` adding pool engine tables and schema updates
- **Frontend UI:** `MenuForm.tsx`, `KitchenStockConfig.tsx`, `AssignedLeftoversTable.tsx`, `AssignmentModal.tsx`, `CookedFoodTable.tsx`, `MenuStockStatusCard.tsx`, `ProductionGuidanceCard.tsx`, `RemainingStockDashboard.tsx`, `RemainingStockTable.tsx`, `ShiftReport.tsx`, `ShiftCloseDialog.tsx`, `WaiterMenuGrid.tsx`, `WaiterOrderContext.tsx`, `WaiterMenu.tsx`, `Menu.tsx`, `electron.ipc-handlers`, `electron.preload`, `electron.receipt.ts`, `electron.receiptTemplate.ts`, `electron.d.ts` types
- **Pool engine test:** `backend/tests/pool-engine.test.ts` with 343 lines of test coverage
- **Phase 1 bug fixes:** orders.ts allocation error handling, AssignmentModal stale snapshot, menu.ts totalAvailable gating split
- **Pushed to remote:** `restaurant-build` branch with 39 files changed, 4650 insertions, 1240 deletions
- **Shift enforcement (new records only):** `CookingRecord` creation requires an active shift (`findShiftIdForTime`); PUT rejects clearing `shiftId`/`batchNumber`. Schema remains nullable to preserve legacy NULL-shift rows; enforcement applies only to new records.
- **Batch numbering per (stockSupplyId, shiftId):** Next batch is computed per supply+shift starting at 1; FIFO enforced in allocate/top-up (cannot allocate from newer batch while older batches in same shift have unallocated plates). Legacy rows with NULL shift retain their existing batch numbers.
- **Batch traceability surfaced:** `batchNumber` included in remaining/expired/wasted batch payloads (shiftCarryOver); Remaining Stock Production table adds "Batch No." column with horizontal scroll (`overflow-x-auto`, `min-w-[1200px]`).
- **Batch-strict sold/remaining (UI + API):** Remaining Stock Production shows per-batch-menu sold as `(platesAllocated - platesRemaining)`. Menu/Dispatch (`/api/menu/cooked`) computes `totalSold = allocatedTotal - remainingTotal` (batch-local) and `totalAvailable = allocatedTotal > 0 ? remainingTotal : produced` to avoid cross-batch leakage in display.
- **Deduction remains FIFO:** Order creation consumes splits oldest-first (`createdAt ASC`) and records `OrderItemAllocation` per consumed chunk; void/cancel restores plates to consumed splits. Core accounting already batch-isolated; presentation aligned to batch-strict semantics.
- **Type safety + build:** Interfaces updated to include `batchNumber`; backend builds clean (`tsc`), frontend builds clean (`vite build`), UI TypeScript compiles clean.
- **Design goals (archived from spec):** whole produced pool sellable by every dish derived from a supply with **zero allocation clicks** where the split cannot be guessed (Fish, milk, Chapati); hard-cap allocation kept where a real reservation decision exists but **weighted** so fractional servings deduct correctly (Boiled Meat Half `0.5` deducts `2.0` plates for 4 servings, not `4`); portions (Fried Eggs 1pc / 2pc) reusing the existing accompaniment convention, priced separately and summed; exact traceability (every sold plate recorded against its `CookingRecord` + menu, void restores the same batch); carry-over preserved — unallocated (`ALLOCATED`) or unconsumed pool (`SHARED`) becomes the next shift's opening stock and a 9.5 pool carries over as **exactly 9.5**; shipped with **Fish left on `ALLOCATED`** (behaviour byte-identical to today) as the safety net
- **Design decisions (archived from spec):** two engines in one codebase chosen per supply, mode **frozen onto `CookingRecord` at cook time** (never read from `StockSupply` at order time, so supplies migrate one at a time); `SHARED` legal only when every dish consumes exactly 1 unit, enforced in `KitchenStockConfig` via `consumptionFactorsForMenu()`; `platesPerServing` on `StockSupplyMenu` (boiled meat 0.5 / 1.0) and `MenuAccompaniment` PORTION rows (fried eggs 1 / 2) with servings recovered via `platesAllocated ÷ platesPerServing`; **portion price replaces `menu.price`**; allocation stays at menu level in base units; Int → `Decimal(12,2)` was mandatory for `Menu.stock` + 7 `ShiftSnapshot` columns; sold-out dishes stay hidden entirely (confirmed decision — greyed card stays dead code, dishes reappear within 5s of a new batch); known accepted gap — `SHARED` ships with no production user because Fish stays `ALLOCATED` by request, `milk` or `Chapati Flour` are the first candidates; report inflation solved via `ShiftSnapshot.sellingMode` with the mode branch in one shared helper; build order was Phase 1 bugs → schema/migration → backend → frontend → data config, deployed per AGENTS.md (`db:sync` → `build --prefix backend` → `server:restart` → `/health`). Ref: `context/fix-plan/shared-production-pool-engine.md` · Branch: `feature/admin/shared-production-pool`

### 2026-10-04 — Shift-Scoped Batch Numbers with FIFO Enforcement
- **Shift-scoped batches:** Batch numbers reset per (stockSupplyId, shiftId) starting at 1 for each shift. Carried-over unallocated batches from prior shifts retain their original batch numbers and must be allocated first (FIFO within shift).
- **Schema:** Updated `CookingRecord` unique constraint to `@@unique([stockSupplyId, shiftId, batchNumber])`.
- **Backend logic:** Assignment computes next batch number per supply and shift on create; FIFO enforcement in allocate and top-up checks only earlier batches within the same shift.
- **UI:** Added "BAT No." column to Kitchen Production and Cooking History; tables made horizontally scrollable when >10 columns; Kitchen Production shows latest batch number per item; Cooking History sorted ascending (oldest first) with edit dialog selecting latest by `createdAt`.
- **Migration/backfill:** Created shift-scoped backfill script and updated types.

### 2026-10-04 — Order Allocation Traceability (Batch/Shift)
- Added `OrderItemAllocation` model to track which `CookingRecord`/`CookingRecordMenu` (batch/shift) consumed plates for each sold `OrderItem`.
- On order creation: record allocations during FIFO split consumption with `cookingRecordId`, `cookingRecordMenuId`, and plates consumed.
- On order void/cancel: delete allocations and restore plates back to the consumed splits.
- Enables per-batch, per-shift sold consumption tracking for accurate FIFO and reporting.

### 2026-10-03 — Kitchen Config Search & Edit (Drop the Add Flow)
- **Obsolete add-flow removed** — `GET /api/kitchen-config` already returns **every** active stock supply (`where: { isActive: true }`), so **Add Configuration** had nothing left to add: its dropdown only picked an item out of the list that *was* the table. Deleted the button, `openCreate()`, `selectedSupplyId`, the stock-item `Select`, and the now-redundant `getStockSupplies()` call — `getKitchenConfig()` is the single source for the view
- **Search across the whole row** — new `search` state matches stock item name, **unit**, or any linked **menu item name** (case-insensitive, trimmed). No manual page reset is needed because `usePagination` already clamps `currentPage` to `totalPages`, so the pager self-corrects as the filtered list shrinks
- **Edit-only dialog** — title fixed to **Edit Configuration**; the stock item renders as read-only `name (unit)` instead of a disabled select. `handleSave()` now saves against `editItem.id` and still validates `platesPerUnit > 0`
- **Status column** — new column reads **Configured** (`platesPerUnit > 0`, green) / **Not set** (`null`/`0`, amber), so unset items are visible without opening each row. On the 15 seeded items: 4 configured, 11 not set
- **Copy corrected** — the empty message pointed at the button that no longer exists ("Click 'Add Configuration' to get started"); it now names the active query, and the header paragraph tells the user to search then Edit
- **Verified live on :3001 + `eraevadb`** — Edit → Save persisted to Postgres (`Cabbage` → `4.50`) and the Status badge flipped in step; reverted afterwards, so data is unchanged (still Beef 6, Chapati Flour 23, Fish 1, Liver 6). Search confirmed by unit (`"pcs"` → Chicken, Fish) and by menu name alone (`"chapatis"`, which the stock item name "Chapati Flour" does not contain); a no-match search shows `No stock items match "zzzz".` with the pager at `Page 1 of 1`
- **No backend change** — `GET /api/kitchen-config` and `PUT /api/kitchen-config/:id` already covered it, so no schema change and **no rebuild/restart of `EraevaBackend`**
- Checks: `tsc -b` clean for this file (remaining errors are pre-existing in `desktop/ui/tests/` — the known `@testing-library/dom` gap); ESLint 3 errors, byte-identical to HEAD (2× `no-explicit-any`, 1× `react-hooks/set-state-in-effect`)
- Branch: `feature/admin/kitchen-config-search-dropdown` (kept, not deleted) · Ref: `context/fix-plan/kitchen-config-search-and-dropdown.md` · Commit `d6335d6`, merged fast-forward into `restaurant-build`; **not pushed**

### 2026-09-26 — Cashier Marked-Unpaid UI: Actor Attribution, Action Parity & Chase Columns
- **Who marked it unpaid** — new `unpaidMarkedByLabel()` in `lib/utils.ts` plus a `useUserRoles()` hook and a shared `MarkedByBadge` render **Cashier Marked** / **Manager Marked** / **System Marked** on all four surfaces (Orders All, Orders Marked Unpaid, Payment Marked Unpaid, order details). No schema or migration: the three flows already persist an actor, so it reads `unpaidAcknowledgedById` and resolves the role live. `null` actor = system auto-close; a missing or deleted user falls through to Manager Marked. Roles are read live by decision — no historical snapshot, and a later promotion changes the label
- **Mark Unpaid button** — recoloured red and relabelled from "Can't Pay — Mark Unpaid" to **Mark Unpaid**, matching the shift-close dialog's button for the same action. It had been the same green as the adjacent **Pay** button, so marking unpaid and taking money looked identical
- **Hidden on already-parked orders** — the button is now gated on `!unpaidAcknowledged`. Beyond being a no-op, it called `markOrderUnpaidWithCustomer`, which re-stamps `unpaidAcknowledgedAt = now()`, so a stray click silently reset a 3-day-old order's Marked age to 0m and could flip its warning colour. **Pay** is now the only action on a parked-unpaid order
- **Action parity** — Payment's Marked Unpaid rows gained the same **Change/Assign Customer · Remove · Undo Mark** actions Orders already had, via a second `CustomerPickerDialog` (the existing one is wired to the mark-unpaid call, so reusing it would have re-marked instead of assigning)
- **Chase columns trimmed** — both Marked Unpaid tables reduced to **Order # · Customer · Total · Marked By · actions**. This **removed the live "Marked" age column from the row** (it remains readable in the details dialog) — noting the deliberate loss, since ageing was the original point of that tab. Payment needed its own column set, as the New Unpaid category still needs Meal/Waiter and has no "Marked By" by definition
- **Date column scoped** — dropped when a view is entered from a shift card, since those rows are all one operation day and the column repeated the same value; kept in **All Shifts**, which spans days and filters by date
- **Entry cards centred** — `ShiftEntryRow` / `ShiftEntryCard` / `shiftTimeRange` extracted and shared by Orders, Payment and Voids: one `flex-nowrap` row of `w-60 shrink-0` cards, centred with `w-fit mx-auto` rather than `justify-center` (which clips the first card on overflow). Root cause of narrow-viewport clipping was `AdminLayout`'s content column lacking `min-w-0`, so it could not shrink and the row never scrolled. Verified at 1440/1024/760/700
- Tests: `unpaid-marked-by.test.ts` 6/6, with `elapsed.test.ts` 9/9 (15 total). `waiter-menu-grid.test.tsx` still fails to collect on a missing `@testing-library/dom` — pre-existing. Verified live against `eraevadb`: order #39 re-marked by an `admin` correctly reads Manager Marked, and both tables agree on the five columns
- Branch: `feature/cashier/customer-accounts` · Ref: `context/fix-plan/customer-accounts.md` · Merged fast-forward into `main`; **not pushed**

### 2026-09-26 — Customer Accounts Phase 2: Unpaid Backlog, Auto-Close & Chase Ageing
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

### 2026-09-26 — Customer Accounts (Simplified — No Auth)
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

### 2026-09-12 — Remote Ops (SSH) + Isolated Dev Scope
- Local admin `ops` created; OpenSSH hardened, key-only (pending Mac key install) so this server is fully operable over SSH while staff use the console (RDP no longer needed) — restart bridge `pos-backend-restart` (SYSTEM/Highest) runs `scripts/restart-backend.cmd` over SSH with no UAC; Access: `ssh -N -L 3111:127.0.0.1:3111 -L 5123:127.0.0.1:5123 -L 5433:127.0.0.1:5432 ops@<tailscale-ip>`
- Dev isolation: `eraevadb_dev` + role `era_dev` (no prod DB access), schema pushed + dev admin/users seeded, gitignored `backend/.env.development` (PORT=3111, BIND=127.0.0.1, scheduler off), `backend/load-env.ts` (loads `.env` on production, `.env.development` otherwise), `app.listen(PORT, BIND)`; verified dev backend 127.0.0.1:3111 only, prod :3001 + `eraevadb` untouched
- Detached dev stack via `dev:remote:start|stop` (survives SSH disconnect); killed pre-existing 0.0.0.0 dev leftovers
- Browser live view: rebuilt `dist-react` with `build:web -- --server http://192.168.100.45:3001` so `http://192.168.100.45:3001` shows live operations in a browser (re-run after every plain `vite build`)

### 2026-09-12 — Shift Data Scoped to Operation Date (per-shift membership)
- Every shift's data (orders, payments, voids, reports, unpaid close gate) stays scoped to the shift's OWN orders intersected with its operationDay window `[operationDay, operationDay + 1d)` — no leakage across dates or between DAY/NIGHT shifts on the same date
- `shifts.ts`: new `belongsToOperationDay()` helper; manual-close `blockingUnpaid` now only counts the closing shift's own orders within its operation date; shift-list orderCount/revenue summaries date-scoped
- `orders.ts`: new orders attach to the open shift of the current operation date first (fallback: newest open shift keeps the no-orphan + "No active shift" guard)
- `dailyReport.ts`: shift report aggregates the shift's membership filtered to its operation date (was: all orders of the date), keeping DAY/NIGHT reports separate; summary totals use the same scoped list
- `ShiftCloseDialog.tsx`: close-dialog stats (unpaid, blocking, cash/M-Pesa, revenue) filtered to the same operation-day window
- Verified live on :3001 — DAY 09-06 report shows its own 3 orders, NIGHT 09-11 shows 0
- Deployed: backend rebuilt + `EraevaBackend` service restarted, `/health` 200; merged to `restaurant-build` (impact `4613d04`)
- Branch: `feature/cashier/operation-date-scoping`

### 2026-09-12 — Waiter Accompaniment Picker Redesign + "None" Option
- Waiter detail panel now shows accompaniments via the Free/Charged toggle: Free group (with an always-present "None" card at the end) is the default view; tapping Charged hides free cards and shows charged options (Ugali Brown, etc.); tapping Free restores them; toggling never clears a selection
- "None" is a real fourth selection: captured as null starchId/vegetableId on the order, shown as a "None" chip in the order column, and printed as "No starch"/"No vegetables" on both the customer and kitchen tickets (note-style, no FREE/+KSH tag)
- Add-to-Order no longer disabled for missing accompaniments; backend `orders.ts` requirement relaxed accordingly (no schema change — OrderItem.starchId/vegetableId were already nullable)
- Occurrence in `WaiterMenuGrid.tsx`, `WaiterMenu.tsx`, `receiptTemplate.ts`, `electron.d.ts`, `backend/routes/orders.ts`
- Deployed: backend rebuilt (`npm run build --prefix backend`) + EraevaBackend service restarted, `/health` 200 on :3001; merged to `restaurant-build` (feature branch kept)
- Cleanup: removed stale committed duplicate client `backend/prisma/generated`, pm2 `ecosystem.config.cjs`, and `scripts/start-backend.bat`; `server:*` npm scripts repointed to the NSSM service
- Branch: `feature/waiter/accompaniment-picker-none`

### 2026-08-28 — One Cooking Record Per Menu (Cooked Food Pool Consistency)
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
