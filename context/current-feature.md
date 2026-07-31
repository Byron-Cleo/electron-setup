# Current Feature — Menu Accompaniments Create/Edit Modal Forms

## Platform

frontend

## Status

In Progress

## Goals

- Create Menu Accompaniment button above the accompaniments table opens a modal form
- Action column on the table with an Edit button opens the same modal pre-filled, in the request 
- Modal form creates and updates accompaniments (name, category, price, description, isDefault)
- Table refreshes after save
- Backend endpoints for create/update added (POST /api/accompaniments, PUT /api/accompaniments/:id)

## Notes

- Frontend + backend feature. AccompanimentsTable is mounted in desktop/ui/pages/admin/Menu.tsx (subView "accompaniments")
- Follow existing patterns: shadcn Dialog + react-hook-form + zod (see MenuForm.tsx, EditMenuDialog.tsx)
- Category is a plain string on the model; table filters use "STARCH" / "VEGETABLE"
- GET /api/accompaniments already exists; add POST, PUT, and GET /:id

## History

### frontend - 2026-07-31 — Menu Create/Edit — Meal Type + Accompaniment
- Updated `MenuCreateData` type with `mealTypes[]`, `starchId`, `vegetableId`
- Added checkbox group for meal periods (BREAKFAST/LUNCH/DINNER/DESSERT/BEVERAGE) sorted by sortOrder
- Added starch accompaniment dropdown (filtered STARCH) and vegetable accompaniment dropdown (filtered VEGETABLE), each with "None" option
- Updated Zod schema to require at least one meal type
- Meal types and accompaniments fetched on mount via `getMealTypes()` and `getAccompaniments()`
- Edit mode pre-populates meal types and accompaniment selections from fetched item
- Added `getMealTypes()` API function with Electron IPC fallback
- Branch: feature/frontend/menu-create-mealtype-accompaniments

### backend - 2026-07-31 — Menu Create/Edit — Meal Type + Accompaniment
- Added `serializeMenu()` helper for consistent menu response shape
- Updated `POST /api/menu` to accept `mealTypes[]`, `starchId`, `vegetableId` with `$transaction` (create menu → createMany MenuMealType → return with includes)
- Updated `PUT /api/menu/:id` to accept same fields with `$transaction` (update menu → deleteMany + createMany MenuMealType → return with includes)
- Validated mealTypes against `ServiceTime` enum on both POST and PUT
- Refactored `GET /:id` to use `serializeMenu()` helper
- Branch: feature/backend/menu-create-mealtype-accompaniments

### backend - 2026-07-31 — Menu Meal Period Time-Based Filter (frontend-only)
- Created shared `lib/mealPeriod.ts` utility with time-slot logic + dev toggle
- Refactored `WaiterPOS.tsx` to use the shared utility
- Added meal period filter bar (Now Serving / Closed) to `AllMenuTable.tsx`
- Filter menu items by selected period's `mealTypes`
- Live clock updates every 60s
- Dev toggle (`TIME_FILTER_ENABLED`) to bypass time restrictions during development
- Branch: feature/admin/meal-period-time-filter

### frontend - 2026-07-30 — Menu Status Badges + Filter Tabs
- Added computed status column (Unavailable / Selling Now / Sold Out) in AllMenuTable
- Added 4 filter tabs (All / Unavailable / Selling Now / Sold Out) with count badges
- Changed Unavailable color to amber/brown; all active backgrounds at /60 opacity

### backend - 2026-07-30 — Menu Status Auto-Availability Fix
- Removed `data.isAvailable = Number(stock) > 0` from menu.ts PUT route
- isAvailable now purely manual toggle

### frontend - 2026-07-29 — Menu Tab Redesign
- Replaced tab-based Menu page with dashboard layout featuring two clickable cards
- Created `AllMenuTable`, `MenuDetailDialog`, `CreateMenuDialog`, `BackButton`
