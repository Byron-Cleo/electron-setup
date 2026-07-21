# Current Feature

## Platform
Not Specified

## Status
Not Started

## Goals

## Notes

## History

### frontend - 2026-07-21 — Kitchen Cooking Production Phase 3: Menu Tab — Cooked Food Management
- Created CookedFoodTable component with Produced/Assigned/Available/Variants columns
- Added date selector, SOLD OUT badge, Assign button per row
- Updated Menu.tsx with Cooked Food tab and Create Menu Item tab
- Updated MenuForm with stock item dropdown (filtered by platesPerUnit > 0)
- Added getCookingAssignments, assignment CRUD, getMenus API functions
- Branch: feature/kitchen/cooking-phase-3-menu-cooked-food

### frontend - 2026-07-21 — Kitchen Cooking Production Phase 2: Kitchen Tab UI
- Updated CookingRecord type with platesActual, cookedDate, assignments fields
- Added CookingRecordAssignment, UpdateCookingRecordData, KitchenStockItem types
- Updated getCookingRecords with date param, added updateCookingRecord, getKitchenInventoryList
- Inventory tab: shows Ordered/Cooked/Remaining(PENDING)/Plates Made columns
- Cooking modal: shows PENDING stock summary, platesActual input, auto-calculates expected plates
- History tab: date selector dropdown (Today through 6 days back), Variance column (color-coded)
- Branch: feature/kitchen/cooking-phase-2-kitchen-tab

### backend - 2026-07-21 — Kitchen Cooking Production Phase 1: Schema + Backend Foundation
- Added `platesActual` and `cookedDate` fields to CookingRecord model
- Created `CookingRecordAssignment` model for menu variant plate assignment
- Enhanced cooking records route with date filtering and platesActual support
- Created cooking assignments route with available plates validation
- Created kitchen inventory route returning stock items with platesPerUnit > 0
- Branch: feature/backend/kitchen-cooking-phase-1

### frontend + backend - 2026-07-20 — Restock/Procure Items Table
- Implemented `RestockView` component in `Store.tsx` with DataTable of low stock items
- Added `GET /api/stock-supplies/low-stock` backend endpoint (returns items where `currentStock <= reorderLevel`)
- Added `getLowStockSupplies()` API function in `lib/api.ts`
- Table columns: Details, Image, Name, Stock, Stock Status, Restock Quantity, Actions
- Details button opens `StockSupplyDetailDialog` modal popup
- Restock button opens modal with item info summary and quantity input
- Post-submit shows success confirmation with shopping list option (printing deferred)
- Restock Quantity = `reorderLevel - currentStock` (how much to order)
- Branch: `feature/store/restock-procure-items-table`

### frontend + backend - 2026-07-20 — Unit Change: Grams (G) → Packets (PKT)
- Replaced `G` with `PKT` in Prisma `ItemUnit` enum
- Updated `UNIT_LABELS` in `lib/api.ts`: `G: "g"` → `PKT: "packets"`
- Updated TypeScript types in `electron.d.ts` (3 occurrences)
- Updated zod schemas and select options in `StockSupplyForm.tsx` and `StockSupplyEditDialog.tsx`
- Updated unit select in `Store.tsx` Add Stock Item modal
- Database schema synced via `prisma db push`

### frontend - 2026-07-20 — Reusable Stock Requests Design
- Created shared `RequestStockDesign` component in `desktop/ui/components/shared/`
- Refactored `StockRequestsList.tsx` to wrap `RequestStockDesign` (showDepartmentColumn, showActionColumn)
- Replaced `MyRequestsView` in Kitchen.tsx with `RequestStockDesign` (department="kitchen", hide columns)
- Configurable props: department filter, showDepartmentColumn, showActionColumn, onRequestFulfilled
- Single source of truth for stock request table design across Store and Kitchen
- Branch: feature/store/reusable-stock-requests

### frontend - 2026-07-17 — Kitchen My Requests Sub-tabs by Status
- Added 3 sub-tabs (Pending, Partial, Completed) with count badges
- Each tab shows filtered DataTable of requests by status
- Expandable row detail shows items with requested/delivered breakdown
- Replaced Card list with DataTable for consistent styling
- Empty state messages per tab

