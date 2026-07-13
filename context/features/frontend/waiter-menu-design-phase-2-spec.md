# Waiter Menu — Phase 2: Cross-Meal-Period Beverage & Dessert Access

## Goals

- While viewing any meal period's menu (BREAKFAST, LUNCH, DINNER), provide quick access to **BEVERAGE** and **DESSERT** items without navigating back to the landing page
- Show beverage/dessert links at the top of the menu page, above the 4-column layout
- Clicking a link switches the entire 4-column layout context to show that meal period's items (categories, items, detail) just like the main meal period
- Ensure the **order summary (Column 4)** persists across meal period switches — items added from any period accumulate in the same order
- BEVERAGE and DESSERT are always available (per the existing time-slot logic), so no "closed" state

## Layout Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← LUNCH Menu    [BEVERAGE] [DESSERT]             Current Order (3)     │
├──────────────────────────────────────────────────────────────────────────┤
│ Category │ Items (in category)  │ Detail Panel        │ Order Summary    │
│   ...    │    ...               │    ...              │    ...           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Quick-Access Bar

- Positioned in the header area, immediately below the back button and current meal period title, or alongside them
- Two pill/chip buttons: **BEVERAGE** and **DESSERT**
- Active meal period is highlighted — if currently viewing LUNCH, BEVERAGE and DESSERT are inactive pills
- Clicking BEVERAGE or DESSERT switches the data context for Columns 1–3 to that meal period's menu items
- The header title updates to reflect the current view (e.g., "BEVERAGE Menu")
- A back navigation chip for the original meal period (e.g., "LUNCH") appears in the bar so the waiter can return

### State: Active Meal Period

A new state variable `activeSubPeriod: 'main' | 'BEVERAGE' | 'DESSERT'` controls which data feeds Columns 1–3:

```typescript
type WaiterMenuState = {
  // ... existing state ...
  activeSubPeriod: 'main' | 'BEVERAGE' | 'DESSERT'
}
```

- `'main'` = the original `:mealPeriod` route param (e.g., LUNCH)
- `'BEVERAGE'` = fetch BEVERAGE items
- `'DESSERT'` = fetch DESSERT items

### Data Flow

1. On mount: fetch items for the route `:mealPeriod` (existing behavior), set `activeSubPeriod = 'main'`
2. On BEVERAGE pill click:
   - Call `fetchMenuByMealType('BEVERAGE')` and store results separately (or refetch)
   - Set `activeSubPeriod = 'BEVERAGE'`
   - Columns 1–3 update to show BEVERAGE categories/items/details
   - Column 4 (order summary) **remains unchanged** — accumulated items persist
3. On DESSERT pill click: same pattern as BEVERAGE
4. On returning to main (e.g., clicking the "LUNCH" pill): restore original `:mealPeriod` data, set `activeSubPeriod = 'main'`
5. Data for each sub-period can be cached in state after first fetch to avoid redundant API calls

### State Management Additions

```typescript
type MealPeriodData = {
  categories: string[]
  itemsByCategory: Record<string, MenuItem[]>
  selectedCategory: string | null
  selectedItem: MenuItem | null
}

type WaiterMenuState = {
  // Shared
  orderItems: OrderLineItem[]
  activeSubPeriod: 'main' | 'BEVERAGE' | 'DESSERT'

  // Per-period data (cached)
  mainData: MealPeriodData | null
  beverageData: MealPeriodData | null
  dessertData: MealPeriodData | null
}
```

- On period switch: check if the target `*Data` is already cached — if so, restore selection state; if not, fetch
- Columns 1–3 read from whichever `*Data` matches `activeSubPeriod`
- On first mount, `mainData` populates from the route `:mealPeriod` fetch; `beverageData` and `dessertData` are lazy-loaded on first click

### BEVERAGE/DESSERT Data Caching

- On first BEVERAGE pill click: fetch `fetchMenuByMealType('BEVERAGE')`, derive categories/groupings, store in `beverageData`, set `activeSubPeriod`
- Subsequent clicks: use cached `beverageData` without refetching
- Same pattern for DESSERT
- The main period data (`mainData`) is always loaded on component mount

### UI States for Quick-Access Bar

| Scenario | Pill State |
|----------|------------|
| Viewing main period (e.g., LUNCH) | BEVERAGE + DESSERT pills are clickable (inactive style) |
| Viewing BEVERAGE | BEVERAGE pill is active (highlighted), main period + DESSERT are clickable |
| Viewing DESSERT | DESSERT pill is active, main period + BEVERAGE are clickable |
| Loading BEVERAGE data on first click | BEVERAGE pill shows spinner/loading state |
| Error fetching sub-period | Toast or inline error on the pill |

### Backend Impact

None — the existing `GET /api/menu?mealType=BEVERAGE` and `GET /api/menu?mealType=DESSERT` endpoints already work. The frontend only needs to call them with the appropriate query parameter.

### Files to Modify

| File | Change |
|------|--------|
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | Add quick-access bar, `activeSubPeriod` state, per-period data caching, period switch logic |
| No backend changes needed | Existing API already supports fetching by any `ServiceTime` value |

### Dependencies

- Phase 1 (4-column design with order summary) must be implemented first, as Phase 2 builds on the same layout and state patterns
