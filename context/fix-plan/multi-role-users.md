# Multi-Role Users: Default-Role Redirect + Cross-Journey Links

## Overview 

Users currently hold exactly ONE role (`User.role`), which decides their post-login journey and which pages/tabs they can reach. This feature allows a user to hold MULTIPLE roles (e.g. a cashier who can also be a waiter), with:

1. **A designated default role** — after PIN login the user is redirected to their default role's journey exactly as today (cashier → `/admin/cashier`, waiter → `/waiter`, etc.). No login-time role-picker modal — that option was considered and rejected (extra tap on every login).
2. **Cross-journey links** — each page exposes links to the other journeys the user's roles grant. A cashier+waiter user sees a **"Waiter POS"** item in the admin sidebar; tapping it navigates straight to the waiter journey to place an order. Switching is a plain navigation tap — no PIN re-entry, no confirmation.
3. **Any-of permission semantics** — every role check (route guards, sidebar filtering, capability locks) becomes "user holds ANY of the required roles" instead of "user's single role matches".
4. **Users admin page** — the single Role Select is replaced by a **checkbox list** of the 6 roles plus a **Default role** Select limited to the ticked roles.

## Agreed Decisions (confirmed with operator)

| Decision | Choice |
|---|---|
| Login modal vs default role | **Default-role redirect.** No modal. Zero extra taps for the common case; the switch is one tap when needed. |
| Switch friction | **Plain navigation** — no PIN re-entry, no confirmation dialog. |
| Role combinations | **Any subset of the 6 roles** may be assigned. Operationally cashier+waiter is the expected combo; manager/cashier will NOT be combined (manager is a completely separate role per operator). |
| Waiters | Waiters stay **single-role waiters** in this restaurant's operation — always redirected to the waiter page. The design still tolerates a waiter-default hybrid (conditional admin-side button in `WaiterHeader`) so nobody gets stranded. |
| Default role storage | Keep `User.role` as the **default role** (backward compatible) and add `roles String[]`. No destructive migration. |
| Capability checks | **Any-held-role wins**: a capability unlocks if the user holds the granting role (admin or manager ⇒ can void). Behaviorally unchanged today because manager+cashier won't be combined. |
| Role assignment UI | **Checkbox list** (multiple selection) + Default role Select restricted to ticked roles. |

## Current Implementation (blast radius)

| Where | What it does today |
|---|---|
| `backend/prisma/schema.prisma:210` | `role String @default("staff")` — single role |
| `backend/routes/users.ts:9` | `ALLOWED_ROLES` validation, single-role create/update, last-active-admin guards (`role: "admin"` counts) |
| `backend/routes/auth.ts:30` | PIN login → `toSafeUser` returns single `role` |
| `desktop/ui/types/electron.d.ts:276` | `User.role` single union; `AdminUser`, `AdminUserCreateData/UpdateData` single role |
| `desktop/ui/pages/Login.tsx:132` | `paths[user.role]` → `waiter` ⇒ `/waiter`, everything else ⇒ `/admin` |
| `desktop/ui/App.tsx:32` | `AdminIndex` redirects by role to store/kitchen/cashier page, else Dashboard |
| `desktop/ui/components/ProtectedRoute.tsx:18` | `allowedRoles.includes(user.role)` |
| `desktop/ui/components/admin/AdminLayout.tsx:109` | sidebar `allNavItems` filtered by `item.roles.includes(user.role)` |
| `desktop/ui/pages/admin/Cashier.tsx:320,384,1320` | `isCashier = user?.role === "cashier"` — gates the Void Order lock ("Manager only") |
| `desktop/ui/pages/admin/Manager.tsx:68` | `isManager = user?.role === "manager"` |
| `desktop/ui/components/shared/CurrentShiftIndicator.tsx:88,97` | `roles.includes(user.role)` + `isCashier` |
| `desktop/ui/pages/admin/Users.tsx` | single Role Select in create/edit dialog; single badge in table |

Notes:
- The backend has **no server-side role enforcement** — all authorization is client-side. This feature keeps that posture (trusted LAN); server-side authz stays out of scope.
- The waiter journey (`/waiter`) is a separate route tree (`WaiterLayout` + `WaiterHeader`) with no current link back to `/admin`.
- `hooks/useUserRoles.ts` labels the marked-unpaid actor by role — keep showing the **default role** label (no churn).

## 1. Database Changes

### Prisma schema (`backend/prisma/schema.prisma`, User model)

