---
plan: permanent-instant-login
platform: backend (Express auth + one-time ops script)
status: Ready to Execute
---

## Goal

Eliminate the recurring multi-second login spinner for good — for existing staff, wrong-PIN typos, future pepper rotation, and completely new users — without ever introducing a lockout path.

## Findings (root cause)

Login has two paths in `backend/routes/auth.ts` `findUserByPin`:

| Path | Cost | When |
|---|---|---|
| Fast | ~3 ms (one indexed read on `pinLookup`) | `pinLookup` matches |
| Slow | **~6.3 s** (serial bcrypt compare against **every** active user) | any fast-path miss |

The slow path runs on **any** miss, so a 6 s spinner hits:
1. **9 legacy staff** whose `pinLookup IS NULL` (never logged in since `06af300` deployed 2026-09-26): Cynthia, Kitchen One, Brian, Store One, Florence, Fredrick, June, Puriety, ROSE.
2. **Any wrong-PIN typo** — even by a backfilled staff member (measured live: invalid PIN = **6.28 s**).

**Completely new users are ALREADY permanent**: `POST /users` writes `pinLookup: pinLookup(pin)` at create (`users.ts:137`), so their first login resolves via the ~3 ms fast path. Nothing targets new users here — the changes are for legacy rows and typo/probe paths.

## Confirmed design decisions

