# Stage 1: Eliminate Manual Shift Open — ShiftConfig as Single Source of Truth

## Goal

- Shifts open **automatically** based on `ShiftConfig` — no manual open button
- Support **custom shift types** (not just DAY/NIGHT) — e.g. Morning, Afternoon, Evening, Night
- `ShiftConfig` is the **single source of truth** for all shift timings
- Config UI is the **only source** — no DB-level seed; table starts empty until user creates via UI
- UI shows all defined shifts with ability to create, edit, activate/deactivate
- All existing Stage 1 bugs fixed along the way

---

## Issues Being Fixed

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `ShiftConfig` ignored — hardcoded 5:30/17:30 | High | Scheduler reads config, defaults seeded |
| 2 | `date: now` instead of `date: today` | Low | Scheduler uses `today` explicitly |
| 3 | `actualOpeningTime` null on auto-created shifts | Medium | Set to `now()` during auto-create |
| 4 | Hardcoded `openedById` UUID | Medium | Set to `null` (system-opened), schema nullable |
| 5 | Manual open endpoint exists | High | Removed entirely |
| 6 | `autoCloseTime = openTime` bug | High | Reads both open and close from config |
| 7 | No custom shift types | Medium | `ShiftType` enum → free-form string |
| A | Carry-forward uses `autoClosePlates` not `closingPlates` | Medium | Use `closingPlates` for closed shifts |
| B | Previous shift lookup not filtered by type | Medium | Filter by same `type` |

---

## Changes

### Change 1: Prisma Schema

**File:** `backend/prisma/schema.prisma`

- Remove `enum ShiftType { DAY; NIGHT }`
- Change `Shift.type` from `ShiftType` to `String`
- Change `Shift.openedById` from `String` to `String?` (nullable)
- Change `Shift.openedBy` relation from `User` to `User?`
- Change `ShiftConfig.type` from `ShiftType` to `String`
- Keep `@@unique([type, date])` on Shift

**Migration:** `npx prisma migrate dev --name shift-type-to-string`

---

### Change 2: Remove Hardcoded Default Config Seed (Config UI = only source)

**File:** `backend/index.ts`

**Remove entirely:**
- The `seedShiftDefaults()` function (was creating DAY/NIGHT defaults at startup).
- Its call (`await seedShiftDefaults();`).
- This ensures `ShiftConfig` is empty on a fresh DB — no DB-level source of truth; only the config UI creates/activates/deactivates entries.

---

### Change 3: Rewrite `autoCreateShifts()` in Scheduler

**File:** `backend/scheduler.ts`

Current function (lines 6-39) is replaced entirely:

1. Read all active `ShiftConfig` records
2. If none exist, use seeded defaults (already in DB from Change 2)
3. For each config:
   a. Parse `autoOpenTime` and `autoCloseTime` from HH:MM
   b. Calculate `openTime` and `closeTime` as Date objects
   c. Handle midnight crossing (close < open → next day)
   d. Skip if `now < openTime - 60s`
   e. Check if shift exists for `type + today`
   f. If not, create in transaction:
      - `Shift`: `type=config.type`, `date=today`, `autoOpenTime`, `autoCloseTime`, `actualOpeningTime=now()`, `isOpen=true`, `openedById=null`
      - Carry-forward: find previous closed shift **of same type**, read `closingPlates` (not `autoClosePlates`)
      - Create `ShiftSnapshot` per active menu with `openingPlates`

Key fix for issue A: Use `closingPlates` from previous shift's snapshots (set at manual close) instead of `autoClosePlates` (set by scheduler). Fall back to `autoClosePlates` only if `closingPlates` is null.

Key fix for issue B: `findFirst({ isOpen: false, type: config.type })` — filter by same shift type.

---

### Change 4: Remove `POST /api/shifts/open`

**File:** `backend/routes/shifts.ts`

- Delete the entire `router.post("/open", ...)` handler (lines 106-214)
- Remove `import { ShiftType }` (no longer needed)
- Keep all other endpoints unchanged

---

### Change 5: Add ShiftConfig Validation + DELETE

**File:** `backend/routes/shiftConfig.ts`

Add to existing routes:

**POST `/` validation:**
- `type` must be non-empty string, max 50 characters
- `autoOpenTime` and `autoCloseTime` must match `HH:MM` format (regex: `/^([01]\d|2[0-3]):[0-5]\d$/`)
- Reject if format invalid → 400

**DELETE `/:id`:**
- Count total configs first
- If count <= 1, reject → 400 "Cannot delete the last shift config"
- Otherwise delete and return `{ success: true }`

---

### Change 6: Frontend Types

**File:** `desktop/ui/types/electron.d.ts`

```diff
- type ShiftType = "DAY" | "NIGHT";
+ type ShiftType = string;
```

---

### Change 7: Frontend API

**File:** `desktop/ui/lib/api.ts`