```prisma
role              String             @default("staff")   // DEFAULT role (landing journey) — kept as-is
roles             String[]           @default([])         // ALL roles this user holds; role ∈ roles
```

- Additive — `db push` per repo convention (the `prisma migrate dev` chain is broken on pre-existing drift).
- Hand-written migration record: `backend/prisma/migrations/<timestamp>_user_multi_roles/migration.sql` containing the `ALTER TABLE` + backfill, kept for the record like previous migrations.

### Backfill (one-time, per database)

```sql
UPDATE "User" SET roles = ARRAY[role] WHERE cardinality(roles) = 0;
```

- Run once via psql on the local `eraevadb` AND on the restaurant server's `eraevadb` during deploy.
- Belt-and-braces: backend serializers coalesce `roles.length === 0` → `[role]` so even a missed backfill can never break login or guards.

## 2. Backend Changes

### `backend/routes/users.ts`

- **Create (`POST /`)**: accept `roles` (array of strings) alongside `role`. Validation:
  - every entry must be in `ALLOWED_ROLES` (`400` with the allowed list otherwise)
  - dedupe; require at least one (`400` "at least one role is required")
  - if `roles` is omitted → default `roles = [role]` (backward compatible with old callers)
  - if `role` is omitted → default `role = roles[0]`
  - `role` must be a member of `roles` (`400` "default role must be one of the assigned roles")
- **Update (`PUT /:id`)**: same validation when `roles !== undefined`; when `roles` changes, the submitted `role` (or the existing default if `role` not submitted) must be a member of the new `roles` — otherwise `400` (the UI always sends both together).
- **Last-active-admin guards** (deactivate ~L169, delete ~L204): count admins with `roles: { has: "admin" }` (works post-backfill; falls back correctly because every admin has `"admin"` in their single-role array). Same for the `demote` check: `existing.roles.includes("admin")`.
- **`serializeUser`**: include `roles: user.roles?.length ? user.roles : [user.role]`.
- `GET /` ordering (`role asc, name asc`) stays — sorts by default role.

### `backend/routes/auth.ts`

- `UserRow` type: add `roles: string[]`.
- `toSafeUser`: include `roles` with the same `[role]` coalesce.
- `findUserByPin` and the PIN collision machinery are untouched — one PIN still resolves to exactly one user.

### Other creators of users (seeds / scripts)

- `db:create-admin` / `seed-dev.mjs` keep writing `role` only — the create-route default (`roles = [role]`) and the serializer coalesce cover them. No change required unless they call `prisma.user.create` directly — if so, add `roles: [role]` there too (verify during implementation).

## 3. Frontend Changes

### Types — `desktop/ui/types/electron.d.ts`

- `User` (L276): add `roles: ("admin" | "manager" | "waiter" | "store" | "kitchen" | "cashier")[]`.
- `AdminUser` (L297): add `roles: AdminUserRole[]`.
- `AdminUserCreateData`: add `roles?: AdminUserRole[]`.
- `AdminUserUpdateData`: add `roles?: AdminUserRole[]`.
- `lib/api.ts` (`getUsers/createUser/updateUser`) and the IPC/preload pass-throughs forward payloads untouched — types only (verify at implementation).

### Guards — `desktop/ui/components/ProtectedRoute.tsx`

```ts
const userRoles = user.roles?.length ? user.roles : [user.role]
if (!allowedRoles.some((r) => userRoles.includes(r))) return <Navigate to="/" replace />
```

### Login redirect — `desktop/ui/pages/Login.tsx`

- The `paths[user.role]` map (L132) keeps working because `role` remains the default role. No change needed — just verify.

### `AdminIndex` — `desktop/ui/App.tsx`

- Keep the current default-role redirects (store/kitchen/cashier → their page, admin/manager → Dashboard).
- Edge case (waiter-default hybrid — not expected in practice): if `user.role === "waiter"`, fall through the user's OTHER roles to pick the admin-side landing (cashier → `/admin/cashier`, store → `/admin/store`, kitchen → `/admin/kitchen`, admin/manager → Dashboard) instead of rendering Dashboard for a non-admin. Pure waiters never reach here (route guard bounces them).

### Sidebar — `desktop/ui/components/admin/AdminLayout.tsx`

- Filter: `item.roles.some((r) => userRoles.includes(r))` — a cashier+waiter user now sees Cashier, Customers AND the waiter link.
- New nav item (after "Cashier"):

```ts
{ label: "Waiter POS", path: "/waiter", icon: ClipboardList, roles: ["waiter"] }
```

