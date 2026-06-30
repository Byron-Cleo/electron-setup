# Waiter Landing UI — Order Taking & Receipt

## Goals

- Display MealPeriod options: BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE
- When a waiter selects a meal period, list all available Menu items for that period
- Waiter can select items and add them to a customer order
- Generate and print a receipt for the customer to use for invoice payment
- Seed database with available food data

## Notes

- Backend already has `MealPeriod` enum: BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE
- Menu items are associated with meal periods via `MenuMealType` / `MealType` models
- Need to seed food data into the database
- Print via Electron IPC or browser print API

## Future Phases

### Phase 2 — List foods for selected meal period
- When waiter clicks a meal period, fetch and display all Menu items for that period
- Backend route: GET /api/menu?mealPeriod=BREAKFAST (or similar)

### Phase 3 — Order selection & cart
- Waiter selects items and adds to a customer order cart
- Quantity adjustment, item removal
- Cart summary with totals

### Phase 4 — Receipt generation & printing
- Generate receipt from order data
- Print receipt for customer to use for invoice payment
- Receipt via Electron IPC `window.electron.print` or browser print API

### Phase 5 — Database seeding
- Seed food data (Menu items) linked to MealPeriods
- Ensure test data is available for all periods
