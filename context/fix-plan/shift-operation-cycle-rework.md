# Shift Operation Cycle Rework — Scheduler, operationDay, & Shift Lifecycle

## Goal

Replace the calendar-date-based `operationDay` calculation with a **dynamic operational cycle** model. `operationDay` is determined by a user-defined cycle window anchored at the shift with the **earliest `autoOpenTime`**. All shifts opening inside the same cycle window share one `operationDay`. This becomes the source of truth for filtering orders, payments, and voids by business day.

Secondary goals: dynamic auto/manual close behavior, hard-block orders when no shift exists, and a manager-only shift list view for early gap detection.

---

## Current Behavior

- `autoCreateShifts()` anchors `autoOpenTime` HH:MM to `new Date()` (wall-clock "today"), so when the scheduler runs after a shift's open time, `operationDay` is derived from the wrong (past) date — e.g. a TT shift opening `Sep 1 23:00` got `operationDay = Aug 31`.
- `autoCloseExpiredShifts()` hardcodes `isOpen: shift.type === "NIGHT" ? false : true` — only NIGHT shifts auto-close. Wrong and not configurable.
- No notion of a "cycle" / anchor interval; every shift is dated independently from the scheduler tick date.
- No visibility of today's shift lineup for managers; missed shifts only surface as broken orders later.

---

## Design & Decisions (Settled with User)

| # | Decision | Outcome |
|---|----------|---------|
| 1 | Anchor shift | Shift with the **earliest `autoOpenTime`** among active configs |
| 2 | operationDay inheritance | A shift inherits the current cycle's `operationDay` only if it opens within the cycle window |
| 3 | Creation timing | Create shift **exactly at `autoOpenTime`** (no buffer, no pre-creation) |
| 4 | Missed shift | **Flag a warning**; system **cannot take orders** until a shift exists. Continue with the current cycle |
| 5 | Cycle interval | **Dynamic, optional** — `anchorIntervalMinutes` (e.g. 5 min or 8 h). All shifts inside the window share the first shift's `operationDay` |
| 6 | Close model | **Auto-close is default and mandatory** for all shifts at their `autoCloseTime` (snapshots captured at that point). `manual: true` marks shifts a manager closes later when collecting/declaring sales |
| 7 | Manual close | Only allowed for shifts configured `manual: true`. Sets `isOpen = false`, `finalCloseSource = "MANUAL"` |
| 8 | AUTO vs MANUAL tracking | `finalCloseSource` already exists — AUTO when auto-closed, MANUAL when manager closes |
| 9 | Shift list UI | **Manager-only** (never cashier). Shows all shifts for the **current operationDay**, including **inactive configs**, sorted anchor-first (earliest → latest) |
| 10 | No orders without shift | If no active shift exists, waiters cannot see/select menu items — only a notification prompting them to alert the manager |
| 11 | Existing bad DB data | **Delete** all existing `Shift` + `ShiftSnapshot` records and start fresh (no UPDATE migration) |

---

## Cycle Logic (reference)

```
Cycle window = [cycleStart, cycleStart + anchorIntervalMinutes)

anchorToday = today's occurrence of the anchor shift's autoOpenTime

currentCycleStart =
  now >= anchorToday ? anchorToday
                     : anchorToday - anchorIntervalMinutes

operationDay = date(YYYY-MM-DD) of currentCycleStart

Every config (sorted by autoOpenTime):
  openTime  = today's occurrence of cfg.autoOpenTime
  closeTime = today's occurrence of cfg.autoCloseTime
              (+1 day if closeTime <= openTime)  // midnight crossing

  if now < openTime        → skip (not open yet)
  if shift exists for (type, operationDay) → skip
  else create shift with operationDay, isOpen = true
```

**Real example (TT 23:00, Night 23:55, anchorIntervalMinutes = 1440):**

| Now | anchorToday | currentCycleStart | operationDay | Actions |
|-----|-------------|-------------------|--------------|---------|
| Sep 2 08:00 | Sep 2 23:00 | Sep 1 23:00 | **Sep 1** | Both openTimes in future → nothing created |
| Sep 2 23:00 | Sep 2 23:00 | Sep 2 23:00 | **Sep 2** | TT (23:00) created → opDay Sep 2 |
| Sep 2 23:56 | Sep 2 23:00 | Sep 2 23:00 | **Sep 2** | Night (23:55) created → opDay Sep 2 |
| Delivery gap (scheduler down at open) | — | — | — | Flag warning; orders blocked until shift exists |

---

## Auto-Close Logic (reference)

```
At autoCloseTime (all shifts):
  1. Capture snapshot: autoClosed = true, autoClosedAt = now
     (also store autoClosePlates / autoCloseTime per snapshot)
  2. Snapshot capture ALWAYS happens at autoCloseTime

  Then check cfg.manual:
    manual = false (default)  → isOpen = false, finalCloseSource = "AUTO"
    manual = true             → isOpen = true,  finalCloseSource stays null
                                (manager closes manually later →
                                 isOpen = false, finalCloseSource = "MANUAL")
```

