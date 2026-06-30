# Login Phase 1 — PIN-Based Staff Login with Role-Based Access

> Full specification document for the initial login implementation phase.

---

## Architecture

### Data Flow

```
Login.tsx → window.electron.auth.login(pin) → ipcRenderer.invoke("auth:login", pin)
  → ipcMain.handle("auth:login", ...) → POST /api/auth/login
    → Express route → Prisma → PostgreSQL
      → bcrypt compare → check isActive → return user
```

### Route Structure (React Router)

```
/login              → Login page (public)
/admin/*            → Admin Dashboard (role: admin)
/waiter/*           → Waiter POS / Menu (role: waiter)
/store/*            → Store / Inventory (role: store)
/kitchen/*          → Kitchen Orders (role: kitchen)
```

---

## Files Created/Modified

| Layer | File | Change |
|---|---|---|
| Database | `backend/prisma/schema.prisma` | Add `pin`, `isActive`, `platform` fields to User |
| Backend route | `backend/routes/auth.ts` | **Create** — POST /login, POST /logout |
| Backend app | `backend/app.ts` | Register auth router |
| IPC handlers | `desktop/electron/ipc-handlers.ts` | Add `auth:login`, `auth:logout` handlers |
| Main process | `desktop/electron/main.ts` | Call `registerAuthHandlers()` |
| Preload | `desktop/electron/preload.cts` | Expose `auth.*` methods |
| Types | `desktop/ui/types/electron.d.ts` | Add `User` type + auth to `ElectronAPI` |
| Auth store | `desktop/ui/stores/auth.ts` | **Create** — Zustand store for currentUser |
| React Router | `desktop/ui/App.tsx` | Set up BrowserRouter with role-based routes |
| Route guard | `desktop/ui/components/ProtectedRoute.tsx` | **Create** — role-based route protection |
| Login page | `desktop/ui/pages/Login.tsx` | Wire submit to auth.login, handle success/error |
| Dashboard | `desktop/ui/pages/Dashboard.tsx` | **Create** — admin dashboard (placeholder) |
| Waiter POS | `desktop/ui/pages/WaiterPOS.tsx` | **Create** — waiter menu screen (placeholder) |
| Store | `desktop/ui/pages/Store.tsx` | **Create** — store inventory (placeholder) |
| Kitchen | `desktop/ui/pages/Kitchen.tsx` | **Create** — kitchen orders (placeholder) |

---

## Key Decisions

- `password` field on User stays for future customer email login — not removed
- PIN login sets `platform: "desktop"` to distinguish staff from future web/mobile customers
- `role` field already exists on User — default changed from `"user"` to `"staff"`
- `isActive` boolean added for soft-disabling ex-employees
- PIN is hashed with bcrypt (via `bcrypt-ts-edge`, already in backend deps)
- Zustand chosen over Redux: ~1KB, no Provider wrapper, 3-line store
- React Router v7 (already installed, compatible with React 19)
- `react-router-dom` was already installed — no new dependency needed
- Browser fallback added to auth store so dev testing works outside Electron
- Generated Prisma client at `backend/db/generated/prisma/` — regenerated after schema changes

---

## Test Users

| Role | PIN | Redirect |
|---|---|---|
| Admin | `1234` | `/admin` |
| Waiter | `1111` | `/waiter` |
| Store | `2222` | `/store` |
| Kitchen | `3333` | `/kitchen` |
