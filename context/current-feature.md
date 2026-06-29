# Current Feature: PIN-Based Staff Login with Role-Based Access

## Status

Complete

## Goals

- Staff authenticate using a 4-digit PIN instead of email/password
- PIN is hashed with bcrypt before storage
- A `pin` field is added to the User model (nullable — only staff have it)
- An `isActive` boolean field is added to soft-disable ex-employees
- A `platform` field captures how the user logged in (`"desktop"` for PIN)
- Four staff roles: `admin`, `waiter`, `store`, `kitchen`
- Role-based post-login redirect:
  - `admin` → Dashboard
  - `waiter` → Menu / POS
  - `store` → Inventory
  - `kitchen` → Kitchen Orders
- Admin users can generate PINs for new staff and deactivate existing ones
- Zustand store for global `currentUser` state
- React Router for role-based navigation and route guarding

## Notes

- `password` field on User stays for future customer email login — not removed
- PIN login sets `platform: "desktop"` to distinguish staff from future web/mobile customers
- `role` field already exists on User with default `"user"` — will change to `"staff"` default
- The generated Prisma client is at `backend/db/generated/prisma/` — rerun `prisma generate` after schema changes
- Zustand is preferred over Redux: ~1KB, no Provider wrapper, simple store
- React Router v7 (latest, compatible with React 19)
- bcryptjs for PIN hashing (pure JS, no native deps)

## History

### 2026-06-29 — Initial configuration and login implementation
- Commit: initial configuration and login implementation

### 2026-06-29 — PIN-Based Staff Login with Role-Based Access
- Added pin, isActive, platform fields to User model (Prisma schema + migration)
- Created backend auth route (POST /login with bcrypt compare, POST /logout)
- Added auth IPC handlers and exposed via preload.cts
- Added User type and auth methods to electron.d.ts
- Created Zustand auth store with browser fallback for dev
- Set up React Router role-based routes (/admin, /waiter, /store, /kitchen)
- Created ProtectedRoute guard component
- Wired Login.tsx to auth store with loading/error states
- Created placeholder pages (Dashboard, WaiterPOS, Store, Kitchen)
- Seeded test users (admin:1234, waiter:1111, store:2222, kitchen:3333)
- Saved detailed spec to context/features/login-phase-1-spec.md
