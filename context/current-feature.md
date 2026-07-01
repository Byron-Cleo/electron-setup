# Current Feature

## Platform
frontend

## Status

Not Started

## Goals

- When a waiter clicks an active meal period card (BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE), navigate to a menu page showing all menu items for that period
- Fetch menus from the backend using GET /api/menu?mealType=<selectedPeriod> via window.electron.menu.getByMealType(mealType)
- Display all menu items (name, price, stock, images, accompaniments) for the selected service time
- The WaiterPOS parent layout design (header, navigation, branding) is kept consistent across all pages — only the content area and route change
- Route changes to reflect the selected meal period (e.g., /waiter/menu/LUNCH) while maintaining the same design shell
- Show the selected meal period name prominently in the menu page (e.g., "LUNCH MENU")
- Handle loading, empty, and error states during fetch

## Notes

- Backend GET /api/menu?mealType=<time> already implemented and tested
- window.electron.menu.getByMealType(mealType) already exposed in preload + IPC
- MenuItem type already includes mealTypes: string[] field
- Stock > 0 filtering is handled by backend — frontend only displays what it receives
- Meal period time-slot logic (active vs closed) already implemented in previous feature
- Only active meal periods should be clickable — closed periods remain disabled
- Use React Router nested routes under /waiter so the layout shell is preserved while content changes
- The design is the same for all periods — only the food listing and route differentiate the experience
- Nested route: /waiter/menu/:mealPeriod with Outlet in WaiterPOS layout

## History

### backend - 2026-07-01 — Waiter POS — Menu Filtering by Meal Period
- Refactored schema: replaced MenuServiceTime/MenuServiceTimeType with direct MenuMealType model
- Created Prisma migration add_menu_meal_type with seed data updated for new model
- Implemented GET /api/menus?mealType=<time> endpoint with stock > 0 filtering
- Updated MealType route to return fixed ServiceTime enum values (no longer CRUD-manageable)
- Added mealTypes field to MenuItem type and getByMealType to ElectronAPI/IPC/preload
- Fixed seeded user roles (staff → waiter/store/kitchen) and re-enabled user seeding with PINs

### frontend - 2026-07-01 — Waiter POS — Meal Period Time Slots
- Implemented time-slot logic (BREAKFAST 6-11, LUNCH 12-17, DINNER 18-5 overnight, DESSERT/BEVERAGE always)
- Split meal period cards into "Now Serving" (active + always available) and "Closed" sections
- Created WaiterDateTime component with day strip (Mon–Sun), live clock, date, and login timestamp
- Centered header layout, side-by-side day strip and timestamp display
- Replaced deepseek-coder:6.7b with gemma3:4b, then unified on qwen2.5-coder:7b for both frontend and backend codegen
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