### frontend - 2026-07-17 — Kitchen Stock Status & Last Request Columns
- Added stock status badges (Available/Not Available) in Name column when no request exists
- Added Last Request column showing requested quantity + request status badge (Pending/Partial/Completed)
- Fetches stock requests alongside stock supplies on mount
- Builds lookup map of most recent request per stock supply
- Badge colors: Available (green), Not Available (red), Pending (yellow), Partial (orange), Completed (green)

### backend - 2026-07-17 — Stock Deduction at Request Creation
- Added stock validation before deduction in POST /api/stock-requests
- Added stock deduction in Prisma transaction for atomicity
- Removed stock validation from PUT /api/stock-requests/:id/fulfill
- Removed stock deduction from PUT /api/stock-requests/:id/fulfill
- Fixed .ts import extensions in app.ts and auth.ts
- Branch: feature/backend/stock-deduction-at-request

### frontend - 2026-07-17 — Reusable DataTable Component
- Created generic DataTable component with typed props (Column, renderCell, keyExtractor)
- Data columns: `max-w-[144px]` (expand to fill, cap at 144px), center aligned
- Non-data columns (`isAction: true`): right aligned, flex to fill remaining space
- Scroll appears when >8 data columns exceed container width
- Built-in Pagination integration (always renders, even with exactly 8 records)
- Table height stays constant during page navigation
- Refactored 10 tables across 8 files to use DataTable
- Branch: feature/frontend/reusable-data-table

### frontend - 2026-07-17 — Remove StockSupplyCategory
- Removed StockSupplyCategory, StockSupplyCategoryCreateData, StockSupplyCategoryUpdateData types from electron.d.ts
- Removed categoryId from StockSupply, StockSupplyCreateData, StockSupplyUpdateData types
- Removed stockSupplyCategory namespace from ElectronAPI
- Removed 5 category API functions from lib/api.ts
- Deleted StockSupplyCategories.tsx and StockSupplyCategoryForm.tsx
- Removed 3 category routes and 2 imports from App.tsx
- Removed category card, icon, and view from Manager.tsx settings
- Removed categoryId from StockSupplyForm schema, state, form, and category fetch
- Removed categoryId from StockSupplyEditDialog schema, state, form, and category fetch
- Removed category filter and category column from StockSupplies table
- Removed category filter, category column, and category form field from Store StockView
- Branch: feature/frontend/remove-stock-supply-category

### backend - 2026-07-17 — Remove StockSupplyCategory
- Removed StockSupplyCategory model from Prisma schema
- Removed categoryId and category relation from StockSupply model
- Deleted backend/routes/itemCategories.ts (category CRUD routes)
- Removed category import and route from app.ts
- Removed categoryId from items.ts: POST/PUT destructuring, validation, Prisma queries, category lookups
- Updated seed.ts: removed category seeding, simplified stock supply seeding
- Updated sample-data.ts: removed stockSupplyCategories array and categoryName from stock supplies
- Branch: feature/backend/remove-stock-supply-category

