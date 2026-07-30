# Menu Status Badges — Unavailable / Available / Sold Out

## Goal
Replace the binary Available/Unavailable status badge with three computed states and add filter tabs by status on the `AllMenuTable`.

---

## Status Logic

| Condition | Badge | Color |
|---|---|---|
| `isAvailable = false` | **Unavailable** | Red (admin manually hidden, or newly created with `@default(false)`) |
| `isAvailable = true` & `stock > 0` | **Available** | Green (in stock, being sold) |
| `isAvailable = true` & `stock = 0` or `null` | **Sold Out** | Orange (depleted by orders) |

---

## Backend Fix

**File:** `backend/routes/menu.ts` (PUT `/:id`)

**Problem:** Line 190 auto-sets `data.isAvailable = Number(stock) > 0`, which conflates the manual visibility toggle with stock status. When stock reaches 0, it silently sets `isAvailable = false`, making the item show as "Unavailable" instead of "Sold Out".

**Fix:** Remove the line `data.isAvailable = Number(stock) > 0;` so `isAvailable` remains a purely manual admin toggle (via the `/availability` endpoint or the Hide button).

This is safe because:
- The waiter screen's `GET /api/menu?mealType=X` already filters by `stock > 0` (line 104)
- The computed status (Unavailable/Available/Sold Out) is derived frontend-only
- `isAvailable` retains its original purpose: manual visibility control

---

## Frontend Changes

### 1. `desktop/ui/components/menu/AllMenuTable.tsx` — Update status column + add filter tabs

**Status column render logic:**
```ts
if (!row.isAvailable) → "Unavailable" (red)
if (row.stock > 0)     → "Available" (green)
else                   → "Sold Out" (orange)
```

**Filter tabs** (at top, above search bar):
```
[All (N)] [Unavailable (N)] [Available (N)] [Sold Out (N)]
```
- Count badges per status
- Active tab filters the table
- Tabs styled like Kitchen "Pending / Partial / Completed" pattern

**No type changes needed** — `MenuItem` already has `isAvailable: boolean` and `stock: number`.

---

## Files Changed

| File | Action |
|------|--------|
| `backend/routes/menu.ts` | Remove `data.isAvailable = Number(stock) > 0` (line 190) |
| `desktop/ui/components/menu/AllMenuTable.tsx` | Update status render + add filter tabs |

## No Migration Needed

No schema changes — `isAvailable Boolean @default(false)` stays as-is.
