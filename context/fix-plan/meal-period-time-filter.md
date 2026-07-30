# Meal Period Time-Based Filter for All Restaurant Menu

## Goal
Apply the same serving-time logic from the waiter POS to the "All Restaurant Menu" table — filter menu items by current meal period (BREAKFAST/LUNCH/DINNER/DESSERT/BEVERAGE) so the menu team only sees relevant items to assign for waiters.

---

## Current Behavior

- `AllMenuTable.tsx` fetches all menu items via `getMenus()` (no time filter)
- Waiter POS (`WaiterPOS.tsx`) hardcodes its own `getActiveMealPeriods()` with time-slot logic
- No shared utility for meal period calculation

---

## Design

- **Now Serving section** — active period(s) highlighted
- **Closed section** — inactive periods dimmed (BREAKFAST/LUNCH/DINNER outside their window)
- DESSERT & BEVERAGE always active
- Clicking any period filters the table to show only items with matching `mealTypes`

Layout mirrors the waiter POS card pattern adapted into a clickable filter bar above the table.

---

## Files Changed

| File | Action |
|------|--------|
| `desktop/ui/lib/mealPeriod.ts` | **Create** — shared utility |
| `desktop/ui/pages/waiterPos/WaiterPOS.tsx` | **Refactor** — import from shared utility |
| `desktop/ui/components/menu/AllMenuTable.tsx` | **Update** — add period filter bar + time-based filtering |

---

## Implementation Plan

### 1. Create `desktop/ui/lib/mealPeriod.ts`

Extract time-slot logic into a shared module:

```ts
export const MEAL_PERIODS = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "BEVERAGE"] as const

// Dev toggle — false = all periods active for development
export const TIME_FILTER_ENABLED = false

export function getActiveMealPeriods(hour: number): ActiveMealPeriod[]
```

**Time slots:**

| Period | Active (when toggle ON) |
|--------|------------------------|
| BREAKFAST | `hour >= 6 && hour < 12` |
| LUNCH | `hour >= 12 && hour < 18` |
| DINNER | `hour >= 18 \|\| hour < 6` |
| DESSERT | Always |
| BEVERAGE | Always |

**Toggle behavior:**
- `TIME_FILTER_ENABLED = false` (dev) → all 5 periods return `isActive: true`
- `TIME_FILTER_ENABLED = true` (production) → BREAKFAST/LUNCH/DINNER follow real time

### 2. Refactor `desktop/ui/pages/waiterPos/WaiterPOS.tsx`

- Remove local `MealPeriod`, `EnrichedPeriod` types
- Remove local `mealPeriods` array and `getActiveMealPeriods()` function
- Import `getActiveMealPeriods`, `MEAL_PERIODS` from `@/lib/mealPeriod`
- Keep icon mapping and card rendering locally (those are UI-specific)

### 3. Update `desktop/ui/components/menu/AllMenuTable.tsx`

**State additions:**
- `const [hour, setHour] = useState(new Date().getHours())` — live clock (60s interval)
- `const [selectedPeriod, setSelectedPeriod] = useState<string>("")` — which period tab is active

**Period filter bar** (above the status tabs):
- 5 clickable period buttons
- Active period highlighted with accent color
- Inactive (Closed) periods shown dimmed
- DESSERT/BEVERAGE always shown as active
- Default selection: first `isActive` period from `getActiveMealPeriods()`

**Table filtering:**
- Filter `items` by `item.mealTypes.includes(selectedPeriod)`
- Keep existing status tabs (`All / Unavailable / Selling Now / Sold Out`) as secondary filter
- If no period selected, show empty state prompting selection

**Visual:**
- "Now Serving" label above active period buttons
- "Closed" label above inactive ones
- Same green/gold accent as waiter POS

---

## No Backend Changes

`MenuItem` already has `mealTypes: string[]`. Frontend filtering via `getMenus()` is sufficient.

---

## Migration

No schema changes. No database migration needed.
