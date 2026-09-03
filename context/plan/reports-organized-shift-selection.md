# Plan: Reports Page — Organized Shift Report Selection

## Platform

frontend (Reports page UI + minimal backend list/report enhancement + types/api)

## Status

Not Started

## Goals

- Reports page never blank — organized, scannable shift list by default (today → 6 days back)
- Custom date range via the shared shadcn `DatePicker` (From/To) — same component as the Cashier page
- Keep the shift-type card step (MIDDAY/DAY/NIGHT) — only that type's shifts are listed
- Show ALL shift statuses, not just closed: Live / Awaiting Manual Close / Closed (Manual) / Closed (Auto)
- Click a row → view report; "Awaiting Manual Close" row also supports Review & Close from the list
- Live/current report for open shifts (revenue, orders, payment, production, plate movement with live stock as "Current")
- No schema changes — all summary data computed read-only from existing relations

## Context / Current Behavior

**Reports page (`desktop/ui/pages/admin/Reports.tsx`)**
- Entry: two cards (Shift Report, Waiters Report)
- Tap "Shift Report" → shift-type selection cards (one per active config)
- Tap a type → blank section showing only a native `<input type="date">` + a hidden closed-shift `<Select>` dropdown
- Only closed shifts show; no order count / revenue / drift at a glance
- User must pick date + type + a bare dropdown item before seeing anything

**Backend `GET /api/shifts` (`backend/routes/shifts.ts`)**
- Accepts only `?date=YYYY-MM-DD` (single day)
- Returns shifts without order count, revenue, or drift summary
- `listShifts(operationDay?)` in `lib/api.ts` mirrors the single-date constraint
- `Shift` type (`desktop/ui/types/electron.d.ts:570`) lacks summary fields

## Shift Status Model (derived from existing data)

| State | Condition | Badge | Action |
|-------|-----------|-------|--------|
| Live | `isOpen` + `!autoClosed` | Blue Live | Review current report (live stock as "Current") |
| Awaiting Manual Close | `isOpen` + `autoClosed` | Amber Awaiting Close | Review & Close from list |
| Closed (Manual) | `!isOpen` + `finalCloseSource = MANUAL` | Green Closed | View final report |
| Closed (Auto) | `!isOpen` + `finalCloseSource = AUTO` | Neutral Closed | View final report |

## Changes

### Change 1 — Backend: range query + per-shift summary (`GET /api/shifts`)
**File:** `backend/routes/shifts.ts`

Extend the list endpoint `GET /` to accept:
```
?from=YYYY-MM-DD&to=YYYY-MM-DD&type=MIDDAY
```

- `from`/`to` (either alone or both) define an inclusive `operationDay` range; keep existing single `?date=` working (backward compatible)
- Optional `type` filter
- For each shift, compute and return:
  - `orderCount` — total orders
  - `voidCount` — `isVoid` orders
  - `revenue` — sum of `totalPrice` over paid, non-void orders
  - `driftMinutes` — `autoClosedAt` vs `autoCloseTime` (when `autoClosedAt` exists; else null)
- `findMany` with include (orders + snapshots), aggregated in JS; read-only
- Sorted newest-first (`autoOpenTime desc`)

### Change 2 — Backend: live plate movement for open shifts
**File:** `backend/routes/dailyReport.ts`

In `GET /reports/shift/:id`, when the shift is open (not closed), plate movement's actual/closing value uses the **current live `Menu.stock`** (labeled "Current") instead of the null `closingPlates`.

### Change 3 — Frontend type: extend `Shift`
**File:** `desktop/ui/types/electron.d.ts`

Add to `interface Shift`:
```ts
orderCount?: number;
voidCount?: number;
revenue?: number;
driftMinutes?: number | null;
```

### Change 4 — Frontend API: range list function
**File:** `desktop/ui/lib/api.ts`

Add:
```ts
export async function listShiftsByRange(type: string, from: string, to: string): Promise<Shift[]>
```
- Calls `GET /shifts?type=…&from=…&to=…`
- Keep existing `listShifts(operationDay?)` untouched

### Change 5 — Reports page: organized selection flow
**File:** `desktop/ui/pages/admin/Reports.tsx`

Rewrite `ShiftReportSection`:

1. Card-type step (keep) — pick MIDDAY/DAY/NIGHT
2. After picking a type, auto-load default range `from = today−6`, `to = today` and render the shift list immediately (never blank)
3. Range picker bar (secondary): two shared shadcn `DatePicker` (From, To) + a "Last 7 days" quick-reset button; changing either re-queries
4. Shift list table (replaces hidden dropdown), columns: Date · Open→Close · Status badge · Orders · Revenue · Drift · Closed By
   - Row click → `getShiftReport(shiftId)` → render existing `ShiftReportView`
   - "Awaiting Manual Close" rows get a "Review & Close" path (reuses existing ShiftCloseDialog/close flow) — on success the row refreshes to Closed (Manual)
5. Status badges per row (Live / Awaiting Manual Close / Closed Manual / Closed Auto)
6. Empty & loading states (no shifts in range → informative empty message; loading → skeleton)
7. `WaitersReportSection`: swap native `<input type="date">` for the shared `DatePicker`

### Change 6 — ShiftReport view: status-aware
**File:** `desktop/ui/components/reports/ShiftReport.tsx`

Show a LIVE / AWAITING MANUAL CLOSE badge when the shift is not finally closed, and render drift / declared amounts as "pending" where not applicable. Plate movement shows "Current" live stock for open shifts.

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `backend/routes/shifts.ts` | Modify — range query (`from`/`to`/`type`) + per-shift summary fields |
| 2 | `backend/routes/dailyReport.ts` | Modify — live stock as "Current" for open shifts in plate movement |
| 3 | `desktop/ui/types/electron.d.ts` | Modify — add summary fields to `Shift` |
| 4 | `desktop/ui/lib/api.ts` | Modify — add `listShiftsByRange(type, from, to)` |
| 5 | `desktop/ui/pages/admin/Reports.tsx` | Rewrite ShiftReportSection + WaitersReportSection DatePicker swap |
| 6 | `desktop/ui/components/reports/ShiftReport.tsx` | Modify — status-aware badges + pending drift/declared + live "Current" |

**Not touched:** schema, scheduler, shift close logic.

## Implementation Order

1. Backend range query + summary (Change 1)
2. Backend live plate movement (Change 2)
3. Frontend `Shift` type (Change 3)
4. `listShiftsByRange` in api.ts (Change 4)
5. Reports page rewrite (Change 5)
6. ShiftReport status-aware view (Change 6)
7. Verify

## Verification

- [ ] Enter Reports → Shift Report → pick MIDDAY → list appears immediately (default today→6 days back), never blank
- [ ] List shows only selected type, newest first, all statuses badged (Live / Awaiting Manual Close / Closed Manual / Closed Auto)
- [ ] Each row: date, open→close, status badge, order count, revenue, drift, closed by
- [ ] Change From/To DatePickers → list re-filters; "Last 7 days" resets to default
- [ ] Live row → live report shows revenue/orders/payment/production + plate movement with live stock as "Current"
- [ ] "Awaiting Manual Close" row → Review & Close works, becomes Closed (Manual)
- [ ] Closed row → full final report renders correctly
- [ ] Print works on loaded report
- [ ] DatePickers match the Cashier page (same component)
- [ ] `npm run lint` + `tsc` clean
