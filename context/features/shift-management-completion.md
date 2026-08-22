# Shift Management Completion — Phases 8–12

## Overview

Finish the 12-phase Shift Management feature. **Phases 1–7 are DONE** (merged to main, commit `4408996`). This spec covers only the remaining work. It is self-contained; deeper logic details live in `context/features/shift-management.md` (sections 5–7) and `context/features/shift-management-plan.md` (phases 8–12).

---

## Foundation Already Built (do NOT rebuild)

| Piece | Where |
|---|---|
| `Shift` / `ShiftSnapshot` models, `ShiftType` enum | `backend/prisma/schema.prisma` |
| Migration `20260812200000_add_shift_management` | `backend/prisma/migrations/` |
| Shift API: open / :id/close / current / :id / auto-close | `backend/routes/shifts.ts` (mounted `/api/shifts`) |
| Void API: `POST /api/orders/:id/void` (stock restore + snapshot decrement + current-shift guard) | `backend/routes/orders.ts` |
| costPrice on StockSupply (+ seed data) | `backend/routes/items.ts`, `schema.prisma` |
| Shift report API: `GET /api/reports/shift/:id` (plate movement, revenue by period, production vs sales, driftMinutes) | `backend/routes/dailyReport.ts` |
| Cashier void UI: reason presets dialog, VOIDED badge | `desktop/ui/pages/admin/Cashier.tsx` |
| Waiter void notification card | `desktop/ui/pages/waiterPos/WaiterPOS.tsx` |
| Meal period times 5:30–11:59 / 12:00–17:29 / 17:30–05:29 | `desktop/ui/lib/mealPeriod.ts` |

---

## ⚠️ Known Gaps to Fill During Implementation

1. **Phase 8 blocker**: `POST /api/orders` (`backend/routes/orders.ts`) does NOT accept `voidedOrderId` yet — must be extended to accept + validate it before the waiter flow works.
2. **Phase 9 blocker**: `desktop/ui/lib/api.ts` has NO shift functions — only `voidOrder` exists. Must add `openShift` / `closeShift` / `getCurrentShift` / `getShift` / `autoCloseShifts` (+ Electron IPC fallback pattern per project convention).
3. `Shift` type + related shapes need adding to `desktop/ui/types/electron.d.ts`.

---

## Phase 8: Waiter Replacement Order Flow

**Files:** `backend/routes/orders.ts`, `desktop/ui/pages/waiterPos/WaiterMenu.tsx`, `WaiterPOS.tsx`

- Backend: accept optional `voidedOrderId` in order-create body; verify target order exists and `isVoid = true`; stamp new order's `voidedOrderId`.
- Frontend: when placing an order while voided orders exist for this waiter, link the replacement via `voidedOrderId`; clear that voided order from the notification list after success.
- Receipt printing unchanged (normal flow).
- **Accept:** replacement order persisted with correct link; notification card count drops after placement.

## Phase 9: Cashier Shift Close UI

**Files:** `desktop/ui/components/shift/ShiftCloseDialog.tsx` (new), `desktop/ui/pages/admin/Cashier.tsx`, `lib/api.ts`, `electron.d.ts`

- Add shift API functions to `lib/api.ts` first (gap #2).
- "Close Shift" button (manager/cashier only); dialog shows total orders, voided count, unvoided count (locked after close), revenue summary, drift warning if past auto-close time.
- On confirm → close API → display shift report (uses Phase 5 report endpoint).
- Also surface "Open Shift" affordance if no shift is currently open (otherwise cashier cannot start a shift from UI).
- **Accept:** full open→order→close cycle doable from UI; report renders after close.

## Phase 10: Manager Report UI

**Files:** `desktop/ui/pages/admin/Reports.tsx` (new), `desktop/ui/components/reports/ShiftReport.tsx` (new), route/nav registration in App/AdminLayout

- Shift selector (date picker + DAY/NIGHT dropdown).
- Display: shift metadata (open/close times, drift), plate movement table per item, revenue breakdown by meal period, production vs sales comparison, variance analysis.
- Export/print option.
- **Accept:** closed shifts selectable; all report sections render from real API data.

## Phase 11: Auto-Close Scheduler

**Files:** `backend/src/scheduler.ts` (new), `backend/src/index.ts`

- Interval every minute → find open shifts past `autoCloseTime` → auto-close each (reuse shifts.ts auto-close logic).
- Log auto-closed shifts. Start scheduler on server boot.
- **Accept:** expired shifts close automatically without manual trigger.

## Phase 12: Void Analytics

**Files:** `backend/routes/dailyReport.ts` (add endpoint), optional UI section in Reports page

- `GET /api/reports/voids?date=YYYY-MM-DD` → per-waiter summary: totalOrders, voidedOrders, voidRate %, commonReasons[].
- Surface in Manager Reports UI (tab or card).
- **Accept:** endpoint returns correct counts vs DB for a test date.

---

## Implementation Order

9 → gap #2 first (api.ts shift functions) is shared by Phases 8–10 groundwork → 8 → 9 → 10 → 11 → 12.

## Verification Gates (per phase)

- `tsc --noEmit` (root + backend) + `npm run lint` clean
- Browser/E2E check of the phase's acceptance criteria