### frontend - 2026-07-17 — Stock Supply Image Upload (Phase 2)
- Added `image: string | null` to StockSupply type
- Updated createStockSupply/updateStockSupply to send FormData when image present
- Bypass Electron IPC when image file present (FormData can't serialize through IPC)
- Added image upload with preview to StockSupplyForm, StockSupplyEditDialog, and Store Add modal
- Added thumbnail column (40x40, rounded, Package icon fallback) to Store StockView and StockSupplies tables
- Branch: feature/frontend/stock-supply-image-upload-phase-2

### backend - 2026-07-16 — Stock Supply Image Upload (Phase 1)
- Installed multer for multipart/form-data handling
- Added `image String` (mandatory) to StockSupply in Prisma schema
- Added static file serving for uploaded images via express.static
- Updated POST /api/stock-supplies to accept image file via multer
- Updated PUT /api/stock-supplies/:id to accept image file via multer, with old image cleanup
- DELETE cleans up image file from disk
- Branch: feature/backend/stock-supply-image-upload

### frontend - 2026-07-16 — Settings & Store Route Refactor
- Renamed all `/admin/manager/` URLs to `/admin/settings/` across 11 files
- Moved StockSupply CRUD (list, create, edit) from Settings tab to Store tab
- Settings tab now shows only: StockSupplyCategory, Department, Kitchen Stock Config
- Stock edit in Store uses modal dialog (StockSupplyEditDialog) instead of page navigation
- Manager.tsx shows "Settings" heading persistively with thumbnail cards; clicking a card renders content inline below
- DepartmentManager, KitchenStockConfig, StockSupplyCategories headings updated to h2 uppercase centered style
- Buttons placed above headings for consistent layout across all three settings sub-views
- Branch: feature/admin/settings-store-route-refactor

### frontend - 2026-07-16 — Stock Management Phase 5: Electron IPC
- Added department, cookingRecord, kitchen namespaces to ElectronAPI
- Added getLowStockCount and getKitchenInventory to stockSupply namespace
- Registered 4 new IPC handler functions in main.ts
- Exposed all new methods via preload.cts contextBridge
- Updated lib/api.ts with window.electron fallback for all new endpoints
- Branch: feature/frontend/stock-management-phase-5-electron-ipc (merged to main)

### frontend - 2026-07-16 — Stock Management Phase 4: Store + Kitchen UI
- Store dashboard: added card descriptions and low stock badge
- StockRequestsList: added expandable fulfillment trail display
- FulfillRequest: added notes field and stock validation
- Kitchen: added Cooked Food view with inventory and cooking history tabs
- Kitchen: added cooking dialog with quantity, plates calculation, notes
- Kitchen: added cooking history table with date/time, items, plates, notes
- Branch: feature/frontend/stock-management-phase-4-store-kitchen-ui (merged to main)

### frontend - 2026-07-16 — Stock Management Phase 3: Admin UI (Settings Page)
- Created DepartmentManager component for department CRUD
- Created KitchenStockConfig component for platesPerUnit/menuId configuration
- Updated StockSupplyForm with department access multi-select
- Integrated both config components into Settings page (Manager.tsx)
- Fixed APPROVED → COMPLETED status in StockRequestsList and Kitchen (blank screen fix)
- Branch: feature/frontend/stock-management-phase-3-admin-ui (merged to main)

### frontend - 2026-07-16 — Stock Management Phase 2: Frontend Types + API Layer
- Updated StockRequestStatus: APPROVED → COMPLETED
- Added new types: Department, StockFulfillment, CookingRecord, KitchenInventory, etc.
- Updated StockSupply with platesPerUnit, menuId, departments
- Updated FulfillStockRequestData with fulfilledById and notes
- Added API functions: departments CRUD, cooking records, kitchen inventory, low stock, kitchen config
- Added department filter to getStockSupplies

### backend - 2026-07-16 — Stock Management Phase 1: Schema + Backend Routes
- Updated Prisma schema: new models (Department, StockFulfillment, CookingRecord), new fields on StockSupply (platesPerUnit, menuId), renamed APPROVED → COMPLETED
- Created departments CRUD route
- Updated stock request fulfill endpoint: deduct store stock, create fulfillment trail, COMPLETED status
- Created cooking records route with plate calculation and menu stock auto-update
- Created kitchen config route for platesPerUnit/menuId configuration
- Added low stock count and kitchen inventory endpoints to stock supplies
- Registered all new routes in Express app

### frontend - 2026-07-16 — Kitchen Request Button & Store UI Refinements
- Kitchen: replaced Request Stock tab with inline request button per stock item row
- Kitchen: added request dialog with quantity input, notes, and success feedback
- Store: added notification badges for pending/partial stock requests (amber/orange pills)
- Store/Kitchen/Menu: updated dashboard card thumbnails from red to green (brand green #4c7f1f)
- Branch: main (direct commit)

### backend + frontend - 2026-07-15 — Stock Request Flow (Kitchen ↔ Store)
- Kitchen views stock levels, submits requests with items + quantities
- Store sees incoming requests with pending/partial/approved tabs
- Store fulfills via form (enter delivered quantities per item)
- Status auto-calculates: PENDING → PARTIAL → APPROVED
- Branch: main (direct commit)

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
- Created WaiterDateTime component with day strip (Mon-Sun), live clock, date, and login timestamp
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
