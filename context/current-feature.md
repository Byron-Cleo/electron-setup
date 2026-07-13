# Procurement Phase 1 — ItemCategory & Item Models

## Platform

backend

## Status

In Progress

## Goals

- Add `ItemCategory` model to Prisma schema with migration
- Add `Item` model to Prisma schema with `ItemUnit` enum
- Create CRUD routes for `/api/item-categories`
- Create CRUD routes for `/api/items`
- Register routes in Express app
- Seed default categories (Proteins, Spices, Oils/Fats, Produce, Beverages, Packaging, Cleaning)
- Seed sample items (fish, chicken, sugar, salt, cooking oil, etc.)

## Notes

- **Soft-delete for items**: `DELETE` sets `isActive = false` to preserve historical stock movement data
- **Slug auto-generation**: If slug not provided, generate from name (e.g. "Cooking Oil" → "cooking-oil")
- **No hard deletes on items**: Items with existing stock movements must not be permanently deleted
- **Decimal(12,2)** for `currentStock` and `reorderLevel` — consistent with existing monetary fields
- **UUID primary keys** via `gen_random_uuid()` — consistent with existing schema
- **Category delete**: Should check if items exist before deleting (prevent orphaned items)
- Future relations (`StockMovement`, `DepartmentRequestItem`, `PurchaseItem`) will be added in later phases

## History

### frontend - 2026-07-01 — Waiter Menu — 3-Column Layout with Expandable Categories
- Refactored from 4-column to 3-column layout
- Merged categories and items into a single expandable column
- Category click toggles items shown below the category name (collapsible)
- Detail column now uses flex-1 to fill remaining space
- Updated feature workflow to call models directly (deepseek-coder:latest / qwen2.5-coder:7b)

### frontend - 2026-07-01 — Waiter Menu — 4-Column Layout with Order Summary
- Refactored WaiterMenu.tsx from flat card grid to 4-column master-detail layout
- Column 1: Categories list (220px, auto-selects first)
- Column 2: Items filtered by selected category (flex-1)
- Column 3: Detail panel with image, accompaniments, Add to Order (320px)
- Column 4: Order Summary with quantity controls, totals, Place Order (280px)
- Fixed type mismatch: accompanyId → starchId in electron.d.ts
- Added starch/vegetable accompaniment objects to MenuItem type
- Updated backend Prisma query to include MenuAccompaniment relations
- Loading/error/empty states preserved
- Build and lint clean

### frontend - 2026-07-01 — Waiter Menu — Fetch by Meal Period
- Created WaiterLayout as shared POS shell with Outlet
- Created WaiterMenu component that fetches menu items by :mealPeriod route param
- WaiterPOS cards navigate to /waiter/menu/:mealPeriod on click
- Nested /waiter routes in App.tsx (index + menu/:mealPeriod)
- Added window.electron fallback in WaiterMenu (fixes blank screen in browser dev mode)
- Loading, error, empty, and success states handled
- Build and lint clean

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
- Replaced deepseek-coder:6.7b with gemma3:4b, then unified on qwen2.5-coder:7b, then back to deepseek-coder:latest (1.3B) for frontend + qwen2.5-coder:7b for backend
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
