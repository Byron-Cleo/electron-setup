# Remote Ops Access (SSH + DB, No RDP Interruption)

**Branch:** `restaurant-build` (ops/infra; no feature branch required)
**Platform:** `backend + server infrastructure`
**Status:** In Progress — tooling implemented; server setup and maintenance window pending
**Related:** `AGENTS.md` → Remote Operations over SSH, Production Deployment; `scripts/agent-restart-backend.ps1`, `scripts/restart-backend.cmd`, `scripts/build-web.mjs`; PostgreSQL 17; Tailscale; `ops` local admin.

## Goal

Give the operator reliable, anytime access to the production server — shell, deployments, production visibility, and database/data — **without occupying the Windows desktop session and without interrupting the waiter**.

## Non-goals

- No RDP multi-session hacks (`RDPWrap`, Windows Server RDS).
- No exposing PostgreSQL or SSH to the public internet.
- No replacement of the existing backend/service architecture.
- No separate security overhaul in this change (weak DB superuser password, `PIN_PEPPER`) — deferred.

## Confirmed decisions

| Decision | Choice |
|---|---|
| Routine access | SSH only — no Windows App/RDP while waiters are serving |
| Emergency GUI | Keep **Radmin + RDP** enabled as-is |
| SSH scope | Tailscale (`100.64.0.0/10`) + LAN (`192.168.100.0/24`) + localhost |
| DB client | DBeaver over SSH tunnel |
| Deploy permission | Grant `ops` Modify on the existing repo |
| Scripts + docs | Add helper scripts and npm aliases; update `AGENTS.md` |
| PostgreSQL rebind | Deferred to next maintenance window |
| Separate security fix | Deferred |

## Current state (audit, 2026-10-26)

