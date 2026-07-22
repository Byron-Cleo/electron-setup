# Menu Cooked Food Variants — Phase 2: Frontend CookedFoodTable

## Platform

frontend

## Status

Not Started

## Goals

- Rewrite CookedFoodTable to display cooked menus with search, edit, delete
- Add search/filter by menu name
- Add edit modal to update menu details
- Add soft-delete with confirmation dialog
- Use reusable DataTable component

## Notes

- This phase depends on Phase 1 (backend API must be ready)
- Only menus whose StockSupply has been cooked are displayed
- Client-side search filtering on fetched data
- Soft-delete sets `isAvailable = false` (menu hidden from waiter screen)
- Edit allows updating menu details (name, price, category, etc.)

## Backend Dependency

This phase uses endpoints created in Phase 1:
- `GET /api/menu/cooked` — list cooked menus with cooking data
- `PUT /api/menu/:id` — update menu details
- `PUT /api/menu/:id/availability` — soft-delete/restore

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/components/menu/CookedFoodTable.tsx | Rewrite | Full rewrite with search, edit, delete |
| desktop/ui/components/menu/EditMenuDialog.tsx | **Create** | New edit modal component |
| desktop/ui/pages/admin/Menu.tsx | Modify | Integrate new CookedFoodTable |
| desktop/ui/lib/api.ts | Modify | Add `getCookedMenus()`, `updateMenuAvailability()` |
| desktop/ui/types/electron.d.ts | Modify | Add `CookedMenuItem` type |

---

## Tasks

### Task 1: Add Types

1. Open `desktop/ui/types/electron.d.ts`
2. Add `CookedMenuItem` interface:

```typescript
interface CookedMenuItem {
  id: string
  name: string
  slug: string
  category: string
  price: number
  stock: number
  isAvailable: boolean
  images: string[]
  stockSupply: {
    id: string
    name: string
    unit: string
    platesPerUnit: number | null
  }
  cooking: {
    totalProduced: number
    totalAssigned: number
    totalAvailable: number
  }
}
```

### Task 2: Add API Functions

1. Open `desktop/ui/lib/api.ts`
2. Add `getCookedMenus(): Promise<CookedMenuItem[]>`
3. Add `updateMenuAvailability(id: string, isAvailable: boolean): Promise<MenuItem>`
4. Verify existing `updateMenu()` function works for edit

### Task 3: Create EditMenuDialog Component

1. Create `desktop/ui/components/menu/EditMenuDialog.tsx`
2. Dialog with form fields: Name, Category, Price, Description, Is Available toggle
3. Pre-populate with current menu data
4. On submit: call `updateMenu()` API
5. On success: refresh table data

### Task 4: Rewrite CookedFoodTable

1. Open `desktop/ui/components/menu/CookedFoodTable.tsx`
2. Replace entire component with new implementation

### Table Structure

**Header:**
- Heading: "Today's Cooked Food — Menu Variants"
- Search input: "Search by menu name..."
- Date selector (optional, can keep from current implementation)

**Columns:**

| Column | Key | Description |
|--------|-----|-------------|
| Name | `name` | Menu item name |
| Category | `category` | Menu category |
| Stock Item | `stockItem` | Linked StockSupply name |
| Produced | `produced` | Total plates from CookingRecords |
| Assigned | `assigned` | Plates assigned to variants |
| Available | `available` | Produced - Assigned (show SOLD OUT badge if 0) |
| Actions | `actions` | Edit + Delete buttons |

**Row Actions:**

| Button | Style | Action |
|--------|-------|--------|
| Edit | outline | Opens EditMenuDialog |
| Delete | destructive outline | Opens confirmation dialog |

### Task 5: Integrate in Menu Page

1. Open `desktop/ui/pages/admin/Menu.tsx`
2. Replace existing CookedFoodTable import with new version
3. Pass any required props (onEdit, onDelete callbacks if needed)

---

## UI Mockups