- Delete `openShift()` function (lines 534-539)
- Add `deleteShiftConfig(id: string)`:
  ```
  apiFetch(`/shift-config/${id}`, { method: "DELETE" })
  ```

---

### Change 8: Rewrite ShiftManagement Page

**File:** `desktop/ui/pages/admin/ShiftManagement.tsx`

**Remove:**
- `openShift` import
- `Play` icon import
- State: `openShiftDialog`, `newShiftType`, `openingShift`, `shiftError`
- `handleOpenShift()` function
- "Open Shift" button + dialog (lines 157-169, 201-248)

**Keep:**
- Current shift status card (top)
- Close Shift button + ShiftCloseDialog
- Config dialog (modified)

**Add:**
- Config table using `DataTable` showing all shift configs:
  - Columns: Type, Open Time, Close Time, Status (Active/Inactive badge), Actions
  - Actions: Edit (opens dialog), Toggle Active, Delete
  - "Add Shift" button in header
- Active config shown with green badge
- Empty state: "No shift configurations. Defaults will be seeded on next startup."

**Modify Config Dialog:**
- Change from RadioGroup (DAY/NIGHT only) to text input for type name
- Keep time inputs for open/close
- "Save" button creates or updates
- Pre-fill form when editing existing config

**Empty state (no shift open):**
- Replace red "No shift is currently open" warning with neutral info:
  "No shift is currently open. Shifts open automatically based on the schedule below."
- Show next scheduled open time from config

---

### Change 9: Update Cashier Page

**File:** `desktop/ui/pages/admin/Cashier.tsx`

- Fetch shift configs on mount
- Render shift type tabs dynamically from configs (not hardcoded DAY/NIGHT)
- Each tab shows config type name + time window
- Order filtering by shift type already uses string comparison — works as-is

---

### Change 10: Update Reports Page

**File:** `desktop/ui/pages/admin/Reports.tsx`

- Fetch shift configs on mount
- Render shift type selection cards dynamically (not hardcoded DAY/NIGHT)
- Each card shows type name and time window

---

### Change 11: Update AdminLayout

**File:** `desktop/ui/components/admin/AdminLayout.tsx`

- The shift type badge in the header already shows `shift?.type`
- Works as-is with string types — no hardcoded DAY/NIGHT check needed for display
- If color logic depends on type, use a simple hash or default color for unknown types

---

## Implementation Order

1. **Schema + migration** (Change 1)
2. **Remove hardcoded seed defaults** (Change 2)
3. **Scheduler rewrite** (Change 3)
4. **Remove manual open endpoint** (Change 4)
5. **ShiftConfig validation + DELETE** (Change 5)
6. **Frontend types** (Change 6)
7. **Frontend API** (Change 7)
8. **ShiftManagement page rewrite** (Change 8)
9. **Cashier page update** (Change 9)
10. **Reports page update** (Change 10)
11. **AdminLayout update** (Change 11)

---

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `backend/prisma/schema.prisma` | Modify — remove enum, string type, nullable openedById |
| 2 | `backend/prisma/migrations/...` | New — migration |
| 3 | `backend/index.ts` | Modify — remove `seedShiftDefaults()` and its call |
| 4 | `backend/scheduler.ts` | Modify — rewrite autoCreateShifts() |
| 5 | `backend/routes/shifts.ts` | Modify — remove POST /open |
| 6 | `backend/routes/shiftConfig.ts` | Modify — add DELETE, validation |
| 7 | `desktop/ui/types/electron.d.ts` | Modify — ShiftType = string |
| 8 | `desktop/ui/lib/api.ts` | Modify — remove openShift, add deleteShiftConfig |
| 9 | `desktop/ui/pages/admin/ShiftManagement.tsx` | Rewrite — config table + remove manual open |
| 10 | `desktop/ui/pages/admin/Cashier.tsx` | Modify — dynamic shift tabs |
| 11 | `desktop/ui/pages/admin/Reports.tsx` | Modify — dynamic shift cards |
| 12 | `desktop/ui/components/admin/AdminLayout.tsx` | Modify — dynamic shift badge |

---

## Verification (post-change)

After implementation:
1. `npx prisma migrate dev` — migration succeeds
2. `npm run dev:backend` — server starts, no seed inserted (table empty until UI creates configs)
3. Check DB: `ShiftConfig` is empty (no hardcoded defaults)
4. Wait for scheduler tick: Shift auto-created with opening snapshots
5. Frontend: ShiftManagement shows config table with DAY + NIGHT
6. Frontend: Can create/edit/delete configs
7. Frontend: Can add custom type (e.g. "MORNING" 06:00-12:00)
8. Frontend: No "Open Shift" button exists
9. Orders placed during open shift are tracked correctly
10. `npm run lint` passes
11. `npx tsc --noEmit` passes
12. All shift time displays include uppercase AM/PM (ShiftManagement, Cashier, Reports, CurrentShiftIndicator, ShiftCloseDialog)