| Item | Observed |
|---|---|
| OS | Windows 11 **Pro** 22631 (single interactive RDP session) |
| Server identity | `WAITER2`, LAN `192.168.100.45/24`, Tailscale `100.108.69.45` |
| Interactive session | `user` on `rdp-tcp#0` (the waiter's RDP session) |
| `ops` account | Local admin, SSH-only, key-only; sshd `AllowUsers ops`, `PasswordAuthentication no` |
| sshd | Running, `AUTO_START` |
| Tailscale | 1.102.3, service `AUTO_START`; operator Mac `byronochara` active |
| Backend | `EraevaBackend` (NSSM, LocalSystem) → `backend/dist/index.js`, `0.0.0.0:3001`, `/health` = `ok` |
| PostgreSQL | 17.10, service auto, `listen_addresses = '*'`, port 5432 |
| `pg_hba.conf` | `127.0.0.1/32` and `::1/128` only (remote auth already blocked) |
| Web UI | Served by backend at `/`, absolute `/assets` (browser-correct) |
| Repo | Branch `restaurant-build`, clean; GitHub remote is **public** (no pull credentials needed) |
| Restart bridge | `pos-backend-restart` exists (User lacks query access; ops documented to run it) |
| Power / updates | Sleep AC/DC = never; `NoAutoRebootWithLoggedOnUsers = 1` |
| Radmin | `rserver3` running + Radmin VPN adapter (kept as emergency) |

### Firewall findings

| Rule | Remote scope | Applicable profiles | Assessment |
|---|---|---|---|
| `OpenSSH SSH Server (sshd)` | **Any** | Any | **Gap** — opens SSH beyond Tailscale/LAN |
| `Allow SSH 22 (Tailscale)` | Tailscale + localhost | Any | Good |
| `POS-SSH-In` | LocalSubnet + Tailscale | Domain, Private | Good intent, but Ethernet 2 is **Public**, so it does not cover LAN |
| `Allow PostgreSQL 5432 (Tailscale)` | Tailscale + localhost | Any | Redundant; `pg_hba.conf` already blocks remote DB auth |

### Gaps

1. SSH is reachable from `Any` because of the built-in rule.
2. `ops` write access to `C:\Users\User\Desktop\pos\electron-setup` is unverified — SSH admin sessions receive a UAC-filtered token, which may block `git pull`/builds.
3. No read-only DB role; ad-hoc analysis would use the superuser.
4. No status/deploy/snapshot tooling or documented operator workflow.
5. PostgreSQL binds all interfaces (currently safe only because of `pg_hba.conf`).
6. Repo docs describe the SSH workflow but not the daily operator commands or terminal-build caveat.

## Target access model

| Need | Mechanism | Interrupts waiter? |
|---|---|---|
| Minor edits / IDE | VS Code Remote-SSH → `ops@100.108.69.45` | No |
| Deploy backend | SSH → `git pull` → build → restart bridge → `/health` | No |
| Deploy browser UI | `npm run build:web -- --server same-origin` | No |
| See production | SSH tunnel → `http://localhost:3001` | No |
| Server state | `ops-status.ps1` over SSH | No |
| Data analysis | Read-only role + DBeaver via tunnel `localhost:5433` | No |
| Raw pulls | `pg_dump` + `scp` | No |
| Emergency GUI | RDP or Radmin (off-hours only) | Yes — emergency only |

---

## Phase 1 — Operator laptop (macOS) SSH setup

Add to `~/.ssh/config`:

```sshconfig
Host pos
  HostName 100.108.69.45
  User ops
  IdentityFile ~/.ssh/eraeva_ops
  LocalForward 3001 127.0.0.1:3001
  LocalForward 5433 127.0.0.1:5432
  LocalForward 5123 127.0.0.1:5123
  LocalForward 3111 127.0.0.1:3111
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Verify (before touching the firewall):

```bash
ssh -o BatchMode=yes pos "hostname"        # expect WAITER2
ssh pos "cd /d C:\Users\User\Desktop\pos\electron-setup && git status -sb"
```

If the key is rejected, install the Mac public key into
`C:\ProgramData\ssh\administrators_authorized_keys` (elevated, one-time).

Daily use:

```bash
ssh pos            # shell (and all LocalForward tunnels)
ssh -fN pos        # background tunnels only
```

- Browser: `http://localhost:3001`
- DBeaver: `127.0.0.1:5433`
- Dev UI (optional): `http://localhost:5123` / dev API `localhost:3111`

## Phase 2 — Server one-time elevated setup

Run from an **elevated PowerShell** in the current RDP session (UAC prompt).

### 2.1 Grant `ops` write access to the repo

```powershell
icacls "C:\Users\User\Desktop\pos\electron-setup" /grant "ops:(OI)(CI)M"
```

- Inheritance applies the ACE to existing children; add `/T` only if a specific directory still denies ops.
- One-time only. Does not affect the waiter's `User` account or the service.
- `ops` remains a local admin; this just removes the UAC-filtered-token write blocker.

### 2.2 Fix git ownership for ops

Run as `ops` over SSH:

```bat
git config --global --add safe.directory C:/Users/User/Desktop/pos/electron-setup
```

### 2.3 Verify deploy capability (ops over SSH)

```bat
cd /d C:\Users\User\Desktop\pos\electron-setup
git pull --ff-only origin restaurant-build
git status
echo probe > .ops-write-test.txt
del .ops-write-test.txt
schtasks /run /tn pos-backend-restart
sc query EraevaBackend
```

- Repo is public, so `git pull` needs no credentials.
- If `schtasks /run` is denied for ops, pick a fallback (implementation-time decision):
  - grant `ops` execute permission on the task (Task Scheduler security), **or**
  - grant `ops` `SERVICE_START`/`SERVICE_STOP` on `EraevaBackend` via `sc sdset`, then use `sc stop/start`; **or**
  - create a SYSTEM task with an explicit `ops`-runnable security descriptor.

### 2.4 Scope the SSH firewall rule

The built-in rule is `RemoteIP: Any`; Ethernet 2 is Public, so `POS-SSH-In` does not cover LAN. Scope the built-in rule:

```powershell
netsh advfirewall firewall set rule name="OpenSSH SSH Server (sshd)" ^
  new remoteip=100.64.0.0/10,192.168.100.0/24,127.0.0.1/32
```

Verify:

```powershell
Get-NetFirewallRule -DisplayName 'OpenSSH SSH Server (sshd)' |
  Get-NetFirewallAddressFilter | Select-Object RemoteAddress
```

Test:
- From Mac over Tailscale: `ssh pos "hostname"` → `WAITER2`.
- From LAN: `ssh ops@192.168.100.45 "hostname"` → `WAITER2`.
- From a non-Tailscale outside network: connection should time out.

Rollback: `netsh advfirewall firewall set rule name="OpenSSH SSH Server (sshd)" new remoteip=any`

> Windows Update/feature reinstall can re-add a broad OpenSSH rule. Re-check the `RemoteAddress` after OS updates.

## Phase 3 — Read-only database access

### 3.1 Create the role

Run once as the `postgres` superuser (credentials come from `backend/.env`'s `DATABASE_URL`; never hardcode them in the repo):

```sql
CREATE ROLE era_analyst LOGIN PASSWORD '<generated-strong-password>';
GRANT pg_read_all_data TO era_analyst;
GRANT pg_monitor TO era_analyst;
ALTER ROLE era_analyst SET default_transaction_read_only = on;
ALTER ROLE era_analyst SET statement_timeout = '60s';
ALTER ROLE era_analyst SET idle_in_transaction_session_timeout = '5min';
```

- `pg_read_all_data` (PG14+) covers existing **and future** tables/views/sequences.
- `pg_monitor` enables `pg_stat_activity` / stats visibility for status queries.
- Password is generated once and stored in the operator's password manager; DBeaver stores its own copy.

### 3.2 Server-side pgpass (for scripts)

As `ops`, create `C:\Users\ops\AppData\Roaming\postgresql\pgpass.conf`:

```
127.0.0.1:5432:eraevadb:era_analyst:<password>
```

Restrict the file to the `ops` profile. Used by `psql`/`pg_dump` so status/snapshot scripts never prompt.

### 3.3 DBeaver connection

- Host: `127.0.0.1`
- Port: `5433` (SSH tunnel → server `127.0.0.1:5432`)
- Database: `eraevadb`
- User: `era_analyst`
- Password: from password manager

### 3.4 Verify

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U era_analyst -d eraevadb -c "select current_user, now();"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -U era_analyst -d eraevadb -c "create table should_fail(id int);"
```

- First command succeeds.
- Second fails with a read-only transaction error.
- Confirm DBeaver can query and export CSV/Excel.

> If `pg_dump` objects to `default_transaction_read_only`, add a separate `era_backup` role with `pg_read_all_data` but read-only default disabled, used only for snapshots.

## Phase 4 — Repo tooling and documentation

### 4.1 New scripts

| File | Responsibility |
|---|---|
| `scripts/ops-status.ps1` | Service states (`EraevaBackend`, `postgresql-x64-17`, `sshd`, `Tailscale`), `/health`, disk/RAM, DB size + active sessions, recent errors from `backend-service.log` |
| `scripts/ops-deploy.ps1` | Branch/clean preflight → `git pull --ff-only origin restaurant-build` → `npm run build --prefix backend` → optional `npm run build:web -- --server same-origin` → restart via `pos-backend-restart` → `/health` verify → append to `backend/logs/deploy.log` |
| `scripts/ops-snapshot.ps1` | `pg_dump -Fc` into `backend/backups/` with retention (default keep 14), using the `era_analyst` pgpass entry |
| `scripts/ops-one-time-setup.ps1` | Elevated one-time setup: `ops` Modify ACL on the repo + scope the built-in SSH firewall rule; no service restart |
| `scripts/ops-create-analyst.ps1` | Interactive create/rotate of `era_analyst` (reads `DATABASE_URL` from `backend/.env`, never prints it; writes ops pgpass when run as ops) |

`ops-deploy.ps1` flags:

- `-SkipWeb` — backend-only deploy.
- `-SyncDb` — run `npm run db:sync` before build/restart (schema changes).
- `-SkipPull` / `-AllowDirty` — advanced/recovery use.
- Preflight aborts on wrong branch, dirty tree, or failed `/health`.

Rollback guidance (documented in the script/AGENTS): `git reset --hard <previous-commit>` → rebuild → restart.

### 4.2 npm aliases (`package.json`)

```json
"ops:setup": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops-one-time-setup.ps1",
"ops:status": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops-status.ps1",
"ops:deploy": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops-deploy.ps1",
"ops:snapshot": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops-snapshot.ps1",
"ops:analyst": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops-create-analyst.ps1"
```

### 4.3 `AGENTS.md` updates

- Daily SSH/tunnel commands and the `Host pos` config.
- `ops` deploy permissions and `safe.directory`.
- Deploy sequence: backend build → restart → verify; when to use `build:web`.
- **Caveat:** `build:web` updates the browser UI only. Installed Electron terminals keep their own bundle and require a new installer for frontend changes.
- DBeaver connection details and the read-only role.
- Snapshot + `scp` workflow.
- Emergency RDP/Radmin policy (off-hours only).
- Firewall scope and the post-Windows-update re-check.
- Maintenance-window procedure for the PostgreSQL rebind.

## Phase 5 — Hardening

### Now

- SSH firewall scoping (Phase 2.4).
- No power/update changes needed: sleep is already disabled; auto-reboot with logged-on users is already blocked.

### Next maintenance window — PostgreSQL rebind

**Timing:** 05:30–06:00 (after NIGHT close, before DAY open) or any confirmed closed period.
**Expected downtime:** 30–60 seconds (backend stop + PostgreSQL restart + backend start).

Pre-checks:

```powershell
# Elevated
Copy-Item "C:\Program Files\PostgreSQL\17\data\postgresql.conf" `
  "C:\Program Files\PostgreSQL\17\data\postgresql.conf.bak-20261026"
Copy-Item "C:\Program Files\PostgreSQL\17\data\pg_hba.conf" `
  "C:\Program Files\PostgreSQL\17\data\pg_hba.conf.bak-20261026"
```

- Run `npm run ops:snapshot`; copy the dump to the Mac.
- Record current state: `netstat -ano | findstr :5432` → `0.0.0.0:5432`.
- Confirm `/health` is `ok`.

Change:

1. `Stop-Service EraevaBackend`
2. Edit `C:\Program Files\PostgreSQL\17\data\postgresql.conf`:
   `listen_addresses = '*'` → `listen_addresses = 'localhost'`
3. `Restart-Service postgresql-x64-17`
4. Verify `netstat -ano | findstr :5432` → only `127.0.0.1:5432` (and `[::1]` if present)
5. Disable the PostgreSQL firewall rule:
   `netsh advfirewall firewall set rule name="Allow PostgreSQL 5432 (Tailscale)" new enable=no`
6. `Start-Service EraevaBackend`
7. Verify `/health` = `ok`, log shows `Connected to eraevadb`
8. DBeaver via tunnel: `SELECT 1` works; direct `100.108.69.45:5432` now refuses
9. Smoke-test one order on a terminal (backend → localhost → DB)

Rollback:

```powershell
Stop-Service EraevaBackend
Copy-Item "C:\Program Files\PostgreSQL\17\data\postgresql.conf.bak-20261026" `
  "C:\Program Files\PostgreSQL\17\data\postgresql.conf" -Force
Restart-Service postgresql-x64-17
netsh advfirewall firewall set rule name="Allow PostgreSQL 5432 (Tailscale)" new enable=yes
Start-Service EraevaBackend
curl http://localhost:3001/health
```

Notes:

- `localhost` is compatible with `DATABASE_URL`, the dev DB (`eraevadb_dev`), and the tunnel.
- `pg_hba.conf` already restricts to `127.0.0.1/::1`; the rebind is defense-in-depth.
- No schema or data changes are involved; rollback is config-only.

---

## Acceptance criteria

- [ ] `ssh pos "hostname"` → `WAITER2` (Tailscale) and `ssh ops@192.168.100.45 "hostname"` → `WAITER2` (LAN)
- [ ] SSH from a non-allowed external network fails
- [ ] `ops` can `git pull --ff-only`, write files, and run the restart bridge
- [ ] `curl localhost:3001/health` → `{"status":"ok",...}` via tunnel
- [ ] Browser at `http://localhost:3001` loads the live production UI
- [ ] DBeaver as `era_analyst` reads data and exports CSV; `CREATE TABLE` is rejected
- [ ] `npm run ops:status` returns a clean summary
- [ ] `npm run ops:deploy` (no-op change) pulls, builds, restarts, health-checks
- [ ] `npm run ops:snapshot` produces a dump; `scp` retrieves it
- [ ] Waiter session `rdp-tcp#0` remains active throughout all of the above
- [ ] Maintenance-window rebind: PostgreSQL listens on `127.0.0.1` only; tunnel still works; `/health` ok

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `ops` ACL inheritance incomplete | Add `/T` to `icacls` for the repo if a subdirectory denies writes |
| Restart task ACL blocks ops | Grant task execute permission or `sc sdset` service rights; verify before first deploy |
| Windows Update re-adds a broad SSH rule | Re-check `RemoteAddress` after updates |
| Build as ops changes file ownership | Inherited repo ACL keeps `User`/SYSTEM access; verify app start after first deploy |
| DBeaver stores DB password | Use DBeaver's secure storage; keep the master password enabled |
| Frontend deploy only updates browser UI | Document that Electron terminals need a rebuilt installer |
| PostgreSQL restart downtime | Run in the maintenance window; stop/start backend cleanly; rollback is config-only |
| `pg_dump` with read-only default | Add `era_backup` role if needed |
| Tailscale unavailable on the Mac | LAN SSH remains available as on-site fallback |

## Deferred (out of scope)

- Rotate the weak `postgres` superuser password and move the app to a dedicated runtime role.
- Set `PIN_PEPPER` in `backend/.env`.
- Disable Radmin / RDP entirely (kept as emergency).
- Automated alerting/uptime monitoring beyond on-demand status.
- Terminal-side auto-update for installed Electron apps.

## Implementation status (2026-10-26)

### Done (no production impact)

- Added `scripts/ops-status.ps1`, `scripts/ops-deploy.ps1`, `scripts/ops-snapshot.ps1`,
  `scripts/ops-one-time-setup.ps1`, `scripts/ops-create-analyst.ps1`.
- Added npm aliases: `ops:setup`, `ops:status`, `ops:deploy`, `ops:snapshot`, `ops:analyst`.
- Documented the operator workflow in `AGENTS.md`.
- All scripts pass the PowerShell parser; `npm run ops:status` runs cleanly.
- Reset the mixed-encoding `backend/logs/restart.log` (old copy kept as
  `restart.log.bak-20261026`); `restart-backend.cmd` now appends cleanly to a fresh file.
- Added `backend/backups/` to `.gitignore`.
- Granted `WAITER2\ops` Modify on the repo without elevation (`icacls /T`, 59,835 files).
  Verified `npm run build --prefix backend` succeeds and the live app returns 200 on `/` and `/health`.

### Pending (operator-triggered)

- **Elevated setup** — run `npm run ops:setup` from an elevated PowerShell:
  scopes the SSH firewall rule and prints task status (the `ops` repo ACL is already applied).
  No restart. The non-elevated `User` cannot query/run `pos-backend-restart` (access denied),
  so the first deploy must run as `ops` over SSH or from an elevated shell.
- **`ops` verification** — over SSH: `git config --global --add safe.directory ...`,
  `git pull --ff-only`, `schtasks /run /tn pos-backend-restart`.
- **Read-only DB role** — run `npm run ops:analyst` interactively when ready (no downtime).
- **First real deploy** — run `npm run ops:deploy` at a safe time (**~5–15 s API gap**).
- **Maintenance window** — PostgreSQL rebind to `localhost` (runbook above).

## Next steps

1. Review this plan and confirm the tooling/script scope.
2. Execute Phases 1–4 and the firewall scoping (no service interruption).
3. Schedule the PostgreSQL rebind for the next maintenance window.
4. Update `context/current-feature.md` history after completion and deploy any backend changes per `AGENTS.md`.
