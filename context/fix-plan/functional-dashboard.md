---
plan: functional-dashboard
platform: backend + frontend (aggregate endpoint first, then dashboard UI; electron IPC parity)
status: Not Started → Ready to Execute
---

## Goal
Turn the Dashboard from a hardcoded mock screen into a live "at a glance" summary.
Keep the **Orders** and **Revenue** cards (now live, scoped to the current running
shift so far), drop the fake **Tables Served** / **Avg. Prep Time** cards, add
**Outstanding Unpaid** and **Current Running Shift**, and drive the existing
7-day chart with real paid revenue.

## Current behavior (verified in code)
- `desktop/ui/pages/Dashboard.tsx` — `statCards` (L5-10) and `chartData` (L12-20)
  are **literal constants**; nothing is fetched. The whole page is mock data.
- No `/api/dashboard*` endpoint exists (grep: 0 hits). No dashboard file in
  `backend/routes/`.
- "Tables Served" has **no backing model** (no table concept in `schema.prisma`);
  "Avg. Prep Time" is **not tracked anywhere** → both removed.
- Live aggregates already exist but each is a separate call:
  `getOrderCount`, `getUnpaidOrderCount` (`/orders/unpaid-count`),
  `getCurrentShift` (returns the open shift **with its `orders[]`**, each with
  `totalPrice`/`isPaid`/`isVoid`), `getShiftReport`, etc.
- Shift window helpers exist: `shiftActualEndTime` exported from
  `backend/routes/dailyReport.ts:16`; the mutually-exclusive-window logic lives
  in `dailyReport.ts:64-86`. `/orders/unpaid-count` definition:
  `unpaidAcknowledged && !isPaid && !isVoid` (`orders.ts:104-118`).

## Confirmed decisions (from operator)
1. **Keep Orders + Revenue**, add **Outstanding Unpaid** + **Current Running Shift**;
   remove Tables Served + Avg. Prep Time (4 cards total).
