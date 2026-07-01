# Waiter POS — Meal Period Time Slots

## Goals

- Automatically determine which meal period(s) are active based on current time
- Visually highlight the active meal period(s) on the Waiter POS landing page
- Disable/deactivate meal periods that fall outside their serving window
- Prevent selection and ordering of meals from inactive periods
- Dessert and Beverage are always active ("Always Available")

## Time Slot Rules

| Meal Period | Serving Window | Behavior |
|---|---|---|
| BREAKFAST | 06:00 – 11:59 | Active only during morning window |
| LUNCH | 12:00 – 17:59 | Active only during midday window |
| DINNER | 18:00 – 05:59 (next day) | Active overnight (spans midnight) |
| DESSERT | Always | Always active |
| BEVERAGE | Always | Always active |

## UI Behavior

- Active meal period cards: fully interactive, clickable, highlighted state
- Inactive meal period cards: visually muted/disabled, non-clickable, show "Closed" or time info
- Current meal period highlighted with a badge or accent (e.g., "Now Serving")
- "Always Available" label on Dessert and Beverage cards
- Time-based logic runs on component mount and can optionally update periodically

## Design Concepts

- Use icon + label layout from existing WaiterPOS meal period cards
- Add a subtle indicator (green dot, badge, opacity change) for active vs inactive
- Disabled cards show reduced opacity and `pointer-events-none`
- May add a tooltip showing serving hours on hover

## Implementation Plan

### Phase 1 — Time Slot Logic & UI States
- Create a utility function `getActiveMealPeriods()` that returns active periods based on `new Date()`
- Apply visual states to meal period cards (active vs disabled)
- Keep Dessert and Beverage always active

### Phase 2 — Navigate to Meal Selection
- Clicking an active meal period navigates to a meal listing view
- Inactive periods show a disabled state with no navigation

### Phase 3 — Filter Meals by Period
- When inside a meal period view, only show meals associated with that period
- Block ordering from other periods

## Notes

- Time logic is entirely client-side — no backend changes needed for determining active periods
- Meals are associated with periods via `MenuServiceTimeType` joined table in the DB
- Backend may need a `GET /api/menu?mealType=BREAKFAST` filter endpoint (already planned in waiter-landing-ui-spec.md)
- Use `useEffect` for initial time check; consider `setInterval` for periodic refresh if needed
- Edge case: at 5:59 AM, DINNER is still active; at 6:00 AM, BREAKFAST becomes active
- Edge case: midnight crossover — DINNER is active from 6PM to 5:59AM next day

## Future Phases (Out of Scope Here)

- Meal listing by period (Phase 2 of original waiter spec)
- Order cart and checkout
- Receipt printing
