# Meal Period Time-Based Filter for All Restaurant Menu

## Goal
Apply the same serving-time logic from the waiter POS to the "All Restaurant Menu" table — filter menu items by current meal period (BREAKFAST/LUNCH/DINNER/DESSERT/BEVERAGE) so the menu team only sees relevant items to assign for waiters.

## Status
Not Started

## Design
- **Now Serving section** — active period(s) highlighted with accent color
- **Closed section** — inactive periods (BREAKFAST/LUNCH/DINNER outside their time window) rendered dimmed
- DESSERT & BEVERAGE always in Now Serving
- Clicking any period button filters the table to show only items with matching `mealTypes`
- Same visual pattern as waiter POS cards, adapted into a clickable filter bar above the table

## Dev Toggle

A `TIME_FILTER_ENABLED` constant in `lib/mealPeriod.ts`:
- `false` (default) — all 5 periods report as active for development
- `true` — BREAKFAST/LUNCH/DINNER follow real-time, DESSERT/BEVERAGE always active

## Time Slots (when toggle is ON)

| Period | Active When | Display |
|--------|-------------|---------|
| BREAKFAST | `hour >= 6 && hour < 12` | "Now Serving" / "Closed" |
| LUNCH | `hour >= 12 && hour < 18` | "Now Serving" / "Closed" |
| DINNER | `hour >= 18 \|\| hour < 6` | "Now Serving" / "Closed" |
| DESSERT | Always | "Always Available" |
| BEVERAGE | Always | "Always Available" |

## Tasks

### 1. Create `desktop/ui/lib/mealPeriod.ts`

Shared utility extracted from `WaiterPOS.tsx`:

```ts
export const MEAL_PERIODS = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "BEVERAGE"] as const
export type MealPeriodLabel = typeof MEAL_PERIODS[number]

export interface ActiveMealPeriod {
  period: MealPeriodLabel
  isActive: boolean
  servingHours: string
  badgeLabel: string
}

// Dev toggle — false = all periods active for development
export const TIME_FILTER_ENABLED = false

export function getActiveMealPeriods(hour: number): ActiveMealPeriod[]
export function getActivePeriodLabels(hour: number): MealPeriodLabel[]
```

- `getActiveMealPeriods()` maps each period with `isActive` flag
- When `TIME_FILTER_ENABLED = false`, all periods return `isActive: true`
- When `true`, BREAKFAST/LUNCH/DINNER follow time-slot rules

### 2. Refactor `desktop/ui/pages/waiterPos/WaiterPOS.tsx`

- Remove local `MealPeriod` type, `EnrichedPeriod` type, `mealPeriods` array, and `getActiveMealPeriods()` function
- Import `getActiveMealPeriods`, `MEAL_PERIODS`, `ActiveMealPeriod` from `@/lib/mealPeriod`
- Keep icon mapping and card `renderCard` UI locally
- Call `getActiveMealPeriods(hour)` instead of local version (second arg `mealPeriods` removed)

### 3. Update `desktop/ui/components/menu/AllMenuTable.tsx`

**State additions:**
```ts
const [hour, setHour] = useState(new Date().getHours())
const [selectedPeriod, setSelectedPeriod] = useState<MealPeriodLabel>("")
```

**Live clock** (updates every 60s):
```ts
useEffect(() => {
  const id = setInterval(() => setHour(new Date().getHours()), 60000)
  return () => clearInterval(id)
}, [])
```

**Default period selection:**
- On mount, set `selectedPeriod` to the first `isActive` period from `getActiveMealPeriods()`

**Period filter bar** (above the status tabs):
- Two sections: "Now Serving" and "Closed"
- Each period as a clickable button
- Active (selected) period has filled accent background
- Now Serving periods shown normally, Closed periods shown with `opacity-50` and `cursor-not-allowed`
- DESSERT/BEVERAGE always in Now Serving section

**Table filtering:**
```ts
const periodFiltered = useMemo(() => {
  if (!selectedPeriod) return items
  return items.filter((item) => item.mealTypes.includes(selectedPeriod))
}, [items, selectedPeriod])
```

- Period filter applied first, then status tabs filter on top
- All existing features (search, pagination, detail/edit/hide) preserved

## Files Changed

| File | Action |
|------|--------|
| `desktop/ui/lib/mealPeriod.ts` | **Create** — shared utility |
| `desktop/ui/pages/waiterPos/WaiterPOS.tsx` | **Refactor** — import from shared utility |
| `desktop/ui/components/menu/AllMenuTable.tsx` | **Update** — add period filter bar + time-based filtering |

## No Backend Changes

`MenuItem` already has `mealTypes: string[]`. Frontend filtering via `getMenus()` is sufficient.

## No Schema / Migration Changes

All data already exists in the database.
