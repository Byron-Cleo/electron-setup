# Current Feature

## Platform
backend

## Status

In Progress

## Goals

- Refactor database schema to enable meal filtering by serving time (LUNCH, DINNER, BREAKFAST, DESSERT, BEVERAGE)
- Create MenuMealType table to establish many-to-many relationship between Menu and ServiceTime
- Modify seed data to establish actual meal-time relationships based on restaurant logic
- Implement API endpoint GET /api/menus?mealType=<time> to pull all meals available for specific serving times
- Ensure data integrity and proper database constraints for the new relationship
- Add tests to verify the meal-time filtering functionality
- Generate database migrations for schema changes

## Notes

- Based on frontend requirement: Waiter selects serving time (e.g., LUNCH) and needs to see all meals available for that time AND have stock > 0
- Current schema has MenuServiceTimeType connecting Menu → MenuServiceTime → ServiceTime, but needs more direct relationship for filtering
- Goal is to have direct menu-to-meal-time relationship that can be filtered efficiently
- Need to maintain backward compatibility with any existing API consumers
- Seed data should reflect real restaurant logic (some meals served at both LUNCH & DINNER, others only one)
- Will need to update both schema and type definitions
- Will need to seed the new relationship properly
- API endpoint should handle mealType parameter (one of: BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE)
- Stock filtering is a business logic concern - handled in backend application layer
- Design should allow easy future scaling (add more meal periods if needed)

## History

### frontend - 2026-07-01 — Waiter POS — Meal Period Time Slots
- Implemented time-slot logic (BREAKFAST 6-11, LUNCH 12-17, DINNER 18-5 overnight, DESSERT/BEVERAGE always)
- Split meal period cards into "Now Serving" (active + always available) and "Closed" sections
- Created WaiterDateTime component with day strip (Mon–Sun), live clock, date, and login timestamp
- Centered header layout, side-by-side day strip and timestamp display
- Replaced deepseek-coder:6.7b with gemma3:4b as the frontend codegen model
- Ran tsc --noEmit and lint — clean

### frontend - 2026-06-30 — Waiter Landing UI — Meal Period Cards Display
- Displayed MealPeriod options (BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE) as card grid
- Removed test orange background from WaiterPOS

### frontend - 2026-06-30 — Admin Dashboard — Layout Design & Navigation Shell
- Created AdminLayout with sidebar, header, main content area, and footer
- Set up nested routes under /admin/* (Dashboard, Store, Kitchen, Menu, Cashier, Users)
- Built Dashboard page with stat cards (Orders, Revenue, Tables Served, Avg Prep Time) and SVG sales overview chart
- Added admin color tokens to index.css (--color-admin-*) 
- All page headings use text-admin-header-text (#562215) for consistent maroon color
- Global h1 rule updated with color: var(--color-brand-maroon)
- Added p-6 padding to AdminLayout main content area
- Deleted unused screenshots
- Committed and merged to main

### backend - 2026-06-29 — PIN-Based Staff Login with Role-Based Access
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

### backend - 2026-06-29 — Initial configuration and login implementation
- Commit: initial configuration and login implementation
