# Kitchen Cooking Production — Phase 6: Waiter Availability Display

## Platform

frontend

## Status

Not Started

## Goals

- Update waiter menu to show available plates for each menu item
- Disable Add to Cart button when item is sold out (0 plates)
- Show prominent "Sold Out" indicator

## Notes

- This is a small update to existing `WaiterMenu.tsx` file
- The file already shows stock badges and "In Stock"/"Out of Stock" text
- Changes: use `availablePlates` field, disable ordering when 0, improve sold out visibility
- Waiters do NOT see plate counts — just "In Stock" / "Sold Out"
- Auto-deduct happens on backend when order is placed (not in this file)
- This phase can be done anytime after Phase 1 (backend must return availablePlates)

## Backend Dependency

The API must return `availablePlates` field in menu response:
- `GET /api/menu?mealType=DINNER` should include `availablePlates`

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/pages/waiterPos/WaiterMenu.tsx | Modify | Use availablePlates, disable Add to Cart when 0 |

---

## Tasks

### Task 1: Update Stock Field Reference

1. Open `desktop/ui/pages/waiterPos/WaiterMenu.tsx`
2. Find all references to `item.stock`
3. Replace with `item.availablePlates`
4. Update `stockBadgeClass` function parameter name for clarity

### Task 2: Disable Add to Cart When Sold Out

1. Find the Add to Cart button (line 373-378)
2. Add `disabled` prop when `selectedItem.availablePlates === 0`
3. Change button text to "Sold Out" when disabled
4. Keep same styling for disabled state

### Task 3: Improve Sold Out Visibility

1. Find the stock badge in detail view (line 300-302)
2. Change "In Stock" text to show plate count: "20 plates available"
3. Change "Out of Stock" text to "Sold Out"
4. Update category list badge to show plate count or "0"

---

## Current Code (Before)

```typescript
// Line 136-140: Stock badge class function
function stockBadgeClass(stock: number) {
  if (stock > 5) return "bg-brand-green/10 text-brand-green"
  if (stock > 0) return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-600"
}

// Line 241-248: Category list badge
<span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", stockBadgeClass(item.stock))}>
  {item.stock}
</span>

// Line 300-302: Detail view badge
<span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", stockBadgeClass(selectedItem.stock))}>
  {selectedItem.stock > 0 ? "In Stock" : "Out of Stock"}
</span>

// Line 373-378: Add to Cart button
<Button
  className="w-full bg-brand-maroon hover:bg-brand-maroon/90 text-white"
  onClick={() => addToOrder(selectedItem)}
>
  Add to Cart
</Button>
```

## Updated Code (After)

```typescript
// Line 136-140: Stock badge class function (parameter renamed for clarity)
function stockBadgeClass(plates: number) {
  if (plates > 5) return "bg-brand-green/10 text-brand-green"
  if (plates > 0) return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-600"
}

// Line 241-248: Category list badge (use availablePlates)
<span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", stockBadgeClass(item.availablePlates))}>
  {item.availablePlates > 0 ? item.availablePlates : "0"}
</span>

// Line 300-302: Detail view badge (use availablePlates, show count)
<span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", stockBadgeClass(selectedItem.availablePlates))}>
  {selectedItem.availablePlates > 0 
    ? `${selectedItem.availablePlates} plates available` 
    : "Sold Out"}
</span>

// Line 373-378: Add to Cart button (disabled when sold out)
<Button
  className="w-full bg-brand-maroon hover:bg-brand-maroon/90 text-white"
  onClick={() => addToOrder(selectedItem)}
  disabled={selectedItem.availablePlates === 0}
>
  {selectedItem.availablePlates === 0 ? "Sold Out" : "Add to Cart"}
</Button>
```

---

## UI Changes

### Category List (Before)
```
│  Chicken      │ 3  │
│  Beef         │ 2  │
```

### Category List (After)
```
│  Chicken      │ 20 │  (or "0" when sold out)
│  Beef         │ 12 │
```

### Detail View (Before)
```
│  KSH 350      │
│  In Stock     │
```

### Detail View (After)
```
│  KSH 350                │
│  20 plates available    │  (or "Sold Out" in red)
```

### Add to Cart Button (Before)
```
┌─────────────────────┐
│    Add to Cart       │
└─────────────────────┘
```

### Add to Cart Button (After - when sold out)
```
┌─────────────────────┐
│      Sold Out        │  (disabled, grayed out)
└─────────────────────┘
```

---

## Testing Checklist

- [ ] Waiter menu loads correctly
- [ ] Available plates shown for each item in category list
- [ ] "Sold Out" badge appears when 0 plates
- [ ] Add to Cart button disabled when sold out
- [ ] Button text changes to "Sold Out" when disabled
- [ ] Detail view shows "X plates available" when in stock
- [ ] Detail view shows "Sold Out" when 0 plates
- [ ] Color coding works (green >5, amber 1-5, red 0)
- [ ] No changes to order summary or other functionality