- **Legacy scan scoped to `pinLookup IS NULL` users only.** A user with a lookup either matches the fast path or genuinely has a different PIN, so scoping is behaviorally correct; once backfilled the NULL set is empty → typos stop at an empty query (~3 ms) instead of an 18-user bcrypt scan.
- **Pepper-rotation safety net KEPT and re-armed automatically.** Only users who never logged in since `06af300` can carry NULL, but a rotated `PIN_PEPPER` makes *every* lookup miss even for backfilled users. The bcrypt compare ignores the pepper, so a full-table scan still authenticates everyone on rotation. Arm it with a cheap fingerprint of the current key (`pinLookup("")` — constant unless the pepper changes) so it fires at most once per process / per pepper change — NOT on every typo.
- **No lockout path preserved** (author's design guarantee in `pin-lookup.ts:19-21`).
- **No schema/migration change.**
- **Backfill script verifies a PIN against the stored bcrypt hash BEFORE writing** — a mistyped PIN is skipped, never persisted; cannot lock a user out.
- **Branch:** `feature/auth/permanent-instant-login` (already created, no commits).

## Changes

### 1. Backend: harden `findUserByPin`
File: `backend/routes/auth.ts` (replace the body of the legacy fallback, ~lines 43-97)

Add module-level armed flag near the top:

```ts
// Fingerprint of the last pepper a full-table probe ran under. `pinLookup("")`
// is constant unless PIN_PEPPER changes, so a rotation re-arms the probe below
// automatically. A wrong-PIN typo costs one indexed read once backfilled; an
// ordinary typo before any success costs the probe once per process — never a
// scan on every attempt.
let lastProbedPepper: string | undefined;
```

Rewrite `findUserByPin`:

```ts
async function findUserByPin(pin: string): Promise<UserRow | null> {
  const lookup = pinLookup(pin);

  const byLookup = await prisma.user.findUnique({ where: { pinLookup: lookup } });
  if (byLookup) {
    if (!byLookup.isActive) return null;
    return byLookup as UserRow;
  }

  // Legacy path: only users still carrying a NULL lookup can match here —
  // everyone else resolves by index above. Scanning just them keeps typos at
  // the cost of one indexed read once the DB is backfilled.
  const legacy = await prisma.user.findMany({
    where: { pin: { not: null }, isActive: true, pinLookup: null },
  });

  for (const u of legacy) {
    if (await verifyAndBackfill(u, pin, lookup)) return u as UserRow;
  }

  // Pepper-change safety net. `pinLookup("")` fingerprints the current key; a
  // different value from the last probe means a miss may be a pepper rotation
  // (bcrypt ignores the pepper, so the full scan still authenticates everyone
  // and re-backfills under the new key). Re-armed automatically on each change,
  // and a lone wrong-PIN typo costs this probe once per process at most.
  const pepperCheck = pinLookup("");
  if (lastProbedPepper !== pepperCheck) {
    lastProbedPepper = pepperCheck;
    const all = await prisma.user.findMany({
      where: { pin: { not: null }, isActive: true },
    });
    for (const u of all) {
      if (await verifyAndBackfill(u, pin, lookup)) return u as UserRow;
    }
  }

  return null;
}

/** True when `u.pin` matches `pin`. Backfills `pinLookup` on success. */
async function verifyAndBackfill(u: UserRow, pin: string, lookup: string): Promise<boolean> {
  if (!u.pin || !(await compare(pin, u.pin))) return false;

  const backfilled = await prisma.user
    .update({ where: { id: u.id }, data: { pinLookup: lookup } })
    .then(() => true)
    .catch(() => false);

  if (!backfilled) {
    // Only reachable when two staff shared this PIN before the unique index
    // existed — fix via the Users page.
    console.warn(
      `[auth] PIN for user ${u.id} (${u.email ?? u.name}) collides with an existing ` +
        "lookup — two staff appear to share a PIN. Reset one of them in the Users page.",
    );
  }
  return true;
}
```

### 2. One-time backfill script
File (new): `backend/scripts/backfill-pin-lookup.ts` — mirrors `backfill-cooking-shifts.ts` conventions (`import "dotenv/config"`, `prisma` from `../db/db.js`, `main().catch().finally`).

Behavior:
- `findMany({ where: { isActive: true, pin: { not: null }, pinLookup: null }, orderBy: { name: "asc" } })`.
- List the candidates, then for each: `readline/promises` prompt for the staff's **current** PIN.
- Guard: `if (!(await compare(pin, u.pin)))` → log "skipped (PIN does not match)" → continue (protects against mistyped input / wrong PIN).
- On match: `update({ where: { id }, data: { pinLookup: pinLookup(pin) } })`; catch the unique violation (`P2002`-style catch-all) → warn "this PIN is already claimed — two staff share it; reset in Users page" and skip.
- Summary line: `Done. Backfilled <n>, skipped <n>.`
- Run: `npx tsx scripts/backfill-pin-lookup.ts` from `backend/` (dev cwd loads `backend/.env` via `dotenv/config` → same pepper as the production server).

## Files

| File | Change |
|---|---|
| `backend/routes/auth.ts` | NULL-scoped legacy scan + pepper re-armed probe + `verifyAndBackfill` helper |
| `backend/scripts/backfill-pin-lookup.ts` | NEW — one-time interactive backfill (verify-then-write) |

## Build order

1. Edit `backend/routes/auth.ts`.
2. Write `backend/scripts/backfill-pin-lookup.ts`.
3. `npm run lint` (zero new violations) + `npm run build --prefix backend`.

## Verification

- `npm run lint` + `npm run build` (root) + `npm run build --prefix backend`.
- psql (eraevadb): `SELECT count(*) FROM "User" WHERE isActive AND pin IS NOT NULL AND pinLookup IS NULL;` → 0 after backfill.
- Live on :3001 (no prod data mutation — timing only):
  - valid PIN for a previously-un-backfilled staff → **~ms**.
  - wrong PIN (e.g. `0000`) → **~ms** (not 6.28 s).
  - concurrent `/health` during any login → unaffected (~0.2 s).
- Confirm no `[auth] PIN ... collides` warnings in `backend-service.log`.

## Deployment (backend changed only — no schema change)

Per AGENTS.md production flow on the restaurant server (this machine):

1. Commit on `feature/auth/permanent-instant-login` → merge `--no-ff` → push `restaurant-build`.
2. `npm run build --prefix backend` (service runs compiled `dist/`, not tsx).
3. Restart `EraevaBackend` (needs elevation; scheduled task `pos-backend-restart` not visible to this account → UAC `Start-Process -Verb RunAs` workaround): kill no-longer-current node if 3001 is orphaned, then `sc start EraevaBackend`.
4. Verify: `sc query EraevaBackend` → RUNNING; `curl http://localhost:3001/health` → `{"status":"ok",...}`.
5. Run the backfill interactively (operator types the 9 staff's current PINs).
6. Timeline verification above.

Suggested branch: `feature/auth/permanent-instant-login`