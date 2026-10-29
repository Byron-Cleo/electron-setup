# Cashier Payment View — Live SSE Orders + 30-Row Dense Table

**Branch:** `feature/cashier/payment-view-live-refresh`
**Platform:** frontend
**Status:** Complete (2026-10-28)

---

## Problem

When a waiter places an order, the order must appear on the cashier's screen
immediately so the cashier can take payment **without reloading the page** —
reloading interrupts them mid-transaction.

The real-time transport already exists (SSE), but the cashier page *feels* like
it reloads: every live event triggers a refresh function that flips
`loading → true`, and the table is rendered behind
`{!loading && !error && <DataTable/>}`. The table therefore **unmounts and
remounts** on every event, flashing "Loading orders..." — the exact
interruption we are trying to remove.

Two further cashier complaints:

- Only ~8 orders are visible at a time (`usePagination` default `pageSize = 8`).
  Cashiers want **30**.
- The Payment view spends a full row on a redundant title
  ("DAY Shift Payments" + shift badge) even though the shift is already known
  from the shift card the cashier clicked.

---

## Root Cause

SSE is wired end-to-end and works:

```
waiter POST /api/orders
  → backend/routes/orders.ts  emitLiveEvent({ type: "order.created", orderId, shiftId })
  → backend/events.ts          SSE endpoint GET /api/events (25 s heartbeat)
  → desktop/electron/live-events.ts   main-process fetch bridge → IPC "live:event"
  → desktop/electron/preload.cts      window.electron.live.onEvent
  → desktop/ui/lib/api.ts              subscribeLive() (EventSource fallback in browser)
  → desktop/ui/hooks/useLiveRefresh.ts type-matched callback
  → Cashier.tsx refresh*()  ←  setLoading(true) HERE  ←  the bug
```

The transport is fine. The bug is purely the loading-state toggle inside the
refresh callbacks.

---

## Existing Convention (do not invent a new one)

`desktop/ui/components/menu/CookedFoodTable.tsx` already solves this:

```ts
const loadData = useCallback(async (options?: { silent?: boolean }) => {
  const silent = options?.silent === true
  try {
    if (!silent) setLoading(true)
    setError("")
    const data = await getCookedMenus()
    setItems(data)
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to load cooked foods")
  } finally {
    if (!silent) setLoading(false)
  }
}, [])

useLiveRefresh([...], () => { void loadData({ silent: true }) })
```

This plan replicates that pattern verbatim.

---

## Scope

### Phase 1 — Silent refresh, zero flicker (5 call sites)

| File | Function | Approx. lines |
|---|---|---|
| `desktop/ui/pages/admin/Cashier.tsx` | `OrdersView.refreshOrders` | 751 |
| `desktop/ui/pages/admin/Cashier.tsx` | `VoidView.refreshVoid` | 1402 |
| `desktop/ui/pages/admin/Cashier.tsx` | `PaymentView.refreshPayment` | 1822 |
| `desktop/ui/pages/Store.tsx` | `loadStock` | 270 |
| `desktop/ui/pages/Store.tsx` | `loadLowStock` | 730 |

For each:

- Accept `options?: { silent?: boolean }` (matches `CookedFoodTable`).
- When `silent`: skip `setLoading(true/false)`; on failure **keep the last good
  data** (no error flash, no blank table) and log to console.
- The `useLiveRefresh` callback passes `{ silent: true }`.
- Payment view action handlers (`handleMarkUnpaidWithCustomer`,
  `handleAssignCustomer`, `handleUnassignCustomer`, `handleUndoMarkUnpaid`)
  also refresh silently — they already carry their own per-row busy spinner.
- The mount-time `useEffect` keeps the current full loading behaviour (first
  paint still shows "Loading orders...").

**Already silent — no change required:** Cashier `refreshCounts` (dashboard),
Cashier `refreshCurrentShift`, `Reports.tsx` `refreshReport`,
`CookedFoodTable.tsx`, `MenuStockStatusCard.tsx`,
`RemainingStockDashboard.tsx` `loadData`.

### Phase 2 — Payment view redesign

1. **30 orders per page** — `usePagination(filtered, { pageSize: 30 })`.
2. **`DataTable` — two new OPT-IN props** (the primitive is shared by Store,
   Kitchen, Customers, Users …, so global density must not change):
   - `dense?: boolean` — cell padding `py-2` → `py-1` (≈30 px/row, so 30 rows
     ≈ 900 px).
   - `bodyMaxHeight?: string` — body becomes `max-h-[…] overflow-auto` with a
     **sticky `thead`** (`sticky top-0 z-10 bg-admin-content`); the current
     `min-h-[384px]` floor is dropped when this prop is set.
3. **Delete the title block** — the "DAY Shift Payments" heading + shift badge
   (`Cashier.tsx:2175-2188`) and the separate Batch Payment button row. The
   parent `Cashier()` component already renders the `Cashier` h1 + BackButton,
   so the page keeps a title.
4. **One toolbar row** — passed as the `DataTable` `header` prop so it lives
   inside the card and costs no extra vertical space:
   `[New Orders (n)] [Marked Unpaid (n)]` … `[search] [DatePicker — All Shifts
   only] [Batch Payment]`. The Batch button drops from `px-6 py-6` to standard
   size. The row wraps on narrow screens.

Net effect: 4 stacked vertical blocks → 2 (toolbar + table), ~150 px
reclaimed, 8 → 30 visible orders.

### Phase 3 — New-order arrival affordance

