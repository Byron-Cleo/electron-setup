# Production DB Migration Runbook — Pull `restaurant-build`, Apply Schema, Repair Prisma History

Created: 2026-10-09
Scope: **`eraevadb` (production DB, loaded from `backend/.env`) only.** `eraevadb_dev` / `.env.development` is explicitly out of scope.
Target commit: `43359f8` (from local `06af300`), branch `restaurant-build`.

---

## 1. Context & findings (why this runbook exists)

Investigation on 2026-10-09 established:

- The app on this machine runs as the **`EraevaBackend`** Windows service (NSSM), `START_TYPE : AUTO_START`, executing `node dist/index.js` in `backend/` with `NODE_ENV=production` → loads `backend/.env` → **`eraevadb`** (the real-data DB). It auto-starts on boot.
- `eraevadb` schema was **fully current** to the pre-pull HEAD (26 tables, `timestamptz`, `Customer`, `ShiftConfig`), but `_prisma_migrations` is **broken**: only 4 rows, `20260829160000_timestamptz_conversion` marked **FAILED** (already applied to the schema), and 5 migrations unrecorded. The DB is maintained by `prisma db push`, **not** `migrate deploy`.
- The incoming migration files are **incomplete**: no migration ever creates `OrderItemAllocation`, which the new code/schema requires. Therefore `prisma migrate deploy` (replay) **fails mid-way** — `db push` is the only reliable applier.
- Incoming change `06af300 → 43359f8` (75 files) adds 5 migrations plus new backend code:
  - `20261006000000_shared_production_pool` — `SellingMode` enum, `AccompanimentType` `ADD VALUE 'PORTION'`, `OrderItemAllocation` table + index, `Int → Decimal(12,2)` widening (`Menu.stock`, 7 `ShiftSnapshot` columns), unique index rebuild, new FKs/columns.
  - `20261008120000_bounded_drift_policy` — `ShiftConfig.strictClose`, `maxDriftMinutes`.
  - `20261008130000_mpesa_cash_partial` — `Order.mpesaAmount`, `cashAmount`.
  - `20261009120000_stock_returns` — `StockReturn` table.
  - `20261009130000_user_multi_roles` — `User.roles TEXT[]` + data backfill.
- Also randomly pulls in the earlier batch-number / pool-engine features (`CookingRecord.batchNumber`, etc.) whose columns are absent from `eraevadb`.
- **Required data backfills** (neither `db push` nor a schema diff performs these):
  1. Roles: `UPDATE "User" SET "roles" = ARRAY["role"] WHERE cardinality("roles") = 0;`
  2. Batch numbers: `tsx scripts/backfill-shift-scoped-batch-numbers.ts`.
- Prisma **7.9.1**; DB role `postgres` is superuser + `createdb` → shadow DBs work.
- `db:sync` (root) = `prisma generate` + `prisma db push`; Prisma CLI loads `backend/.env` → targets `eraevadb`.

## 2. Decisions (operator-approved 2026-10-09)

| # | Decision | Value |
|---|----------|-------|
| 1 | DB scope | **`eraevadb` only** (dev DB out of scope) |
| 2 | Batch-number backfill | **Yes**, run it |
| 3 | Migration history | **Squash** — replace incomplete history with one true baseline + `migrate resolve --applied` |
| 4 | Backups | `C:\Users\User\AppData\Local\Temp\opencode\db-backups\` |
| 5 | Scratch DB | Create + drop `eraevadb_verify` for coherence check |
| 6 | Commit | **Yes** — committed to `restaurant-build` (2026-10-10) |
| 7 | Restart | `schtasks /run /tn pos-backend-restart` (fallback: elevated `npm run server:restart`) |

---

## 3. Phase 0 — Pre-flight & safety

```bash
# working tree must be clean
git status

# fresh custom-format dump of the production DB
export PGPASSWORD=<db-password>
PG="/c/Program Files/PostgreSQL/17/bin"
TS=$(date +%Y%m%d-%H%M%S)
OUT="backend/eraevadb-backup-${TS}.dump"
"$PG/pg_dump" -U postgres -h localhost -p 5432 -d eraevadb -Fc -f "$OUT"
"$PG/pg_restore" --list "$OUT" | head   # verify integrity

# copy off-repo
mkdir -p "/c/Users/User/AppData/Local/Temp/opencode/db-backups"
cp "$OUT" "/c/Users/User/AppData/Local/Temp/opencode/db-backups/"

# record baseline row counts
"$PG/psql" -U postgres -h localhost -p 5432 -d eraevadb -c \
  "SELECT (SELECT count(*) FROM \"User\") users, (SELECT count(*) FROM \"Order\") orders, (SELECT count(*) FROM \"Menu\") menus, (SELECT count(*) FROM \"Shift\") shifts, (SELECT count(*) FROM \"StockSupply\") supplies, (SELECT count(*) FROM \"CookingRecord\") cooking;"
```

**Expected baseline (2026-10-09):** users 18, orders 115, menus 90, shifts 8, supplies 75.

## 4. Phase 1 — Pull the code

```bash
git pull origin restaurant-build      # expect fast-forward 06af300 -> 43359f8
git status                            # clean
```

## 5. Phase 2 — Dependencies

No `package.json` / lockfile changes are incoming. Skip `npm install` unless `git pull` reports changes to them.

## 6. Phase 3 — Preview the schema diff (read-only, ABORT gate)

```bash
cd backend
DATABASE_URL="postgresql://postgres:<db-password>@localhost:5432/eraevadb" \
  npx prisma migrate diff \
    --from-url "postgresql://postgres:<db-password>@localhost:5432/eraevadb" \
    --to-schema-datamodel prisma/schema.prisma --script
