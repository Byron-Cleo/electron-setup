# Menu Status Tabs — Status Badges + Filter Tabs

## Goal
Replace the binary Available/Unavailable badge in `AllMenuTable` with three computed statuses and add filter tabs at the top of the table with count badges.

## Status
Not Started

## Dependencies
- Backend fix: `context/features/backend/menu-status-auto-availability.md` (prevent auto-setting `isAvailable` on stock update)

## Status Logic

| Condition | Badge | Color |
|---|---|---|
| `isAvailable = false` | **Unavailable** | Red |
| `isAvailable = true` & `stock > 0` | **Available** | Green |
| `isAvailable = true` & `stock = 0` or `null` | **Sold Out** | Orange |

## Tasks

### 1. `desktop/ui/components/menu/AllMenuTable.tsx` — Update status column

**Current code (lines 123-131):**
```tsx
case "status":
  return row.isAvailable ? (
    <span className="... bg-green-100 text-green-700">Available</span>
  ) : (
    <span className="... bg-red-100 text-red-700">Unavailable</span>
  )
```

**Replace with computed status:**
```tsx
function getMenuStatus(item: MenuItem): { label: string; className: string } {
  if (!item.isAvailable) return { label: "Unavailable", className: "bg-red-100 text-red-700" }
  if ((item.stock ?? 0) > 0) return { label: "Available", className: "bg-green-100 text-green-700" }
  return { label: "Sold Out", className: "bg-orange-100 text-orange-700" }
}
```

### 2. `desktop/ui/components/menu/AllMenuTable.tsx` — Add status filter tabs

Add tabs above the search bar (similar to Kitchen's Pending/Partial/Completed tabs):

```
[  All (N)  ] [  Unavailable (N)  ] [  Available (N)  ] [  Sold Out (N)  ]
```

- `All` shows all items
- Other tabs filter by that status
- Count badges show number of items in each status (from the pre-filtered `items` array)
- Active tab has distinct visual style (filled/pilled like existing sub-tab pattern)

**State:**
```ts
const [statusTab, setStatusTab] = useState<"all" | "unavailable" | "available" | "soldout">("all")
```

**Filter logic** (applied after search):
```ts
const statusFiltered = useMemo(() => {
  const searched = /* existing search filter */
  if (statusTab === "all") return searched
  return searched.filter(item => {
    const isSoldOut = item.isAvailable && ((item.stock ?? 0) <= 0)
    const isAvailable = item.isAvailable && (item.stock ?? 0) > 0
    const isUnavailable = !item.isAvailable
    switch (statusTab) {
      case "unavailable": return isUnavailable
      case "available": return isAvailable
      case "soldout": return isSoldOut
    }
  })
}, [items, search, statusTab])
```

### 3. Count calculation

Compute counts from the full `items` array (before search):
```ts
const counts = useMemo(() => ({
  all: items.length,
  unavailable: items.filter(i => !i.isAvailable).length,
  available: items.filter(i => i.isAvailable && (i.stock ?? 0) > 0).length,
  soldout: items.filter(i => i.isAvailable && (i.stock ?? 0) <= 0).length,
}), [items])
```

### 4. Tab component layout

Use a flex row of small pilled buttons, active tab has filled bg color:
```tsx
const tabs = [
  { key: "all", label: "All", count: counts.all },
  { key: "unavailable", label: "Unavailable", count: counts.unavailable },
  { key: "available", label: "Available", count: counts.available },
  { key: "soldout", label: "Sold Out", count: counts.soldout },
] as const
```

## Files Changed

| File | Action |
|------|--------|
| `desktop/ui/components/menu/AllMenuTable.tsx` | Update status column + add filter tabs |

## No Type Changes Needed

`MenuItem` already has `isAvailable: boolean` and `stock: number`.

## Screenshot Reference

N/A — follow existing "Pending / Partial / Completed" tab pattern from Kitchen feature.
