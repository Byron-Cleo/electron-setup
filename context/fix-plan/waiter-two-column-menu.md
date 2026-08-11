# Waiter Two-Column Menu — Serving Period Bar + Dynamic First Column

## Goal

Rework the waiter POS screen (`/waiter/menu/:period`) from a 3-column layout into a **2-column layout**:

1. **Top bar**: all serving periods listed as chips so the waiter can switch periods (and return to the menu listing) without going back to the landing page.
2. **First column** (spans the width of the current columns 1 + 2, order column untouched): **dynamic** —
   - **State A (listing):** all foods for the active serving period grouped by category — category name as a heading (accompaniment style, e.g. "Vegetable Options") with a grid of menu cards beneath (thumbnail, name, price, plates badge). All categories visible at once, scrollable.
   - **State B (detail):** when a menu card is clicked, the listing **unmounts** and the existing menu detail view mounts in the same wide column (gallery left, accompaniments right, Add to Order). Clicking the active period chip returns to State A.
3. **Second column**: the current order column, unchanged in position (`w-[400px]`) and behavior.

---

## Current Behavior

- `WaiterMenuGrid.tsx` renders 3 columns: categories sidebar (`w-[240px]`, expand/collapse) → item detail (`flex-1`) → order (`w-[400px]`)
- `BackButton` at the top navigates back to `/waiter` (landing period cards)
- Period switching requires navigating back to `/waiter` and clicking another period card (`WaiterPOS.tsx`)
- Order column already persists across periods and app restarts via `WaiterOrderContext` (localStorage)
- Meal periods available from `@/lib/mealPeriod` (`getActiveMealPeriods(hour)`, `MEAL_PERIODS`)

---

## Design

### Top bar — `ServingPeriodBar` (new component)

- Renders all 5 periods (`MEAL_PERIODS`) as chips: BREAKFAST / LUNCH / DINNER / DESSERT / BEVERAGE
- Active periods (from `getActiveMealPeriods`) clickable; closed periods dimmed + disabled (matches `WaiterPOS` landing cards)
- Current period highlighted (brand-maroon)
- Click behavior:
  - **Different period** → `navigate(\`/waiter/menu/\${period}\`)` (existing `WaiterMenu` refetch/reset handles listing reload)
  - **Active period, detail state (State B)** → return to listing (State A)
  - **Active period, already listing (State A)** → no-op (safe to scroll listing to top)

### Two-column layout

```
<div className="flex gap-4 flex-1 min-h-0">
  <div className="flex-1 min-w-0">      ← dynamic first column (old col 1 + 2 width)
    State A: listing
    State B: detail
  </div>
  <div className="w-[400px] shrink-0">  ← order column, unchanged
    ...
  </div>
</div>
```

### State A — Category listing

- Group `items` by `item.category` (`itemsByCategory` already computed)
- Render each category as a block: heading (uppercase, `text-brand-ebony/50` style like accompaniment headings) + grid of cards
- Card: image thumbnail (`menuImageUrl`), name, price, plates badge (existing `platesBadgeClass`)
- Sold-out cards dimmed + disabled
- `onClick` → `setSelectedItem(item)` → State B

### State B — Menu detail

- Reuse the existing detail markup exactly: header (name / price / plates badge), `grid grid-cols-[2fr_3fr]` gallery left + accompaniments right (Served With / Vegetable Options free + charged), centered **Add to Order** button
- No back button inside detail — return to listing via the active period chip in the top bar

### Order column

- Unchanged content and position; persists across period switches via `useWaiterOrder`

### Edge states

- Loading / error / empty states keep the existing full-area layout; error/empty keep a `BackButton` to `/waiter` for recovery (only rendered when there is no listing to return to)

---

## Files Changed

| File | Action |
|------|--------|
| `desktop/ui/pages/waiterPos/ServingPeriodBar.tsx` | **Create** — period chips bar + active-period-return behavior |
| `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | **Refactor** — 2-column layout, dynamic first column (listing ↔ detail), remove top `BackButton`, integrate `ServingPeriodBar` |
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | No change expected (period fetch/reset already handles routing) |
| `desktop/ui/pages/waiterPos/WaiterPOS.tsx` | No change (landing page stays as entry point) |

---

## Implementation Plan

### 1. `ServingPeriodBar.tsx` (create)

- Props: `mealPeriod: string`, `onSelectPeriod: (period: string) => void`
- Compute periods via `getActiveMealPeriods(new Date().getHours())`
- Chips: active → clickable (current highlighted), closed → disabled + dimmed
- Icons from `PERIOD_META`-style map (Sunrise/Sun/Moon/CakeSlice/CupSoda) or text-only chips (keep minimal)

### 2. `WaiterMenuGrid.tsx` (refactor)

- Keep all existing state + detail + order logic
- Add `ServingPeriodBar` above the two columns (in the `flex flex-col` root, replacing the `BackButton` row)
- `onSelectPeriod`: if `period !== mealPeriod` → `navigate`; else → `setSelectedItem(null)` (return to listing)
- Replace 3-column row with 2-column row:
  - First column `flex-1 min-w-0` renders State A (category headings + card grid) when `!selectedItem`, else State B (existing detail markup)
  - Second column order (`w-[400px]`) unchanged
- Remove the `BackButton` import/usage from the normal flow

---

## No Backend Changes

Frontend-only. Route, API, and Prisma untouched.

---

## Migration

None.
