# Plan: Reports Live Shift Simulation (End-to-End UI Test)

## Branch
`feature/admin/reports-live-shift-sim` (created off `restaurant-build`, inherits committed `21e833e reporting updated` + earlier feature work). Clean working tree before branch creation.

## Status
Build mode — execution plan for end-to-end simulation of live plate movement + organized shift-selection badges using real APIs, on a clean feature branch (not parent).

## Pre-conditions (already applied on restaurant-build before branch creation)
- `ENABLE_SCHEDULER=false` in `backend/.env`; backend restarted (PID 58521) — scheduler disabled.
- 6 historical shifts re-dated: Aug 31 / Sep 1 / Sep 2 (was Sep 2 / 3 / 4); close sources set: Aug31 AUTO×2, Sep1 Day AUTO, Sep1 Evening MANUAL, Sep2 MANUAL×2.
- DB state backed up: `/var/folders/p4/63lp_0gs5f5dmxqmxhbgddjr0000gn/T/opencode/shift_sim_backup.sql`
- User choices: (a) keep re-dated Aug 31–Sep 2 history + today's live shift as working data (option `b`, NOT restore); (b) real orders via `POST /api/orders` are OK; (c) create feature branch for clean separation.

## Goals
1. Create LIVE open Day shift for today (Sep 3) with snapshots; verify report shows **Live** badge and plate movement with **"Current"** blue label (live `Menu.stock`).
2. Place real orders against the LIVE shift; confirm `Menu.stock` decrements + `platesSold` increments, making "Current" animate.
3. Create Awaiting-Manual-Close Evening shift (open, `autoClosed=true`, `finalCloseSource=null`) — scheduler skips it; verify badge + **Review & Close** dialog.
4. Verify historical list (Aug 31–Sep 2) shows **Closed (Auto)** / **Closed (Manual)** badges + per-shift summaries in Reports UI.
5. Restore `ENABLE_SCHEDULER=true` in `backend/.env`, restart backend (scheduler on). No data rollback (working data kept); scheduler will auto-close the LIVE Day shift at 14:00 (expected behavior, confirms scheduler works again).

## Data Design
- Today (Sep 3) freed by re-date; `Shift` unique `(type, operationDay)` satisfied.
- **LIVE Day Shift** (open): `type='Day Shift'`, `operationDay=2026-09-03`, `autoOpenTime=10:00`, `autoCloseTime=14:00` (future → scheduler ignores it, since `autoCloseTime > now`), `isOpen=true`, `autoClosed=false`.
- **Awaiting Evening Shift**: `type='Evening Shift'`, `operationDay=2026-09-03`, `autoOpenTime=2026-09-02 17:30`, `autoCloseTime=2026-09-03 05:30` (past → should have captured), `isOpen=true`, `autoClosed=true`, `finalCloseSource=null`. Scheduler's `autoClosed:false` condition skips it; UI shows Awaiting Manual Close badge.
- Note: both LIVE and Awaiting will be `isOpen=true` simultaneously at test time. Orders are placed **before** the Awaiting shift is inserted, so `findFirst({isOpen:true})` routes only to the LIVE Day shift during ordering (Phase 2 done before Phase 4).

## Phases (execution order)
### Phase 1 — LIVE Day shift + snapshots
- Insert `Shift` row.
- Insert `ShiftSnapshot` rows: Chapati (`openingPlates=20`, stock=17), Full Fish Fry (`openingPlates=5`, stock=3), Full Fish Special (`openingPlates=3`, stock=2).
- Confirm: `GET /api/reports/shift/<id>` shows Live badge + plate movement with "Current" label + blue value.

### Phase 2 — Real orders via API (before Awaiting shift exists)
- `POST /api/orders` with waiter user `ecd778f5-0aa2-40f9-b1fe-f1125780a644`, `mealType="LUNCH"`, items `[{menuId:Chapati,qty:2,price:50},{menuId:FullFishFry,qty:1,price:350}]`.
- Confirm: `Menu` table `stock` decrements; snapshot `platesSold` updates; report "Current" updates.

### Phase 3 — Verify LIVE view in browser
- Reports admin page → Shift Report → pick Day Shift → view today's LIVE row: Live badge, order count/revenue, plate movement with "Current".

### Phase 4 — Awaiting-Manual-Close Evening shift
- Insert Evening shift (as above) + snapshots → verify Awaiting Manual Close badge + Review & Close button opens dialog.

### Phase 5 — Verify historical list
- Reports → Shift Report → check Aug 31 (Day/Evening AUTO) and Sep 1 (Day AUTO / Evening MANUAL), Sep 2 (MANUAL×2) rows. Confirm badges and per-shift summary columns.

### Phase 6 — Reactivate scheduler
- Set `.env` back to `ENABLE_SCHEDULER=true`; touch `backend/index.ts` to trigger `tsx watch` restart (new PID); confirm backend healthy. Working DB data kept; scheduler will auto-close LIVE Day at 14:00 (expected, proves scheduler works).

## Verification
- [ ] LIVE shift exists (`GET /api/shifts?type=Day+Shift&from=2026-09-03`) with `isOpen=true`, `autoClosed=false`
- [ ] LIVE report (`GET /api/reports/shift/<liveId>`) shows `finalCloseSource=null`, `isOpen=true`, plate movement `isLiveCurrent=true`, `closingPlates=null` with live stock value
- [ ] After real order: `Menu` stock shows reduction; report shows updated `platesSold` and updated "Current"
- [ ] Awaiting Evening shift visible with `isOpen=true`, `autoClosed=true`, `finalCloseSource=null`
- [ ] Reports list shows 6 historical rows + 2 today rows with correct badges (Live + Awaiting + AUTO + MANUAL mix)
- [ ] `.env` restored to `ENABLE_SCHEDULER=true` and backend PID changed (restart confirmed)

## Key References
- `backend/routes/orders.ts` (line 83-86): `findFirst({isOpen:true})` attaches orders
- `backend/scheduler.ts`: auto-creates at `autoOpenTime`, auto-closes when `autoCloseTime <= now` + `autoClosed=false`
- `backend/index.ts`: `ENABLE_SCHEDULER` env gate
- `context/plan/reports-organized-shift-selection.md`: prior feature spec (already implemented)
