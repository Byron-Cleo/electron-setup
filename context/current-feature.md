# Current Feature

## Platform

frontend

## Status

Not Started

## Pending

### frontend — 2026-07-13 — Col 2 — Detail Panel Redesign

- **Branch**: `feature/waiter/col2-detail-panel-redesign`
- **Status**: Deferred — procurement flow needs to be built first to properly support starch/vegetable extras and stock tracking
- **Goals**:
  - Redesign the center detail column (Column 2) in WaiterMenu.tsx using `context/screenshots/col2.png` as a design template/reference
  - The screenshot is a visual guide for layout inspiration only — only features listed in Goals and Notes should be implemented
  - Column 2 splits into two sub-columns:
    - **Left**: Main food image (images[0]) + thumbnail strip below (images[1..n])
    - **Right**: Food name + "Served With" section with selectable starch and vegetable options
  - **Starch**: 3 selectable options available for any food (Chapati, Rice, Ugali) — fetched from accompaniments API
  - **Vegetables**: Free (Cabbage, Sukuma Wiki) and Premium (others with extra charge like +KSh 50)
  - **Food summary bar** at top (orange/maroon strip): shows selected food name, price, total — acts as order indicator within the detail panel
  - Remove: description, reviews/rating, old starch/vegetable text labels
  - Waiter selects accompaniments when building the order
  - Match the exact visual design from the screenshot as a template
- **Notes**:
  - Workflow: deepseek-coder:latest for frontend implementation → review & apply
  - Accompaniments fetched from GET /api/menu-accompaniments (backend completed via qwen2.5-coder:7b)
  - MenuItem.images[]: images[0] = main image, images[1..n] = thumbnails
  - Frontend: fetch accompaniments on mount, display starch options as selectable pills, vegetable options with Free/Premium badges
  - Use shadcn/ui primitives (Card, Button)
  - Use Tailwind classes with brand tokens
  - After model runs, stop it immediately with `ollama stop <model>`
  - **Deferred because**: starch/vegetable extras and standalone ordering require procurement/inventory system to track stock and pricing properly

## History

### frontend - 2026-07-15 — Settings tab rename
- Renamed "Manager" sidebar label to "Settings" in AdminLayout.tsx
- Updated page heading in Manager.tsx from "Manager" to "Settings"
- Branch: main (direct commit)

### frontend - 2026-07-15 — Procurement Phase 2 — Stock Supplies CRUD
- StockSupplies list page with data table (search, category filter, low stock highlight)
- StockSupplyForm page (create/edit) with react-hook-form + zod validation
- Created lib/api.ts with apiFetch() helper and per-resource functions as API layer
- Refactored existing StockSupplyCategories to use lib/api.ts instead of direct window.electron calls
- Added routes under /admin/manager/stock-supplies in App.tsx
- Branch: feature/store/procurement-phase-2-stock-supplies

### frontend - 2026-07-14 — Procurement Phase 1 — StockSupplyCategory CRUD
- StockSupplyCategories list page with search, edit, delete actions
- StockSupplyCategoryForm page (create/edit) with react-hook-form + zod validation
- IPC handlers and preload methods wired for StockSupplyCategory
- Backend routes: remove StockSupply count include for simpler queries
- UI polish: green (save/add), red (delete/cancel) button colors
- Delete modal: centered title, red accent, highlighted category name
- db:sync script for prisma generate + db push
- Seed 8 categories and 7 stock supplies
- Branch: feature/store/procurement-phase-1-stock-supply-categories

### backend - 2026-07-13 — Procurement Phase 1 — ItemCategory & Item Models
- Added ItemUnit enum (KG, G, L, ML, PCS) to Prisma schema
- Added ItemCategory model with name (unique), description
- Added Item model with slug, unit, categoryId, currentStock, reorderLevel, isActive
- Created CRUD routes for /api/item-categories (GET, POST, PUT, DELETE)
- Created CRUD routes for /api/items (GET, POST, PUT, DELETE with soft-delete)
- Registered routes in Express app
- Seeded 8 default categories and 7 sample items
- Fixed AccompanimentType enum values to uppercase (STARCH, VEGETABLE)
- Branch: feature/store/procurement-phase-1-items

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
