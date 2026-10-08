## Shift Reporting Update

### Objective

Update shift reporting so every order, plate, and shilling belongs to exactly one shift — the shift that was actually serving when it happened — and bound how long a manual shift may drift past its scheduled close.

1. Filter orders using **mutually exclusive shift time windows** (based on actual shift operation times), not `shift.orders` or operationDay filtering alone. ✅ Implemented — correct attribution including drift periods, no double-counting when shifts overlap. Verified live on the 10-07 data (below).
2. Show both **incoming and outgoing unassigned cooked food** in shift reports and close dialog. ✅ Already present (`unassignedCarryOver` / `unassignedOutgoing` in API + ShiftReport.tsx + ShiftCloseDialog.tsx + receipt template).
3. Rename Plate Movement column labels for clarity (**Sold** / **Closing Stock**). ✅ Already present.
4. Remove unused `/api/reports/daily` endpoint. ✅ Removed from source; returns 404 (only stale `dist/` mentions it until rebuild).
5. **Bounded drift policy on manual shifts** (new — see below): a manual shift may only extend past its scheduled close by a manager-defined number of minutes; the system force-closes it at that deadline. 🔄 In progress.
6. **Order-derived plate movement**: plate movement must reflect exactly the orders attributed to the shift — drift orders included — because plate movement is based on order placement by the waiter. ✅ Implemented.
7. **Opening stock from the live pool (MANDATORY)**: a new shift's opening snapshot is ALWAYS the live sellable pool at creation — never the previous same-type shift's recorded closing. Shift rollover follows the config timing and auto-start times, and the live pool IS the handover from the immediately preceding shift (whichever type). ✅ Implemented.

### Verified Example (real data, operation day 2026-10-07)

DAY 10-07 was scheduled 5:30AM–5:30PM but manually closed at **3:28AM** the next day (~10h drift), overlapping NIGHT 10-07's entire scheduled window (5:30PM–5:30AM).

| Attribution | DAY 10-07 | NIGHT 10-07 |
|---|---|---|
| Old (`shiftId` / `shift.orders`) | 1 | 10 |
| New (effective window) | **8** | **3** |
| Direct DB count in window | 8 ✓ | 3 ✓ |

8 + 3 = 11 total — every order in exactly one report, no double-counting, no loss. The evening orders (5:30PM–3:28AM) belong to DAY because DAY was the shift actually serving; NIGHT's window starts at DAY's actual end.

### Key Principle: Mutually Exclusive Time Windows

Order attribution is strictly based on actual shift operations with no overlap between consecutive shifts:

- **operationDay is immutable**: determined by `shift.autoOpenTime` at creation and never changes, even if the shift runs across midnight. Shifts always **open at their configured times** — the defined timings exist to fix operationDay and the exact start.
- **Actual end time**: `finalClosedAt` when `finalCloseSource` is `"MANUAL"` **or `"FORCED"` (new)**, else `autoClosedAt` if it exists, else `autoCloseTime` (fallback).
- **Effective start time**: `max(shift.autoOpenTime, immediately preceding shift's actual end)` — the successor's window begins where the previous shift *actually* stopped. Deliberately the immediate predecessor only: an OLDER shift closed out of order (a stale shift a manager finally clicked days late — present in the historical data, e.g. DAY 10-06 closed after DAY 10-07) must not swallow the successor's window. The drift limit makes such out-of-order closes impossible going forward, so the immediate predecessor is the only real overlap.
- **Effective end time**: the shift's actual end time (exclusive bound).
- **No splitting by calendar day**: orders across midnight remain with the shift that owns them under that shift's operationDay.
- **Drift periods belong to the extending shift**: when a manual shift extends past its scheduled end, all orders in that period belong to the manual shift.
- **Early manual close**: if the manager closes a manual shift before its deadline, the exact manual close time is the next shift's starting point for orders.
- **Order pickup vs shift opening**: shifts open at configured times, but orders are picked from when the *previous shift actually ended* — "the exact actual timing of ending and closing, not defined opening and closing".

