# Current Feature

## Platform

Not Specified

## Status

Complete

## Goals

## Notes

## History

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