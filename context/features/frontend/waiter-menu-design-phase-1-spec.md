# Waiter Menu — Four-Column Category → Items → Detail → Order Summary Design

## Goals

- Replace the current flat card grid with a **4-column master-detail + order summary layout**
- **Column 1 (Categories):** List all unique `Menu.category` values (e.g., Beef, Chicken, Fish) derived from fetched menu items
- **Column 2 (Items):** When a category is selected, show all `Menu.name` values belonging to that category (e.g., category "Beef" → "Beef Fry", "Beef Stew")
- **Column 3 (Detail):** When a menu name is selected, display a detailed report of that item including its **accompaniments** (via `starchId` → `MenuAccompaniment.name` and `vegetableId` → `MenuAccompaniment.name`)
- **Column 4 (Order Summary):** A persistent right-side panel showing all items the waiter has added to the current order. Displays food name, quantity, and line total per item, plus a grand total at the bottom. Shows "No Food Ordered Yet" placeholder when empty.
- Keep the existing meal period header, back button, loading/error/empty states
- All four columns should be visually distinct with clear selection states

## Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back   LUNCH Menu                                                 │
├──────────┬───────────────────────┬─────────────────────┬─────────────┤
│ Category │ Items (in category)  │ Detail Panel        │ Order       │
│          │                       │                     │ Summary     │
│  Beef    │  Beef Fry          → │ Name: Beef Fry       │ Beef Fry    │
│  Chicken │  Beef Stew           │ Description: ...     │  x2  KSH 1600│
│  Fish    │  Beef Choma          │ Price: KSH 800       │ Beef Stew   │
│          │                       │ Stock: 12            │  x1  KSH 900│
│          │                       │ Starch: Rice/Chapati │ ─────────── │
│          │                       │ Vegetable: Kachumbari│ Total: 2500 │
│          │                       │ [Add to Order]       │ [Place Order]│
└──────────┴───────────────────────┴─────────────────────┴─────────────┘
```

## Column Width Calculation

The four columns must sum to exactly 100% of the parent container's width. The layout uses a mix of fixed-width and flex columns:

| Column | Width | Strategy |
|--------|-------|----------|
| 1 — Categories | `w-[220px]` (～220px) | Fixed width — narrow enough for category names |
| 2 — Items | `flex-1` | Remaining space after all fixed columns are subtracted |
| 3 — Detail | `w-[320px]` (～320px) | Fixed width — accommodates image + description + accompaniments |
| 4 — Order Summary | `w-[280px]` (～280px) | Fixed width — accommodates order lines + totals |

**Math:** `220px + flex-1 + 320px + 280px + gaps = 100% container width`
- On a typical 1440px viewport: 220 + flex-1(~580) + 320 + 280 = 1400px (with ~40px for gaps)
- On smaller viewports, `flex-1` (Column 2) shrinks accordingly
- On very small screens (below 1024px), consider collapsing to a single-column stacked layout or hiding the summary panel behind a toggle

Implementation uses Tailwind's `grid-cols-[220px_1fr_320px_280px]` or a flexbox row with `shrink-0` on fixed columns and `min-w-0 flex-1` on the flexible center column.

### Column 1 — Categories (220px fixed)
- Scrollable list of unique `category` values from the fetched menu items
- Each entry shows the category name & a count badge of items in that category
- Selected category is highlighted with active styling (brand-maroon bg)
- Default: first category is pre-selected on load

### Column 2 — Items (flex-1, center column)
- Scrollable list of menu item names belonging to the selected category
- Each entry shows: item name, price, stock badge (color-coded)
- Hover and active selection states
- Selected item is highlighted
- Clicking an item populates Column 3

### Column 3 — Detail Panel (～320px wide)
- Selected menu item's full details:
  - Image (if available), otherwise placeholder icon
  - Name, description, price
  - Stock indicator with color-coded badge
  - **Starch:** Display the `MenuAccompaniment.name` linked via `starchId`
  - **Vegetable/Side:** Display the `MenuAccompaniment.name` linked via `vegetableId`
  - Rating stars (if available)
- **"Add to Order" button** — clicking adds the selected item to the order summary (Column 4). If the item is already in the order, increment its quantity by 1.
- Quantity selector (optional): `-` / number / `+` to choose how many to add
- Empty state when no item is selected: placeholder text "Select an item to view details"

### Column 4 — Order Summary (～280px wide, always visible)
- **Header:** "Current Order" with item count badge
- **Item list** — each row shows:
  - Food name (from `Menu.name`)
  - Quantity selector: `-` / number / `+` to adjust per line
  - Line total: `price × quantity`
  - Delete/remove button (X icon) to remove the item entirely
- **Divider** before totals
- **Total row:** Sum of all line totals, formatted as `KSH X,XXX`
- **Place Order button** at the bottom (disabled when no items, for future order submission flow)
- **Empty state:** Centered "No Food Ordered Yet" message with a muted icon
- The panel is persistent — it remains visible even when browsing categories and items

## Data Model Reference

From `Menu` model (schema.prisma:43-65):
- `category: String` — used for Column 1 grouping (e.g., "Beef", "Chicken")
- `name: String` — the specific dish name (e.g., "Beef Fry"), shown in Column 2
- `starchId → MenuAccompaniment.name` — the starch accompaniment (e.g., Rice, Chapati)
- `vegetableId → MenuAccompaniment.name` — the vegetable accompaniment (e.g., Kachumbari)
- `images`, `description`, `price`, `stock`, `rating`, `numReviews`

From `MenuAccompaniment` model (schema.prisma:67-78):
- `id`, `name`, `category`, `description`, `price`, `image`, `isDefault`

## State Management

```typescript
// In WaiterMenu.tsx (replacing flat fetchState):
type OrderLineItem = {
  menuItem: MenuItem
  quantity: number
}