```

**Expect:** `CREATE TABLE "OrderItemAllocation"` / `"StockReturn"`, `ADD COLUMN`, `ADD VALUE 'PORTION'`, `ALTER … SET DATA TYPE DECIMAL(12,2)`, `DROP INDEX orderitems_order_menu_starch_veg_key` + `CREATE UNIQUE INDEX … portion_key`.
**ABORT if any `DROP TABLE` or `DROP COLUMN` appears.**

## 7. Phase 4 — Apply schema (`db push`)

```bash
# from repo root; targets eraevadb via .env
npm run db:sync

# if Prisma flags data loss for the widening/type changes AND the Phase 3 diff
# confirmed they are additive/widening (no drops), re-run:
npm run db:push --prefix backend -- --accept-data-loss
```

## 8. Phase 5 — Data backfills

```bash
export PGPASSWORD=<db-password>
PG="/c/Program Files/PostgreSQL/17/bin"

# 1) multi-role backfill
"$PG/psql" -U postgres -h localhost -p 5432 -d eraevadb -c \
  'UPDATE "User" SET "roles" = ARRAY["role"] WHERE cardinality("roles") = 0;'

# 2) batch numbers (shift-scoped)
DATABASE_URL="postgresql://postgres:<db-password>@localhost:5432/eraevadb" \
  npx tsx scripts/backfill-shift-scoped-batch-numbers.ts
```

Review `context/current-feature.md` for any other one-off data corrections (e.g. the “10-08 opening-stock correction”) and confirm whether the referenced shift exists on `eraevadb` before applying.

## 9. Phase 6 — Squash migration history

```bash
cd backend
BASE="prisma/migrations/20261010000000_baseline"
mkdir -p "$BASE"

# 1) generate the authoritative baseline from the final schema
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > "$BASE/migration.sql"

# 2) remove the incomplete history (keep migration_lock.toml)
#    delete every OTHER directory under prisma/migrations/

# 3) reset the stale tracking table on the production DB
export PGPASSWORD=<db-password>
PG="/c/Program Files/PostgreSQL/17/bin"
"$PG/psql" -U postgres -h localhost -p 5432 -d eraevadb -c 'TRUNCATE "_prisma_migrations";'

# 4) mark the baseline as applied (no data touched)
DATABASE_URL="postgresql://postgres:<db-password>@localhost:5432/eraevadb" \
  npx prisma migrate resolve --applied "20261010000000_baseline"

# 5) confirm in sync
DATABASE_URL="postgresql://postgres:<db-password>@localhost:5432/eraevadb" npx prisma migrate status
```

## 10. Phase 7 — Prove the history is coherent (scratch DB)

```bash
export PGPASSWORD=<db-password>
PG="/c/Program Files/PostgreSQL/17/bin"

"$PG/psql" -U postgres -h localhost -p 5432 -c 'CREATE DATABASE eraevadb_verify;'

cd backend
DATABASE_URL="postgresql://postgres:<db-password>@localhost:5432/eraevadb_verify" npx prisma migrate deploy

# MUST report: "No difference detected"
npx prisma migrate diff \
  --from-url "postgresql://postgres:<db-password>@localhost:5432/eraevadb_verify" \
  --to-schema-datamodel prisma/schema.prisma

"$PG/psql" -U postgres -h localhost -p 5432 -c 'DROP DATABASE eraevadb_verify;'
```

## 11. Phase 8 — Build, restart, smoke test

```bash
cd backend && npm run build && cd ..          # compiles dist/
schtasks //run //tn pos-backend-restart        # UAC-free; fallback: elevated npm run server:restart

sc query EraevaBackend                          # STATE : 4 RUNNING
curl http://localhost:3001/health               # {"status":"ok",...}

# browser live-view rule (AGENTS.md)
npm run build
npm run build:web -- --server same-origin
```

Smoke test in the running app: login (incl. a multi-role user), waiter order, kitchen cook/return, store fulfill, cashier payment + partial, shift view. Re-check row counts vs Phase 0.

## 12. Phase 9 — Stage, do not commit

```bash
git add -A context/prod-deployment backend/prisma/migrations
git status      # leave staged for operator review
```

## 13. Rollback

```bash
export PGPASSWORD=<db-password>
PG="/c/Program Files/PostgreSQL/17/bin"
"$PG/pg_restore" -U postgres -h localhost -p 5432 --clean --if-exists \
  -d eraevadb "/c/Users/User/AppData/Local/Temp/opencode/db-backups/<dump>"

# revert the migration-folder squash
git restore backend/prisma/migrations
```

## 14. Production restaurant server (SSH) — later, same flow

1. `git pull origin restaurant-build`
2. `npm run db:sync` (targets that server's `eraevadb`)
3. Roles backfill `UPDATE "User" …` via psql
4. `TRUNCATE "_prisma_migrations";` + `migrate resolve --applied "20261010000000_baseline"`
5. `npm run build --prefix backend`
6. `schtasks /run /tn pos-backend-restart`
7. Verify `sc query EraevaBackend` = RUNNING + `curl http://localhost:3001/health`
8. After any plain `npm run build` / `build:win`: re-run `npm run build:web -- --server same-origin`

## 15. Known caveats

- **`db push` default target is `.env` (`eraevadb`)** while the dev app reads `.env.development` (`eraevadb_dev`). This runbook drives every Prisma command with an explicit `DATABASE_URL` for determinism (except `db:sync`, which already resolves to `eraevadb`).
- `_prisma_migrations` is cleared and re-baselined — metadata only, no application data is affected.
- `eraevadb_dev` remains behind (no `Customer`, no `roles`); to be addressed separately by cloning production later.
- The squash is a repo file change; it is committed to `restaurant-build` (2026-10-10) so the repo matches the re-baselined production DB.