---

## Files Changed

| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | **Update** — add `manual` + `anchorIntervalMinutes` to `ShiftConfig` |
| `backend/db` migration | **New** — Prisma migration for the two new columns |
| `backend/scheduler.ts` | **Rewrite** — `autoCreateShifts()` (cycle logic) + `autoCloseExpiredShifts()` (auto-close + manual flag) |
| `backend/routes/shiftConfig.ts` | **Update** — accept/validate `manual` + `anchorIntervalMinutes` in POST / PUT |
| `backend/routes/orders.ts` | **Update** — hard-block order creation when no active shift; clear error message |
| `backend/routes/shifts.ts` | **Update** — respect `manual` flag on close; keep AUTO/MANUAL semantics |
| `desktop/ui/pages/admin/ShiftManagement.tsx` | **Update** — manager-only shift list (current operationDay, incl. inactive configs, anchor-first sort); config editor supports new fields |
| `desktop/ui/pages/waiterPos/...` | **Update** — hide/disable menu when no active shift + notification banner |

---

## Implementation Steps

### Step 1 — Schema + Migration
- Add to `ShiftConfig`:
  ```prisma
  manual               Boolean   @default(false)  // false = auto-close, true = manual close
  anchorIntervalMinutes Int      @default(1440)    // cycle window; 1440 = 24h
  ```
- Generate & apply migration (`backend/`).

### Step 2 — Scheduler `autoCreateShifts()`
Implement the Cycle Logic above:
- Query active configs sorted by `autoOpenTime` asc (index 0 = anchor).
- Compute `currentCycleStart` + `operationDay` from `anchorIntervalMinutes`.
- For each config, create **exactly at `autoOpenTime`**; skip if `(type, operationDay)` exists.
- Log a **warning** when a shift should have opened but is missing.

### Step 3 — Scheduler `autoCloseExpiredShifts()`
Implement the Auto-Close Logic above:
- Always snapshot at `autoCloseTime`.
- `manual == false` → `isOpen = false`, `finalCloseSource = "AUTO"`.
- `manual == true` → keep `isOpen = true` (manager closes later).
- Remove the hardcoded `NIGHT` ternary.

### Step 4 — ShiftConfig API
- `POST /` and `PUT /:id` accept `manual` (bool) and `anchorIntervalMinutes` (int > 0).
- `GET /` returns the new fields.

### Step 5 — Orders Hard-Block
- `POST /` already rejects when no `isOpen` shift exists — keep, and refine the message:
  `"No active shift. The system cannot take orders without an active shift. Please contact the manager."`
- Confirm this path is also enforced for any other order-creation entry points.

### Step 6 — Manager Shift List (`ShiftManagement.tsx`)
- **Role-gate**: manager only (`useAuthStore` role check; exclude cashier).
- Fetch `listShifts(operationDay=today)` + `getShiftConfigs()`.
- Render a table: Type · Open · Close · Status (OPEN/CLOSED) · Source (AUTO/MANUAL) · Manual? · Config (Active/Inactive).
- Sort anchor-first (earliest `autoOpenTime` → latest).
- Show **inactive configs** with an inline quick-action to reactivate.
- Emphasize the **current operating shift**.

### Step 7 — Waiter No-Shift Guard
- On load, check active shift via `getCurrentShift()`.
- If none (or missed shift): hide menu list, show banner:
  `"There is a missed shift. Please alert the manager. Orders cannot be taken until a shift is open."`
- Re-enable automatically when a shift appears (refresh/poll).

### Step 8 — Comment + Cleanup
- Update misleading comment in `scheduler.ts` (line 5) to describe the cycle model.
- Delete all existing `Shift` + `ShiftSnapshot` records (fresh start) — confirmed by user; no UPDATE migration needed.

---

## Verification

1. `npm run lint` + `tsc --noEmit` in `desktop/` and `backend/`.
2. Start backend; confirm scheduler logs a clean create for TT at exactly `23:00` with `operationDay = <today>`.
3. Confirm Night shift inherits the same `operationDay`.
4. Test auto-close on a `manual: false` shift (AUTO) vs `manual: true` (stays open).
5. Kill backend around an open time → confirm missed-shift warning + orders blocked + manager list highlights the gap.

---

## Open Items / Assumptions

- `anchorIntervalMinutes` default `1440` (24 h) unless explicitly set.
- Cycle "advance" is implicit: when the anchor shift next opens, `operationDay` moves to the new date. No separate trigger needed (confirmed).
- Skipped/missed shift does not break the cycle — only warns and blocks orders (confirmed).
- Fresh DB start intended; existing orders reference old `shiftId`s and may need clearing too if they must be consistent (confirm whether orders are also wiped).