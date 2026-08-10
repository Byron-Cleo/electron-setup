# Waiter Order — Multiple Variant Lines per Food

## Platform

frontend

## Goals

- A waiter can add the same food with **different** served-with/vegetable combinations to one order — each combination is its **own order line** (e.g. Beef+Rice, Beef+Chapati, Beef+Ugali all in the same order/receipt)
- The quantity +/− buttons only increase/decrease a line when the **exact same combination** (food + starch + vegetable) is added again
- Plain items (no accompaniment selected, or items with no accompaniments like beverages) are their own line too — adding plain again just increases that line's qty
- Order summary shows **one line per combination**, each with its own +/− and remove controls
- Same rule applies to any food: fish, chicken, etc.

## Notes

- Current behavior (bug): `WaiterOrderContext.tsx` `addToOrder` matches order lines **by `menuItem.id` only** — selecting beef+rice then beef+chapati overwrites the accompaniment to chapati and increments quantity to 2
- Fix: key order lines by the full combination — `menuItem.id + starch?.id + vegetable?.id` (a line "variant key")
- `OrderLineItem` already stores `starch`/`vegetable` (`types/electron.d.ts`) — no type change needed
- `localStorage` persistence (`eraeva.waiterOrder.v1`) unchanged — old payloads with merged lines will simply be split apart on the next add/merge pass
- No backend work — the order API already takes line items; sending multiple same-food lines is already supported

## Data Model / Keying

```ts
// variant key — used everywhere a line is matched/updated/removed
key = `${menuItem.id}|${starch?.id ?? ""}|${vegetable?.id ?? ""}`

interface OrderLineItem {
  menuItem: MenuItem
  quantity: number
  starch: OrderAccompaniment | null
  vegetable: OrderAccompaniment | null
}

// addToOrder: find line by key → existing? increment qty (clamped to plates) : push new line
// updateQuantity / removeItem / updateAccompaniments: operate on the matching key
```

## Implementation Steps

### 1. `WaiterOrderContext.tsx`
- Add a `lineKey(item, starch, vegetable)` helper (variant key)
- `addToOrder`: find existing by **key**, not menu id — increment qty only for the identical combination; otherwise append a new line
- `updateQuantity(key, delta)`, `removeItem(key)`: match by key
- `updateAccompaniments`: re-key the matched line (since changing accompaniments changes its key) — used when the detail panel edits a line that is already in the order

### 2. `WaiterMenuGrid.tsx`
- Order summary rows use the line's variant key as React `key` (no longer `oi.menuItem.id`)
- Order row identity: two rows may share the same food name — show accompaniment sub-rows (already rendered) to distinguish; add a subtle "qty" with per-line +/− (already present)
- Detail-panel "sync" logic (`syncSelection`, active-line highlight, remove/update) must use the currently-selected line's variant key — pick the stored line that matches `selectedStarch`/`selectedVegetable` for the selected food
- `activeMenuId`/edit flow: when a food is in the order with multiple variants, editing it in the detail panel should target the matching variant line (matched by key)

## Files

| File | Action |
|------|--------|
| `desktop/ui/pages/waiterPos/WaiterOrderContext.tsx` | Update — variant-key line identity |
| `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | Update — keyed rows, edit targeting |

## Verification

- `npm run lint` and `tsc --noEmit` pass
- LUNCH flow: add Beef+Rice → Beef+Chapati → Beef+Ugali → Column 3 shows three separate lines, each qty 1
- Add Beef+Chapati again → only the Chapati line increments to 2; Rice and Ugali lines unchanged
- Add plain Beef (no accompaniment) → separate plain line; adding plain Beef again increments the plain line
- +/− and remove work per line without affecting sibling variants
- Refresh → cart restored with all variant lines intact
- Place Order sends all variant lines; total = sum of all line subtotals
