# Current Feature

## Platform

backend

## Status

In Progress

## Goals

- Operate this Windows server fully over SSH (no RDP) while staff use the console
- Isolated dev scope (DB / backend / UI) reachable ONLY over SSH tunnels — production untouched
- Push approved dev changes to production over SSH (no UAC) via an elevated restart bridge

## Notes

- Local admin `ops` created (POS Remote Operator, Administrators, password key-only behind key auth). Windows 11 Pro, OpenSSH server on 22, firewall `POS-SSH-In` limited to LocalSubnet + `100.64.0.0/10` (Tailscale) Private/Domain
- sshd hardening PENDING: administrators_authorized_keys + `PasswordAuthentication no`, `AllowUsers ops` (waiting on Mac public key)
- Restart bridge: scheduled task `pos-backend-restart` (SYSTEM, Highest) → `scripts/restart-backend.cmd` → `sc stop/start EraevaBackend`
- Tailscale already installed + connected (server + Mac `byronochara` on tailnet)
- Dev scope: DB `eraevadb_dev` (owned by role `era_dev`, NO access to `eraevadb`), schema pushed + dev users seeded, `backend/.env.development` (gitignored): DATABASE_URL dev, PORT=3111, BIND=127.0.0.1, ENABLE_SCHEDULER=false; `backend/load-env.ts` selects `.env` (production) vs `.env.development` (else)
- Detached dev stack: `npm run dev:remote:start|stop` (scripts/dev-start.ps1 / dev-stop.ps1); stale 0.0.0.0 dev instances killed
- Browser live view rebuilt: `npm run build:web -- --server http://192.168.100.45:3001` (served UI hits 3001/api; re-run after any plain `vite build`)
- REMINDER: must rebuild + restart `EraevaBackend` after ANY backend change for prod to pick up new `dist`

## History

### backend - 2026-09-12 — Remote Ops (SSH) + Isolated Dev Scope
- Local admin `ops` created; OpenSSH hardened, key-only (pending Mac key install) so this server is fully operable over SSH while staff use the console (RDP no longer needed) — restart bridge `pos-backend-restart` (SYSTEM/Highest) runs `scripts/restart-backend.cmd` over SSH with no UAC; Access: `ssh -N -L 3111:127.0.0.1:3111 -L 5123:127.0.0.1:5123 -L 5433:127.0.0.1:5432 ops@<tailscale-ip>`
- Dev isolation: `eraevadb_dev` + role `era_dev` (no prod DB access), schema pushed + dev admin/users seeded, gitignored `backend/.env.development` (PORT=3111, BIND=127.0.0.1, scheduler off), `backend/load-env.ts` (loads `.env` on production, `.env.development` otherwise), `app.listen(PORT, BIND)`; verified dev backend 127.0.0.1:3111 only, prod :3001 + `eraevadb` untouched
- Detached dev stack via `dev:remote:start|stop` (survives SSH disconnect); killed pre-existing 0.0.0.0 dev leftovers
- Browser live view: rebuilt `dist-react` with `build:web -- --server http://192.168.100.45:3001` so `http://192.168.100.45:3001` shows live operations in a browser (re-run after every plain `vite build`)

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