### CookedFoodTable Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Today's Cooked Food — Menu Variants                                             │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Search: [________________] 🔍                                                   │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  Name       │ Category │ Stock   │ Produced │ Assigned │ Available │ Actions│  │
│  │  ───────────┼──────────┼─────────┼──────────┼──────────┼───────────┼────────│  │
│  │  Chicken Fry│ Chicken  │ Chicken │ 45       │ 20       │ 25        │ ✏️ 🗑️  │  │
│  │  ───────────┼──────────┼─────────┼──────────┼──────────┼───────────┼────────│  │
│  │  Beef Curry │ Beef     │ Beef    │ 12       │ 8        │ 4         │ ✏️ 🗑️  │  │
│  │  ───────────┼──────────┼─────────┼──────────┼──────────┼───────────┼────────│  │
│  │  Fish Fry   │ Fish     │ Fish    │ 30       │ 30       │ SOLD OUT  │ ✏️ 🗑️  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  [1] [2] [3] ...                                                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Edit Menu Dialog

```
┌─────────────────────────────────────────────────┐
│  Edit Menu Item                                  │
│  ──────────────────────────────────────────────  │
│                                                 │
│  Name: [Chicken Fry________________]            │
│                                                 │
│  Category: [Chicken________]                    │
│                                                 │
│  Price: [15000____]                             │
│                                                 │
│  Description: [Crispy fried chicken____]        │
│                                                 │
│  Available: [✓] Toggle                          │
│                                                 │
│  [Cancel]  [Save Changes]                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Delete Confirmation

```
┌─────────────────────────────────────────────────┐
│  Hide Menu Item                                 │
│  ──────────────────────────────────────────────  │
│                                                 │
│  Are you sure you want to hide "Chicken Fry"    │
│  from the waiter screen?                        │
│                                                 │
│  You can restore it later from this table.      │
│                                                 │
│  [Cancel]  [Hide]                               │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## State Management

```typescript
// CookedFoodTable state
const [items, setItems] = useState<CookedMenuItem[]>([])
const [search, setSearch] = useState("")
const [loading, setLoading] = useState(true)
const [error, setError] = useState("")
const [editDialog, setEditDialog] = useState<{ open: boolean; item: CookedMenuItem | null }>({
  open: false,
  item: null,
})
const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: CookedMenuItem | null }>({
  open: false,
  item: null,
})

// Filtered items (client-side search)
const filteredItems = useMemo(() => {
  if (!search) return items
  const q = search.toLowerCase()
  return items.filter((item) => 
    item.name.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    item.stockSupply.name.toLowerCase().includes(q)
  )
}, [items, search])
```

---

## Validation Rules

### Search
- Client-side filtering on fetched data
- Search by: name, category, stock supply name
- Case-insensitive
- No debounce needed (small dataset)

### Edit
- `name` is required
- `price` must be >= 0
- `category` is required

### Delete (Soft)
- Confirmation dialog required
- Sets `isAvailable = false`
- Item removed from table after deletion
- Can be restored later (future feature)

---

## Edge Cases

- **No cooked menus**: Show empty state "No cooked menu items. Cook items in Kitchen first."
- **Search no results**: Show "No menu items match your search"
- **All items sold out**: Show SOLD OUT badge on available column
- **Edit fails**: Show error message in dialog
- **Delete fails**: Show error message in confirmation dialog

---

## Testing Checklist

- [ ] CookedFoodTable displays cooked menus correctly
- [ ] Table shows only menus with cooked StockSupply
- [ ] Search filters by name, category, stock item
- [ ] Search is case-insensitive
- [ ] Edit dialog opens with pre-populated data
- [ ] Edit saves changes successfully
- [ ] Edit dialog shows validation errors
- [ ] Delete shows confirmation dialog
- [ ] Delete sets `isAvailable = false`
- [ ] Deleted item removed from table
- [ ] SOLD OUT badge shows when available = 0
- [ ] Pagination works correctly
- [ ] Loading state displays correctly
- [ ] Error state displays correctly
- [ ] Empty state displays correctly
- [ ] API functions work correctly
