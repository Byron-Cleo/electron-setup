# Waiter Order Cart Persistence — Cross-Serving-Time Ordering

## Platform

frontend

## Goals

- Order cart (Column 3) persists across serving-time pages by lifting state to a Context provider in `WaiterLayout`
- Cart persists across app restarts via `localStorage` (keyed by waiter id)
- 3-column layout extracted into a reusable `WaiterMenuGrid` component
- Order lines capture free + paid accompaniments — free/default shown unpriced (accountability), paid added to the line total
- Remaining plates shown beside every menu item in Column 1; quantity capped at plates; Sold Out at 0
- Placing an order deducts plates locally (Phase 1) and clears the cart
- Header cart-count badge so the waiter sees pending items on the landing page

## Notes

- Existing `WaiterHeader.tsx` already covers the top section (logo, "Waiter POS", waiter name, logout) — no changes beyond the badge
- Existing `WaiterPOS.tsx` landing page is the serving-time picker — navigation flow stays (`/waiter` ↔ `/waiter/menu/:period`)
- `orderItems` currently lives in `WaiterMenu.tsx:39` local state → the bug this fixes (cart lost on navigation)
- Starch/vegetable selection in the detail column must be saved per order line (`OrderLineItem.starch/vegetable`)
- `MenuItem` type is missing `availablePlaces` → actually `availablePlates`; must be added to `types/electron.d.ts`
- Receipt-ready shape: `OrderLineItem` (menu + accompaniments + qty) + `totalPrice` is exactly what a later receipt-printing feature will render
- No backend work — real plate deduction + kitchen queue are a separate Phase 2 backend feature

## Data Model

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
// totalPrice  = Σ linePrice over all items
```

## Layout

```
WaiterLayout (WaiterOrderProvider wraps Outlet)
├── WaiterHeader (+ cart-count badge)
└── <Outlet/>
    ├── WaiterPOS            (serving-time picker — unchanged)
    └── WaiterMenu           (thin: fetch period items → render grid)
        └── WaiterMenuGrid   (3 columns)
```

## Implementation Steps

### 1. Types + API
- `types/electron.d.ts`: add `availablePlates: number` to `MenuItem`; add `OrderAccompaniment`, `OrderLineItem`
- `lib/api.ts`: add `getMenuByMealType(period)` — use `window.electron.menu.getByMealType` when present, else `apiFetch("/menu?mealType=" + period)`

### 2. `WaiterOrderContext.tsx` (new)
- `WaiterOrderProvider` + `useWaiterOrder()` hook
- State: `items: OrderLineItem[]`
- Hydrate from `localStorage` key `eraeva.waiterOrder.v1` (`{ waiterId, items }`); ignore payload if `waiterId` ≠ `useAuthStore` user id
- Persist on change via `useEffect`
- Actions: `addToOrder(item, starch, vegetable)` (merge by menu id, increment qty), `updateQuantity(menuId, delta)` (min 0, max `menuItem.availablePlates`), `removeItem(menuId)`, `clearOrder()`
- Derived: `totalPrice` via `useMemo`

### 3. `WaiterLayout.tsx`
- Wrap `<Outlet />` with `<WaiterOrderProvider>`

### 4. `WaiterMenuGrid.tsx` (new)
- Props: `{ mealPeriod, items, loading, error }`; order state from `useWaiterOrder()`
- Column 1: categories → items; each row = name + price + plates badge (green >5, amber 1–5, red/`Sold Out` at 0); sold-out rows not selectable
- Column 2: detail with images, price, starch chips, vegetable chips (free tagged `Free`, paid tagged `+KSH x`), `Add to Order` → `addToOrder(item, selectedStarch, selectedVegetable)`; disabled at 0 plates; hide accompaniment sections for BEVERAGE/DESSERT or items with no accompaniments
- Column 3: order summary — per line: name, qty (+/− clamped), remove; accompaniment sub-rows (free unpriced, paid `+KSH x`); line subtotal; footer: total + `Place Order`
- Keep existing empty/loading/error states

### 5. `WaiterMenu.tsx`
- Replace inline fetch helper with `getMenuByMealType` from `@/lib/api.ts`
- Local state for fetched `items` (needed for Phase-1 plate deduction)
- `placeOrder()`: decrement `availablePlates` per ordered line, then `clearOrder()`
- Render `<WaiterMenuGrid mealPeriod={mealPeriod} items={items} loading={loading} error={error} />`

### 6. `WaiterHeader.tsx`
- Badge with total item quantity from `useWaiterOrder()` (e.g., a pill next to the waiter name)

## Files

| File | Action |
|------|--------|
| `desktop/ui/pages/waiterPos/WaiterOrderContext.tsx` | Create |
| `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | Create |
| `desktop/ui/pages/waiterPos/WaiterLayout.tsx` | Update |
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | Refactor |
| `desktop/ui/pages/waiterPos/WaiterHeader.tsx` | Update |
| `desktop/ui/lib/api.ts` | Update |
| `desktop/ui/types/electron.d.ts` | Update |

## Verification

- `npm run lint` and `tsc --noEmit` pass
- Flow test: pick LUNCH → add items → back to landing → pick BEVERAGE → Column 3 still shows LUNCH items → add beverages → both merge in Column 3
- Refresh/restart → cart restored; different waiter login → cart not restored
- Item at 0 plates shows Sold Out and cannot be added; quantity controls clamp to plates
- Place Order decrements plates locally, flips sold-out at 0, clears cart
