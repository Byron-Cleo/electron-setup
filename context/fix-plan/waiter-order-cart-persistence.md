# Waiter Order Cart Persistence — Cross-Serving-Time Ordering

## Goal

Make the waiter's current order (Column 3) survive navigation between serving-time pages and app restarts, so a waiter can build one customer order by visiting multiple meal periods (e.g., LUNCH then BEVERAGE) without losing already-ordered items. Extract the 3-column layout into a reusable grid, capture free + paid accompaniments per order line, show live remaining plates per menu item, and auto-deduct plates (Sold Out at zero) when an order is placed.

---

## Current Behavior

- `WaiterMenu.tsx` holds `orderItems` in local `useState` (line 39) → navigating back to `/waiter` unmounts the component and the entire order is lost
- Starch/vegetable selected in the detail column is never saved to the order line
- Menu fetch uses a local inline `fetch()` helper (lines 19–29) instead of the mandated `@/lib/api.ts`
- `MenuItem` type in `types/electron.d.ts` is missing `availablePlates` even though `WaiterMenu.tsx:237` reads it at runtime
- No cart indicator on the landing page
- Plates badge already shown in the list (green/amber/red) but not enforced as a quantity cap, and no local deduction on order placement

---

## Design

### Order state (Context)

`WaiterOrderProvider` wraps `<Outlet />` in `WaiterLayout.tsx`. Provides `useWaiterOrder()`:

- `items: OrderLineItem[]`
- `addToOrder(item, starch, vegetable)`
- `updateQuantity(menuId, delta)` — capped at remaining plates
- `removeItem(menuId)`
- `clearOrder()`
- `totalPrice`

Persistence: `localStorage` key `eraeva.waiterOrder.v1`, payload `{ waiterId, items }`. Hydrate on provider mount (guard: ignore if `waiterId` ≠ current user id). Persist on every items change via `useEffect`. Clear after successful order placement.

### Data model

```ts
interface OrderAccompaniment {
  id: string
  name: string
  category: string      // "starch" | "vegetable"
  price: number | null  // null/0 = free default accompaniment
  isDefault: boolean
}

interface OrderLineItem {
  menuItem: MenuItem
  quantity: number
  starch: OrderAccompaniment | null
  vegetable: OrderAccompaniment | null
}

// linePrice = (menuItem.price + (starch?.price ?? 0) + (vegetable?.price ?? 0)) * quantity
// totalPrice = Σ linePrice
```

### Reusable 3-column grid — `WaiterMenuGrid`

| Column | Content |
|---|---|
| 1 | Categories → menu items. Each row shows name + price + **remaining plates badge** (green >5, amber 1–5, red `Sold Out` at 0). Add disabled at 0 |
| 2 | Selected item detail: images, price, stock, starch chips, vegetable chips, **Add to Order** (captures selected accompaniments) |
| 3 | Current order: each line = name + qty (+/− capped at plates) + remove; sub-rows for accompaniments — free/default shown with no price, paid shown with `+KSH x`; line subtotal; footer = total + **Place Order** |

### Plates / Sold Out behavior

- Column 1 shows live `availablePlates` beside every menu name
- Quantity controls clamp to remaining plates
- At 0 → Sold Out badge, item not addable
- **Place Order (Phase 1):** decrement `availablePlates` locally on fetched items by ordered qty, then `clearOrder()`. Items hitting 0 flip to Sold Out
- **Place Order (Phase 2, backend, separate feature):** transactional decrement in `POST /api/pos-orders`; frontend refetches menu to reflect authoritative counts

### Header badge

`WaiterHeader.tsx` shows a small cart-count badge (via `useWaiterOrder`) so the waiter sees pending items even on the landing page.

---

## Files Changed

| File | Action |
|------|--------|
| `desktop/ui/pages/waiterPos/WaiterOrderContext.tsx` | **Create** — provider + `useWaiterOrder` hook + localStorage persistence |
| `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | **Create** — reusable 3-column grid (cols 1–3 moved from `WaiterMenu`) |
| `desktop/ui/pages/waiterPos/WaiterLayout.tsx` | **Update** — wrap `<Outlet />` with `WaiterOrderProvider` |
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | **Refactor** — thin page: fetch period menus via `@/lib/api.ts`, render `<WaiterMenuGrid>`; local plate-deduction on Place Order |
| `desktop/ui/pages/waiterPos/WaiterHeader.tsx` | **Update** — cart-count badge |
| `desktop/ui/lib/api.ts` | **Update** — add `getMenuByMealType(period)` (electron fallback + fetch) |
| `desktop/ui/types/electron.d.ts` | **Update** — add `availablePlates` to `MenuItem`; add `OrderAccompaniment`, `OrderLineItem` |

---

## Implementation Plan

### 1. Types + API

- Add `availablePlates: number` to `MenuItem`
- Add `getMenuByMealType(period)` to `lib/api.ts` (check `window.electron.menu.getByMealType`, fall back to `apiFetch("/menu?mealType=...")`)

### 2. `WaiterOrderContext.tsx`

- Define `OrderAccompaniment`, `OrderLineItem`
- Provider with state + localStorage hydrate/persist + waiter guard
- Helpers: `addToOrder`, `updateQuantity` (clamp at 0), `removeItem`, `clearOrder`, derived `totalPrice`

### 3. `WaiterLayout.tsx`

- Wrap `<Outlet />` in `<WaiterOrderProvider>`

### 4. `WaiterMenuGrid.tsx`

- Move cols 1–3 from `WaiterMenu` into grid; order state via `useWaiterOrder`
- Col 2 passes selected starch/vegetable into `addToOrder`
- Col 3 renders accompaniment sub-rows + line subtotals + capped qty
- Plate badges / sold-out gating in col 1

### 5. `WaiterMenu.tsx`

- Replace inline fetch with `getMenuByMealType`
- Hold fetched items in state; `placeOrder()` decrements local `availablePlates` per line, then `clearOrder()`
- Render `<WaiterMenuGrid mealPeriod items loading error />`

### 6. `WaiterHeader.tsx`

- Badge showing total quantity across order items (`items.reduce((n, oi) => n + oi.quantity, 0)`)

---

## No Backend Changes

This feature is **frontend-only**. Real plate deduction, order persistence, and kitchen queue are a separate **Phase 2 backend feature** (`feature/backend/pos-order-creation`) — noted in the plan but NOT implemented here.

---

## Migration

No schema changes. No database migration needed.