New orders sort newest-first (`createdAt` desc) so a new order lands at row 1.
But if the cashier has scrolled down inside the 30-row list they would not see
it — and auto-scrolling would re-create the very interruption we are removing.

- `DataTable` gains `bodyRef?: React.RefObject<HTMLDivElement | null>` so the
  parent can read `scrollTop` and scroll.
- On `order.created`: if `scrollTop === 0` → nothing happens (the row is
  already visible). If scrolled away → a small **"N new orders"** pill appears
  in the toolbar; clicking scrolls the body to top and clears the count.
- **Never auto-scrolls.**

---

## Decisions (confirmed with the operator)

| Decision | Choice |
|---|---|
| Orders per page | **30** |
| Shift title + chip | **Removed entirely** (no replacement chip) |
| Silent refresh scope | **Every page that flickers** (Cashier Orders / Void / Payment + Store stock lists) |

---

## Files Changed

| File | Change |
|---|---|
| `desktop/ui/components/ui/data-table.tsx` | `dense`, `bodyMaxHeight`, `bodyRef` opt-in props; sticky thead |
| `desktop/ui/pages/admin/Cashier.tsx` | Silent refresh ×3; Payment view redesign (30/page, title removed, single toolbar row, "N new orders" pill) |
| `desktop/ui/pages/Store.tsx` | Silent refresh ×2 |
| `package.json` | `build:tailscale` / `build:win:tailscale` repointed from the missing `scripts/build-tailscale.mjs` to `scripts/build-network.mjs` (tailnet server + `release-tailscale/` + `tailscale` suffix) |

No backend, no Prisma schema, no Electron main/preload changes.

---

## Verification

1. `npx tsc --noEmit` (root) — clean.
2. `npm run lint` — no new errors (repo carries ~785 pre-existing).
3. Live dev: place an order from the waiter screen → the row appears at the top
   of the Payment view **with no unmount, no "Loading orders..." flash**, and
   without disturbing an open payment dialog.
4. 30 rows render; the sticky header holds while scrolling; pagination still
   works past 30 unpaid orders.
5. Orders / Void / Store views show the same flicker-free behaviour.
6. `npm run build` + `npm run build:web -- --server same-origin` green.

---

## Rollout

- **Frontend only** → no backend rebuild, no `EraevaBackend` restart.
- Browser live view updates via `npm run build:web -- --server same-origin`.
- **Installed `.exe` terminals keep their own bundle** → they need a new
  installer for cashiers to receive this. Operator decision at deploy time.

### Two installers, side by side

| Terminal location | Command | Output |
|---|---|---|
| On the restaurant LAN | `npm run build:win` | `release/Eraeva POS System-0.0.0-win-x64.exe` |
| Over the tailnet (not on LAN) | `npm run build:win:tailscale` | `release-tailscale/Eraeva POS System-0.0.0-tailscale-win-x64.exe` |

`build:win:tailscale` bakes the tailnet API base `http://100.108.69.45:3001/api`
into both the renderer (`VITE_API_BASE` / `VITE_API_ORIGIN`) and the Electron
main process (`DEFAULT_API_BASE` in `server-config.ts`), and writes to its own
`release-tailscale/` folder, so the LAN installer in `release/` is untouched.

**The order is fixed — run them in this sequence:**

```bash
npm run build:win                             # 1. LAN installer    → release/
npm run build:win:tailscale                   # 2. tailnet installer → release-tailscale/
npm run build:web -- --server same-origin     # 3. restore the browser-served bundle
```

Why the order matters:

- Step 2 (`scripts/build-network.mjs`) bakes its API base into the compiled
  `dist-electron/server-config.js`. Step 1 (`npm run build:win`) runs a plain
  `tsc -b`, which is incremental and **does not** re-emit an output it
  considers up to date — so if the tailnet build ran first, the LAN installer
  would silently keep the tailnet address. `build-network.mjs` wipes
  `dist-electron/` before compiling (`scripts/clean-electron.mjs`); the plain
  `build:win` does not.
- Steps 1 and 2 both rewrite `dist-react/`, which the backend serves at `:3001`.
  Step 3 restores the browser-correct bundle (absolute `/assets`, same-origin
  API), so the served UI works over LAN, SSH tunnel and tailnet alike.

**After step 2**, `dist-electron/server-config.js` is left holding the tailnet
address. Restore the pristine source build before any later plain build:

```bash
node scripts/clean-electron.mjs && npm run transpile:electron
```

### Script fix (2026-10-28)

`build:tailscale` / `build:win:tailscale` pointed at `scripts/build-tailscale.mjs`,
which **does not exist** — it was parked in a stash (it carried 573 MB of build
output and a compiled `vite.config.js` that shadows `vite.config.ts` in Vite's
`DEFAULT_CONFIG_FILES` order). Both scripts now call the maintained
`scripts/build-network.mjs` with the tailnet server, `release-tailscale/` as the
output directory and the `tailscale` artifact suffix.


---

## Notes / Deferred

- **Refetch cost:** every live event still refetches the full `GET /orders`
  list. This is today's behaviour (no regression), but it grows with history.
  A targeted `GET /api/orders/:id` + surgical array patching would fix it at
  the cost of a backend change, rebuild and service restart. Deliberately
  deferred — ship the frontend-only fix first; revisit only if the table feels
  slow.
- Backend already rejects a double payment ("Order is already paid") if an
  order is settled on another terminal while a cashier dialog is open — no
  change needed.