- Only rendered for users holding the waiter role (pure waiters never see the admin sidebar; this item exists precisely for hybrids). `NavLink` with an absolute path navigates out of the AdminLayout into WaiterLayout — plain navigation.

### Reverse link — `desktop/ui/pages/waiterPos/WaiterHeader.tsx`

- A compact ghost button (e.g. `Receipt` icon, label "Cashier"/"Admin") rendered **only when the user holds any non-waiter role**, next to the existing logout button. Links to `/admin` — `AdminIndex` routes by their admin-side role. Pure waiters see nothing new.

### Capability checks — any-held-role

- `desktop/ui/pages/admin/Cashier.tsx` (L320, L384, L1320): the `isCashier` flag gates the Void Order lock ("Manager only"). Replace with `canVoid = userRoles.includes("admin") || userRoles.includes("manager")` and lock when `!canVoid`. Audit each of the three call sites during implementation to confirm nothing else rides on `isCashier`.
- `desktop/ui/pages/admin/Manager.tsx` (L68): `isManager = userRoles.includes("manager")` (audit what it gates; admin keeps any existing separate treatment).
- `desktop/ui/components/shared/CurrentShiftIndicator.tsx` (L88): `roles.includes(user.role)` → `userRoles.some((r) => roles.includes(r))`; (L97) `isCashier` → audit and switch to the equivalent any-held-role check.
- `desktop/ui/hooks/useUserRoles.ts`: unchanged — the marked-unpaid label keeps showing the default role.

### Users admin page — `desktop/ui/pages/admin/Users.tsx`

- New state: `formRoles: AdminUserRole[]` (checkbox list of all 6 roles using the existing `Checkbox` primitive, `ROLE_LABELS` for captions).
- `formRole` becomes the **Default role** `Select`, its `SelectContent` restricted to the ticked `formRoles`.
- Validation in `handleSave`: at least one role ticked; if the current default's checkbox gets unticked, auto-switch the default to the first ticked role (keep it a member — never send a default outside `roles`).
- `openCreate`: `formRoles = ["waiter"]`, `formRole = "waiter"`.
- `openEdit`: `formRoles = user.roles` (fallback `[user.role]`), `formRole = user.role`.
- Payloads: `createUser({ ..., role: formRole, roles: formRoles })`, `updateUser` likewise.
- Table role cell: render one stacked badge per held role (each with its `ROLE_STYLES` color); fallback to the single `user.role` badge if `roles` is missing.

## 4. Build Order

1. Schema (`roles` column) → `npm run db:sync` → one-time backfill SQL on `eraevadb`.
2. Backend: `users.ts` + `auth.ts` validation/serialization.
3. Frontend types (`electron.d.ts`) → `ProtectedRoute` → `AdminIndex` → `AdminLayout` (filter + Waiter POS item) → `WaiterHeader` conditional button → capability checks (`Cashier.tsx`, `Manager.tsx`, `CurrentShiftIndicator.tsx`) → `Users.tsx` dialog.

## 5. Verification

- `npm run lint` (zero new violations), `npm run build` (frontend `tsc -b` + vite), `npm run build --prefix backend`.
- psql: `roles` column exists; every user has `cardinality(roles) >= 1`; admin users have `"admin"` in `roles`.
- Live smoke on :3001 (no prod data mutation): create a cashier+waiter user via the Users page → PIN login lands on `/admin/cashier` → sidebar shows **Waiter POS** → tap → waiter journey → place an order → navigate back via `/admin` → order visible to cashier. Also: single-role users (waiter, manager, store, kitchen) behave exactly as before.
- API gates: `POST/PUT /users` rejects an empty `roles`, a non-allowed role value, and a default role outside `roles` (three 400s).

## 6. Deployment (backend + schema changed)

Per AGENTS.md SSH flow on the restaurant server:

1. Merge/push to `restaurant-build`, then on the server: `git pull origin restaurant-build`
2. `npm run db:sync` (adds the `roles` column)
3. One-time backfill: `UPDATE "User" SET roles = ARRAY[role] WHERE cardinality(roles) = 0;` via psql on `eraevadb`
4. `npm run build --prefix backend`
5. `schtasks /run /tn pos-backend-restart` → verify `sc query EraevaBackend` RUNNING + `curl http://localhost:3001/health`
6. Frontend: rebuild + `npm run build:web -- --server same-origin` after any plain `npm run build` / `build:win`

Suggested branch: `feature/admin/multi-role-users`
