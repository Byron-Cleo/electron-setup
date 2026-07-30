# Menu Status — Remove Auto-Set of `isAvailable` on Stock Update

## Goal
Stop automatically setting `isAvailable = false` when stock is updated to 0, so the `isAvailable` field remains a purely manual visibility toggle.

## Status
Not Started

## Dependencies
- None (single line deletion)

## Tasks

### 1. `backend/routes/menu.ts` — Remove auto-availability line

**File:** `backend/routes/menu.ts`, line 188-191

**Current code:**
```ts
if (stock !== undefined) {
  data.stock = stock;
  data.isAvailable = Number(stock) > 0;  // ← REMOVE THIS LINE
}
```

**After:**
```ts
if (stock !== undefined) {
  data.stock = stock;
}
```

**Why:** The waiter screen already filters by `stock > 0` in `GET /api/menu?mealType=X`. Auto-setting `isAvailable` based on stock conflates the manual visibility toggle (`isAvailable`) with the stock-driven status. This prevents distinguishing "Sold Out" (stock=0, but still visible to admin) from "Unavailable" (`isAvailable=false`, hidden from waiter).

**Impact:** Admin can now manually control `isAvailable` via the `PUT /:id/availability` endpoint (used by the Hide/Unhide button) independently of stock levels. Stock is still tracked and consumed by orders.

## Files Changed

| File | Action |
|------|--------|
| `backend/routes/menu.ts` | Remove one line |

## Testing

- Create a menu item with stock > 0 → `isAvailable` stays at default (`false`)
- Update stock to 0 → `isAvailable` should NOT change
- Verify `PUT /:id/availability` still works to toggle `isAvailable`
- Verify waiter `GET /api/menu?mealType=X` still filters out items with `stock = 0`