### Implementation Logic (per shift report)

1. Determine actual end time: `finalClosedAt` (source `MANUAL` or `FORCED`) → else `autoClosedAt` → else `autoCloseTime`.
2. Compute effective start: `max(autoOpenTime, max actual end across all prior shifts)` — clamped so it never lands before the shift's own open.
3. effectiveEnd = the shift's actual end time (exclusive bound).
4. Filter orders AND cooking records using `[effectiveStart, effectiveEnd)`.
5. Derive plate movement sales from the same window orders (see Order-Derived Plate Movement below).

### Bounded Drift Policy (ShiftConfig)

The shift-config UI (where the existing **Manual close** checkbox lives) gains drift controls, visible **only when the shift is defined as manual** (auto shifts have no drift concept):

- **"Close strictly at scheduled time"** checkbox — shift finalizes exactly at `autoCloseTime`. No manager step at all: cash/M-Pesa declaration shows "—", which is itself the clear indication the shift was not manually closed.
- **"Allow drift up to [N] minutes"** input — the shift auto-finalizes at `autoCloseTime + N`. **Strictly user-defined, no enforced cap** (positive integer only). Checking strict disables the input; the two are mutually exclusive.
- **Plain minutes input with live conversion** for friendliness: typing `90` shows "90 min (1h 30m)".
- **Unlimited is the migration default and a red flag**: existing manual configs start as `UNLIMITED ⚠` (red badge, inline warning on edit) so the manager is prompted to define a limit from day one. Unlimited shifts behave exactly as today — never force-closed — until a value is set.

**Scheduler semantics** (`backend/scheduler.ts`):

- `manual=false` → closes fully at `autoCloseTime` as today (`finalCloseSource="AUTO"`).
- `manual=true, strictClose` → same full close at `autoCloseTime` (no manager step, source `AUTO`, unpaid auto-acked).
- `manual=true, maxDriftMinutes=N` → auto-captured at `autoCloseTime` as today (stays open), then **force-closed at the deadline** in a new scheduler pass: `finalClosedAt = autoCloseTime + N` (the *deadline*, not `now()` — keeps attribution exact), `finalCloseSource = "FORCED"`, closing snapshot stamped, pending unpaid orders auto-acked (a missed close must not block forever). The manager may still close manually any time before the deadline — drift is a *max*, not a delay.
- `manual=true, maxDriftMinutes=null` → unbounded (legacy), never forced.

