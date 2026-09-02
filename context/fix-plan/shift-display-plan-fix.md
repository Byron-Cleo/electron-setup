---
plan: shift-display-plan-fix
platform: frontend + backend (Express route)
status: Not Started → Ready to Execute
---

## Goal
Make the shift-management close flow target ONLY the oldest unclosed manual-config shift. Add an "All" tab (left/default) plus Manual/Auto filter tabs (grouped on the right) to the roster. When a ShiftConfig's `autoOpenTime` or `autoCloseTime` is updated, all open shifts of that type are synced to the new config timings so the scheduler acts on the updated schedule (with Guard A rejecting past times).

## Confirmed decisions
- Row highlight (`isRunning`): **A** — follows `currentShift` (most recently created open shift, active orders) — separate from the close target.
- Tab layout: **[All]** (left, default) | **[Manual]** [**Auto**] (right, filter group)
- Sort: open shifts first (oldest `autoOpenTime` top), then closed shifts (same tab, oldest `autoOpenTime` first) — both tabs (Manual and Auto) use this open-first sort.
- Guard A: if new `autoCloseTime` or `autoOpenTime` is already in the past, the system rejects the config update outright with a 400 error — "autoCloseTime cannot be set to a past time" / "autoOpenTime cannot be set to a past time".

## Changes (ready to execute)

### 1. Backend: new endpoint `GET /api/shifts/to-close`
File: `backend/routes/shifts.ts`
- Insert after `GET /current` (after line 76).
- Query: `findFirst({ where: { isOpen: true, finalCloseSource: null, type: { in: manualConfigTypes } }, orderBy: { autoOpenTime: "asc" } })`
- Returns oldest open manual-config shift (finalCloseSource still `null`, even if `autoClosed` is true from scheduler capture).
- Include `finalClosedBy` select (same as `/current`).
- Return `null` JSON (not 404) if no such shift exists.

### 2. Frontend API: `getShiftToClose()`
File: `desktop/ui/lib/api.ts`
- Add export: `export async function getShiftToClose(): Promise<Shift | null> { return apiFetch("/shifts/to-close") }`

### 3. ShiftManagement updates
File: `desktop/ui/pages/admin/ShiftManagement.tsx`

State (near line 33):
- `const [closeTargetShift, setCloseTargetShift] = useState<Shift | null>(null)`
- Update `rosterTab` type and default from `"manual" | "auto"` to `"all" | "manual" | "auto"` with default `"all"`.

Load target (in existing `useEffect`, line 45):
- Add `getShiftToClose().then(s => { if (!cancelled) setCloseTargetShift(s ?? null) }).catch(...)` within the `checkShift()` interval (same 5s poll).

Status card (line 208-270):
- Badge: `closeTargetShift?.type` (instead of `currentShift?.type`).
- Header title: `closeTargetShift?.type`.
- "Since ..." time: `closeTargetShift.autoOpenTime`.
- Message when no target and not loading: `"No open manual shift to close"`.

Close button (`handleOpenCloseDialog`, lines 90-102):
```ts
async function handleOpenCloseDialog() {
  const toClose = await getShiftToClose()
  if (!toClose) {
    alert("No open manual shift to close.")
    return
  }
  setCloseTargetShift(toClose)
  setCloseShiftOpen(true)
}
```
- Remove `getCurrentShift()` call inside `handleOpenCloseDialog`.

`canClose` (line 86-87):
```ts
const canClose = closeTargetShift
  ? !enforceCloseTime || Date.now() > new Date(closeTargetShift.autoCloseTime).getTime() + 1000
  : false
```

Roster tabs (already partially implemented — add "All" button):
- Render: `[All]` (left, default active `rosterTab === "all"`), then `[Manual]` [Auto] (right group).
- Filter logic: `.filter(c => rosterTab === "all" ? true : rosterTab === "manual" ? c.manual : !c.manual)`
- Sort logic: `.sort((a, b) => { ... open-first ... })` — open shifts sort to top by `autoOpenTime`, then closed by same `autoOpenTime`.

`isRunning` row highlight: unchanged (`currentShift?.type === c.type`) — confirmed A.

### 4. Backend: sync ShiftConfig timing updates to open shifts
File: `backend/routes/shiftConfig.ts`, `PUT /:id` route

**Guard (reject outright — Guard A):**
Before applying any timing update, validate the new times against `now`:
- If `autoCloseTime` is being updated and `now >= new autoCloseTime` → reject with `400` and message `"autoCloseTime cannot be set to a past time"`.
- If `autoOpenTime` is being updated and `now >= new autoOpenTime` → reject with `400` and message `"autoOpenTime cannot be set to a past time"`.

**Shift timing sync (only if config update succeeds — Guard A passed):**
After the ShiftConfig is updated, if `autoOpenTime` or `autoCloseTime` changed:
1. Find all Shift records of this config type where `isOpen: true` (open/active shifts only).
2. For each matching Shift, recompute `autoOpenTime` and `autoCloseTime`:
   - `newAutoOpenTime = occurrenceOf(newConfigAutoOpenTime, shift.operationDay)`
   - `newAutoCloseTime = occurrenceOf(newConfigAutoCloseTime, shift.operationDay)`
3. Midnight-crossing check: if `newAutoCloseTime <= newAutoOpenTime`, add 1 day to `newAutoCloseTime` (same logic as `autoCreateShifts`).
4. Update each Shift record with only `autoOpenTime` and `autoCloseTime` (all other fields preserved).
5. Wrap config update + all shift syncs in a single `$transaction`.

**Already-closed shifts (`isOpen: false`) are never touched** — they remain as historical records.

`occurrenceOf` helper (same pattern as `scheduler.ts`):
```ts
function occurrenceOf(time: string, day: Date): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0);
}
```

`autoCreateShifts` needs no changes — it already uses the config's current timings when creating new shifts.

### 5. Files to modify
- `backend/routes/shifts.ts`
- `desktop/ui/lib/api.ts`
- `desktop/ui/pages/admin/ShiftManagement.tsx`
- `backend/routes/shiftConfig.ts`

---
Status: Ready to Execute
Branch: `feature/admin/shift-operation-cycle-rework`
Plan reference: `context/fix-plan/shift-operation-cycle-rework.md`