2. **Orders** = current running shift, **non-void** orders placed so far.
3. **Revenue** = current running shift, **paid non-void** total so far (matches
   the shift report's `revenue.total`).
4. **Outstanding Unpaid** = walkout backlog (`unpaidAcknowledged && !isPaid && !isVoid`):
   **count** as the value, **KSh owed** as the subtitle.
5. **Current Running Shift** = shift **type** (e.g. "LUNCH") as value + scheduled
   window (`autoOpenTime–autoCloseTime`) as subtitle; "No active shift" empty state.
6. **Chart** = **paid revenue per calendar day**, last 7 days (oldest → today),
   reusing the existing SVG area/line chart markup.
7. **Refresh** on mount + every **60 s** (single summary call, cheap) **and** a
   manual Retry button on error.
8. **Electron parity** — IPC handler + preload + `electron.d.ts` types,
   `lib/api.ts` window.electron-first then fetch (repo convention).
9. Manual implementation — **no ollama models**.

## Changes

### 1. Backend — new `backend/routes/dashboard.ts`, mounted in `app.ts`
`GET /api/dashboard/summary` returns one payload:
```ts
{
  currentShift: { id, type, operationDay, autoOpenTime, autoCloseTime } | null,
  ordersSoFar: number,            // current shift, non-void
  revenueSoFar: number,           // current shift, paid, non-void
  unpaidOutstanding: { count: number, total: number },
  last7Days: { date: "YYYY-MM-DD", label: "Mon", value: number }[] // 7, oldest→newest
}
```
- **Current shift + orders/revenue:** resolve the open shift (`isOpen: true`,
  newest), then attribute orders by the same **effective window** the shift
  report uses — effectiveEnd for a **running** shift = `now`; effectiveStart =
  `max(autoOpenTime, precedingShift actualEnd)` — reusing `shiftActualEndTime`
  imported from `dailyReport.ts`. This guarantees the dashboard can never
  disagree with the report. Non-void count → `ordersSoFar`; paid non-void
  `sum(totalPrice)` → `revenueSoFar`. **No current shift → both 0 +
  `currentShift: null`.**
- **Unpaid outstanding:** `order.count` + `aggregate(sum totalPrice)` with
  `{ unpaidAcknowledged: true, isPaid: false, isVoid: false }` (same predicate
  as `/orders/unpaid-count`, plus the amount).
- **last7Days:** aggregate `order.findMany` where `isPaid && !isVoid &&
  createdAt >= (today − 6d, local midnight)` selecting `totalPrice, createdAt`;
  bucket by **local calendar day**, sum; emit exactly 7 entries (zero-filled)
  oldest → newest; `label` = short weekday.
- `app.ts`: `import dashboardRouter from "./routes/dashboard.js"` +
  `app.use("/api/dashboard", dashboardRouter);` (after `/api/reports`).

### 2. Electron IPC + preload + types
- `ipc-handlers.ts`: `ipcMain.handle("dashboard:get-summary", () => apiFetch("/dashboard/summary"))`
  inside a new `registerDashboardHandlers()`.
- `main.ts`: import + call `registerDashboardHandlers()` (alongside the other
  `register*Handlers()` calls).
- `preload.cts`: `dashboard: { getSummary: () => electron.ipcRenderer.invoke("dashboard:get-summary") }`.
- `electron.d.ts`: `DashboardSummary`, `DashboardShift`, `DashboardDayPoint`
  interfaces + `dashboard` on the `ElectronAPI` type.

### 3. `desktop/ui/lib/api.ts`
- `getDashboardSummary(): Promise<DashboardSummary>` — window.electron-first,
  then `apiFetch("/dashboard/summary")` (existing pattern).

### 4. `desktop/ui/pages/Dashboard.tsx` — live data
- Delete the `statCards`/`chartData` literals and the module-scope static chart
  constants.
- `useState<DashboardSummary | null>` + loading/error state; `useEffect` fetches
  on mount and on a **60 s `setInterval`** (cleared on unmount).
- **Cards (shadcn `Card` + existing `StatCard`):**
  1. `ShoppingCart` **Orders** — `ordersSoFar`
  2. `DollarSign` **Revenue** — `KSh {revenueSoFar.toLocaleString()}`
  3. `AlertCircle` **Outstanding Unpaid** — count value, subtitle `KSh {total}`
  4. `Clock` **Current Running Shift** — type value, subtitle window
     (`HH:mm–HH:mm`), or "No active shift"
- **Chart:** feed `last7Days` into the existing SVG (recompute `maxVal`, points,
  paths, y-labels from data; guard divide-by-zero on an all-zero week). Keep the
  `overflow-x-auto` wrapper (responsive rule).
- **States:** loading (muted placeholder), error (message + **Retry** button),
  empty (all zeros / no shift) — no crashes on null.
- Import `getDashboardSummary` from `@/lib/api` (components never fetch directly).

## Files to modify / create
- New: `backend/routes/dashboard.ts`, `context/fix-plan/functional-dashboard.md`.
- Edit: `backend/app.ts`, `desktop/electron/ipc-handlers.ts`,
  `desktop/electron/main.ts`, `desktop/electron/preload.cts`,
  `desktop/ui/types/electron.d.ts`, `desktop/ui/lib/api.ts`,
  `desktop/ui/pages/Dashboard.tsx`, `context/current-feature.md`.
- **No schema change, no `db:sync`.**

## Verification plan
1. `tsc -b` + backend `tsc` + Electron transpile clean; `npm run lint` zero new.
2. Live API smoke on :3001 — `GET /api/dashboard/summary` shape + values match
   `GET /api/reports/shift/:currentId` (revenue total) and `GET /orders/unpaid-count`
   (count) on real data.
3. Playwright on the served UI: 4 cards render with live values, chart has 7
   points, no-shift → empty state, 60 s refresh re-fetches (spy on request).
4. `npm run build` + `npm run build:web -- --server same-origin`; optional
   `npm run build:win` if Electron terminals must receive it now.

## Workflow & deployment
1. **Stash first** — `git stash push -u -m "park backups/ + nul"` to clear the
   two untracked artifacts before branching (`backups/` stashed; `nul` is a
   Windows reserved name deleted via the `\\?\` device path — already done).
2. Branch `feature/admin/functional-dashboard` off `restaurant-build`.
3. Backend route → verify live; then IPC/api/types → Dashboard rewrite.
4. Verify, ask before committing; merge `--no-ff`, push.
5. **Deploy (backend changed — SSH flow):** `git pull origin restaurant-build`
   → `npm run build --prefix backend` → `schtasks /run /tn pos-backend-restart`
   → verify `sc query EraevaBackend` + `curl http://localhost:3001/health`
   → `npm run build` + `npm run build:web -- --server same-origin`.
   **No `db:sync`** (no schema change).

---
Status: Ready to Execute
Branch: `feature/admin/functional-dashboard`
Plan reference: `context/fix-plan/functional-dashboard.md`
