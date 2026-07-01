# Waiter POS — Fetch & Display Menus by Meal Period (Phase 2)

> Phase 2 of [Waiter Landing UI — Order Taking & Receipt](./waiter-landing-ui-spec.md). Implements the "List foods for selected meal period" step.

## Goals

- When a waiter clicks an active meal period card (BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE), navigate to a menu page showing all menu items for that period
- Fetch menus from the backend using `GET /api/menu?mealType=<selectedPeriod>` via `window.electron.menu.getByMealType(mealType)`
- Display all menu items (name, price, stock, images, accompaniments) for the selected service time
- The WaiterPOS parent layout design (header, navigation, branding) is kept consistent across all pages — only the content area and route change
- Route changes to reflect the selected meal period (e.g., `/waiter/menu/LUNCH`) while maintaining the same design shell
- Show the selected meal period name prominently in the menu page (e.g., "LUNCH MENU")
- Handle loading, empty, and error states during fetch

## Route Design

- Parent route: `/waiter` (WaiterPOS layout shell — design stays the same)
- Menu page route: `/waiter/menu/:mealPeriod` (e.g., `/waiter/menu/LUNCH`)
- The route drives what content is shown — same design, different food listing per period
- Navigation: clicking a meal period card navigates to `/waiter/menu/<period>`; a back button returns to `/waiter`

## Data Flow

```
WaiterPOS layout (persistent design shell)
  └─ Route: /waiter (period cards grid)
       └─ MealPeriodCard click → navigate("/waiter/menu/LUNCH")
  └─ Route: /waiter/menu/:mealPeriod (menu listing)
       └─ window.electron.menu.getByMealType("LUNCH")
            └─ ipcRenderer.invoke → ipcMain.handle → GET /api/menu?mealType=LUNCH
                 └─ Express → Prisma (MenuMealType filter + stock > 0)
                      └─ Returns MenuItem[] with mealTypes field
       └─ Render menu items in content area
            └─ Each item shows: image, name, price, stock badge, accompaniments
            └─ Click item → expand details or select for order
```

## UI States

| State | Behavior |
|---|---|
| Loading | Skeleton cards or spinner in content area |
| Empty | "No items available for [MealPeriod]" message |
| Error | Error banner with retry button |
| Success | Grid/list of menu items for selected period |

## Implementation Plan

### Step 1 — Route Setup
- Add nested route under `/waiter`: `/waiter/menu/:mealPeriod`
- Menu route uses the same WaiterPOS layout shell (design reuse)
- WaiterPOS gets an `<Outlet />` or conditional rendering for child content

### Step 2 — Navigation & Fetch
- Meal period card click → `navigate("/waiter/menu/<period>")`
- Menu page component reads `:mealPeriod` from URL params
- Calls `window.electron.menu.getByMealType(mealPeriod)` on mount
- Displays fetched menus in a responsive card grid
- Each card shows: image, name, price, stock indicator
- Show meal period header (e.g., "LUNCH — 4 items available")
- Back button returns to `/waiter`

### Step 3 — Item Details & Selection (Future)
- Click menu item → expand details (description, accompaniments)
- Add to cart / order flow

## Notes

- Backend `GET /api/menu?mealType=<time>` already implemented and tested
- `window.electron.menu.getByMealType(mealType)` already exposed in preload + IPC
- `MenuItem` type already includes `mealTypes: string[]` field
- Stock > 0 filtering is handled by backend — frontend only displays what it receives
- Meal period time-slot logic (active vs closed) already implemented in previous feature
- Only active meal periods should be clickable — closed periods remain disabled
- Use React Router nested routes under `/waiter` so the layout shell is preserved while content changes
- The design is the same for all periods — only the food listing and route differentiate the experience