**Why the cap matters**: under the drift-ownership rule, a manual shift left open past its successor's *entire* window would swallow that successor's whole day (the successor's report would be empty). The drift limit is what guarantees every shift captures its own correct orders; the generalized effective-start is the safety net that prevents double-counting even if a limit is set absurdly high.

### Opening Stock Handover (Live Pool — Mandatory)

A shift's opening stock is a snapshot of the **live sellable pool** at creation: `Menu.stock` healed via `recomputeMenuStock()` first (SHARED pools lag in the mirror because cooking creates no splits). The live pool IS the handover from the immediately preceding shift — whichever type it was — because every sale deducts from it in real time. Shift rollover follows the shift-config timing and auto-start times, not type pairing.

The old semantics — copying the previous **same-type** shift's `closingStockAtManualClose` (DAY→DAY / NIGHT→NIGHT, live stock only as fallback) — is banned forever. It went stale whenever the *other* type sold plates after that shift had already closed. Real case (10-08 Liver): the previous DAY closed at 3:28AM recording Liver 15; NIGHT sold 1 Liver at 4:37AM (live → 14); the new DAY opened at 5:30AM with opening **15** (stale) while the pool held **14** — so the day's single sale produced 15 − 1 = 14 on paper vs the true 14 − 1 = 13. With the live-pool opening, every plate-movement row reconciles arithmetically: Opening + Cooked − Sold = Closing.

### Order Attachment During Drift

Today orders attach to the *newest* open shift (orders.ts), so during a drift window orders placed while the DAY shift was still serving landed on NIGHT — putting their plates on NIGHT's snapshot scoreboard and their unpaid rows under NIGHT's close gate, while the window report attributes them to DAY.

Fix: **while a shift is inside its allowed drift window, new orders attach to the drifting shift** (the oldest one if several are drifting). After it closes — manually or by force — attachment falls back to the newest open shift as today. This makes the close-gate/unpaid scoping, snapshot tallies, and window attribution all coherent.

### Order-Derived Plate Movement (the scoreboard wrinkle)

Plate movement is based on order placement. Two records previously disagreed: orders were picked by time window, but `ShiftSnapshot.platesSold` was written to whichever shift was newest-open at placement. Result on 10-07: DAY's report showed 8 orders but plate movement for ~1; NIGHT showed 3 orders but plate movement for ~10.

Resolution — the report derives its sales figures from the same window orders it derives revenue from:

- `platesSold` = Σ plates over the shift's window orders (non-void), per menu (plate weight = the same `factor × qty` used at placement / `OrderItemAllocation`).
- `platesSoldAtAutoClose` = the same sum cut at `autoCloseTime`.
- `driftSold` = the difference.
- Rows cover snapshot menus PLUS any menu sold in the window without a snapshot (a dish created mid-shift, e.g. Matumbo CFF on 10-07 — opening 0, cooked from window records, sold derived from orders) so every sold dish appears.
- Opening/closing stock and wasted stay from snapshot tick-stamps (they are stock photos, attachment-independent).

Consequence: **no backfill script, no rewrite of historical data** — the 10-07 report self-corrects the day this ships (DAY shows exactly its 8 orders' plates, NIGHT exactly its 3), and reports can never disagree with their own orders again.

### Files to Change

- `backend/prisma/schema.prisma` — `ShiftConfig.strictClose Boolean @default(false)`, `ShiftConfig.maxDriftMinutes Int?`
- `backend/prisma/migrations/<timestamp>_bounded_drift_policy/migration.sql` (hand-written, applied via `db push` — repo convention)
- `backend/routes/shiftConfig.ts` — accept/validate the two fields (manual-only; strict clears drift; positive integer; no enforced cap)
- `backend/scheduler.ts` — strict close + force-close pass + **live-pool opening snapshot (same-type carry removed)**
- `backend/routes/dailyReport.ts` — honor `FORCED`, generalized effective start, order-derived plate movement, `finalCloseSource`/`finalClosedAt` in the response
- `backend/routes/orders.ts` — drift-window attachment preference
- `desktop/ui/types/electron.d.ts` — `ShiftConfig` fields + report payload types
- `desktop/ui/lib/api.ts` — config create/update passthrough
- `desktop/ui/pages/admin/ShiftManagement.tsx` — config form controls (manual-only), minutes input with live conversion, `UNLIMITED ⚠` red badge + policy column
- `desktop/ui/components/reports/ShiftReport.tsx`, `desktop/ui/components/shift/ShiftCloseDialog.tsx` — "System Closed — drift limit reached" badge for `FORCED` closes

### Validation

- Type-check: `npx tsc -b` and `npx tsc --noEmit -p backend/tsconfig.json`
- Lint: `npx eslint` on changed files
- `npm run db:sync` BEFORE rebuild/restart (schema changed) — deploy per AGENTS.md
- Dev smoke test (:3001 / http://localhost:5123):
  - 10-07 acceptance: DAY report shows 8 orders AND plate movement for those 8; NIGHT shows 3 and plate movement for those 3
  - Config round-trip: set manual + drift minutes; input hidden for auto shifts; strict clears the input; `90` renders "90 min (1h 30m)"; manual config without a limit shows the red `UNLIMITED ⚠` badge
  - Synthetic shift force-close: a test shift past its drift deadline gets `finalClosedAt = autoCloseTime + N`, `finalCloseSource = "FORCED"`, unpaid auto-acked, closing snapshot stamped (test row cleaned up afterwards)
  - Manager closes early → next shift's orders start at the exact manual close time (already covered by window logic; re-verified)
  - `/api/reports/daily` returns 404
