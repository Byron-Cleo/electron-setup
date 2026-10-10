# Menu Direct-Sale Stock (Key In Amount, Sell Without Cooking)

## Platform

backend

## Goals

- Ready-to-sell items (soda, water, packaging) must be sellable WITHOUT a cooking batch — the admin keys a stock amount in directly, orders decrement it, voids restore it, and the waiter card sells down to 0 (gray "Sold Out"), reappearing on the next top-up
- Cooked dishes keep the existing pool engine untouched (cook → allocate → FIFO sell)
- Direct rows reconcile in the daily report: Cooked shows "—", a separate **Received** figure covers mid-shift top-ups, Closing = Opening + Received − Sold (never negative)
- Over-ordering blocked with the same clear error UX as cooked dishes
- Initial set: the 5 Package items; everything else stays cooked (adjustable later in the admin form)

## Notes

- Full plan: `context/fix-plan/menu-direct-sale-stock.md`
- Schema: `Menu.requiresCooking Boolean @default(true)` + `ShiftSnapshot.platesReceived Decimal @default(0)`
- For direct items `Menu.stock` becomes the true ledger (admin-keyed), never recomputed from batch math — `recomputeMenuStock()` guard is the critical change (scheduler, void path, sibling recompute all funnel through it)
- Direct lines write NO `OrderItemAllocation` rows (requires cookingRecordId FK); void restores from `item.quantity`
- Top-up recording: positive delta while a shift is open → increment running shift's snapshot `platesReceived`; reductions are corrections; top-ups between shifts land in the next shift's `openingPlates` at auto-open
- Package items' StockSupply links go dormant (kept, never consulted for direct availability)
- Deploy per AGENTS.md: `db:sync` → backend rebuild → `server:restart` → `/health`; frontend `npm run build` + `build:web -- --server same-origin`; one-time SQL flag for the 5 Package items
- Operator directive: manual implementation, no ollama models