type WaiterMenuState = {
  categories: string[]                         // unique category values
  itemsByCategory: Record<string, MenuItem[]>  // grouped by category
  selectedCategory: string | null
  selectedItem: MenuItem | null
  orderItems: OrderLineItem[]                  // items added to current order
}
```

## Data Flow

1. On mount: fetch menus by meal period (existing `fetchMenuByMealType`)
2. Derive unique categories from fetched items: `[...new Set(items.map(i => i.category))]`
3. Group items by category: `items.reduce((acc, item) => { ... })`
4. Set default: `selectedCategory = categories[0]`, `selectedItem = first item of that category`
5. On category click: update `selectedCategory`, reset `selectedItem` to first item of new category
6. On item click: update `selectedItem`
7. Detail panel reads `selectedItem.starchId` and `selectedItem.vegetableId` — these are UUIDs linking to `MenuAccompaniment`. If the API response doesn't include joined accompaniment names, the backend route will need to be updated to populate them (e.g., `include: { starch: true, vegetable: true }` in Prisma query)
8. **"Add to Order"** click:
   - Check if `menuItem.id` already exists in `orderItems`
   - If yes: increment `quantity` by 1
   - If no: append `{ menuItem, quantity: 1 }` to `orderItems`
9. **Quantity adjustment** in Order Summary:
   - `+` button: increment quantity by 1
   - `-` button: decrement by 1; if quantity reaches 0, remove the item
   - Remove (X) button: immediately remove the item from orderItems
10. **Totals:** Derived from `orderItems` — each line total is `menuItem.price × quantity`, grand total is sum of all line totals

## UI States

| State | Column 1 | Column 2 | Column 3 | Column 4 |
|-------|----------|----------|----------|----------|
| Loading | — | — | Spinner (same as current) | Empty |
| Error | — | — | Error banner (same as current) | Empty |
| Empty | — | — | "No items" message | Empty |
| Success, no selection, empty order | Categories listed | Items listed | "Select an item" placeholder | "No Food Ordered Yet" |
| Success, item selected, empty order | Categories listed (active) | Items listed (active) | Full detail card + Add to Order btn | "No Food Ordered Yet" |
| Success, item selected, items in order | Categories listed (active) | Items listed (active) | Full detail card + Add to Order btn | Order items list + total + Place Order btn |

## Backend Changes Required

The current API (`GET /api/menu?mealType=`) returns `MenuItem[]` with `starchId` and `vegetableId` as UUID strings. To display accompaniments by name, the backend must be updated to:

- Include the related `MenuAccompaniment` records via Prisma relations
- Add `starchName` and `vegetableName` (or the full accompaniment object) to the response
- Current Prisma query should add:
  ```prisma
  include: {
    starch: { select: { name: true, price: true } },
    vegetable: { select: { name: true, price: true } }
  }
  ```

## No Route Changes

- Route remains `/waiter/menu/:mealPeriod`
- No new routes needed — this is purely a component refactor within `WaiterMenu.tsx`

## Usage of shadcn Primitives

| Element | shadcn Component |
|---------|-----------------|
| Layout container | `<Card>` or styled `<div>` with grid |
| Category/Item list items | `<Card>` with hover states |
| Detail panel | `<Card>` with `<CardHeader>`, `<CardContent>` |
| Order summary panel | `<Card>` with `<CardHeader>`, `<CardContent>`, `<CardFooter>` |
| Buttons (Back, Add to Order, Place Order) | `<Button>` |
| Badges (stock count, item count) | `<Badge>` |
| Quantity controls | `<Button>` with `variant="outline"` size="sm" |
| Delete line item (X) | `<Button>` with `variant="ghost"` size="icon" |

## Files to Modify

| File | Change |
|------|--------|
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | Full refactor: replace flat grid with 4-column layout, add category/item selection, add detail panel with accompaniment display, add order summary panel with quantity controls |
| `desktop/electron/ipc-handlers.ts` | Possibly — if backend needs to return joined accompaniment data and IPC handler needs updating |
| `desktop/types/electron.d.ts` | Possibly — if `MenuItem` type needs `starchName`/`vegetableName` fields |
| `backend/src/routes/menu.ts` | Update Prisma `findMany` to `include` starch and vegetable relations |
| `backend/prisma/schema.prisma` | No change needed — relations already exist |
