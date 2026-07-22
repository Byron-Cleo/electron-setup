# Menu — Cooked Food Variants Plan

## Overview

Display all Menu items whose linked StockSupply has been cooked by the kitchen. Allow admin to view details, edit, and soft-delete (disable) menu variants. Soft-deleted or sold-out menus are hidden from the waiter ordering screen via `isAvailable` flag.

---

## Requirements (from discussion)

1. **Menu > Cooked Food tab** lists all `Menu` items whose linked `StockSupply` (`isMenuStock=true`) has `CookingRecord` entries (kitchen has cooked it)
2. **Table format** with columns: menu details (name, category, stock item, plates produced, etc.) + **Edit** and **Delete** action buttons
3. **Search/Filter**: Text input to search by menu name (e.g., "beef fry") — client-side filtering on fetched data
4. **Edit**: Update the menu variant's details (name, price, plates, etc.)
5. **Delete (Soft)**: Set `isAvailable = false` on the Menu record — record stays in DB but is hidden from waiter screen
6. **`isAvailable` field** on Menu model:
   - `true` (default) → menu is shown on waiter screen
   - `false` → menu is hidden from waiter screen
   - Auto-set to `false` when all plates are ordered (stock reaches 0)
   - Auto-set to `false` when admin clicks Delete
7. **Waiter menu query** updated to filter by `isAvailable = true`
8. **Reusable DataTable component** used for the table (with pagination)
9. **Backend endpoints** for update and soft-delete

---

## Data Flow

```
StockSupply (isMenuStock=true, platesPerUnit configured)
    │
    ▼  (kitchen cooks)
CookingRecord (platesActual recorded)
    │
    ▼  (admin views in Menu > Cooked Food)
Menu items linked to that StockSupply
    │
    ├── Edit → Update menu details (PUT /api/menu/:id)
    ├── Delete → Set isAvailable = false (PUT /api/menu/:id/availability)
    └── Sold out → Auto-set isAvailable = false
    │
    ▼  (waiter queries)
GET /api/menu?mealType=X → only isAvailable = true menus returned
```

---

## Implementation Phases

| Phase | Focus | Platform |
|-------|-------|----------|
| 1 | Schema: Add `isAvailable` to Menu model | backend |
| 2 | Backend: New API endpoints | backend |
| 3 | Frontend: CookedFoodTable with search, edit, delete | frontend |
| 4 | Frontend: Waiter menu filter by `isAvailable` | frontend |

---

## Phase 1 — Schema Change

### Add `isAvailable` to Menu model

```prisma
model Menu {
  // ... existing fields
  isAvailable    Boolean  @default(true)   // NEW: false = hidden from waiter screen
}
```

**Migration**: `npx prisma migrate dev --name add-menu-is-available`

---

## Phase 2 — Backend API Endpoints

### New/Modified Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/menu/cooked` | List menus whose StockSupply has CookingRecords |
| PUT | `/api/menu/:id` | Update menu details (existing — extend fields) |
| PUT | `/api/menu/:id/availability` | Soft-delete/restore (set `isAvailable`) |
| GET | `/api/menu?mealType=X` | Modified: add `isAvailable: true` filter |

### GET `/api/menu/cooked`

Returns all Menu items that are linked to a StockSupply (`isMenuStock=true`) which has at least one CookingRecord.

```typescript
// Response shape
{
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
    totalProduced: number    // sum of platesActual from CookingRecords
    totalAssigned: number    // sum of quantityPlates from CookingRecordAssignments
    totalAvailable: number   // produced - assigned
  }
}
```

### PUT `/api/menu/:id/availability`

Body: `{ isAvailable: boolean }`

Sets the `isAvailable` flag. Used for soft-delete (`false`) and restore (`true`).

### GET `/api/menu?mealType=X` (modified)

Add `isAvailable: true` to the where clause so waiter screen only shows available menus.

---

## Phase 3 — Frontend: CookedFoodTable

### Component: `desktop/ui/components/menu/CookedFoodTable.tsx`

**Replace** existing `CookedFoodTable` with new implementation.

### Features

1. **Search input**: Text field at the top to filter by menu name (client-side)
2. **DataTable**: Columns — Name, Category, Stock Item, Produced, Assigned, Available, Actions
3. **Edit button**: Opens edit dialog/modal to update menu details
4. **Delete button**: Soft-deletes (sets `isAvailable = false`) with confirmation dialog
5. **Pagination**: Use existing `usePagination` hook

### Table Columns

| Column | Key | Description |
|--------|-----|-------------|
| Name | `name` | Menu item name |
| Category | `category` | Menu category |
| Stock Item | `stockItem` | Linked StockSupply name |
| Plates Produced | `produced` | Total plates from CookingRecords |
| Assigned | `assigned` | Plates assigned to variants |
| Available | `available` | Produced - Assigned |
| Actions | `actions` | Edit + Delete buttons |

### Edit Modal

Fields to edit:
- Name
- Category
- Price
- Description
- Is Available toggle

### Delete Confirmation

"Are you sure you want to hide [menu name] from the waiter screen? You can restore it later."

---

## Phase 4 — Waiter Menu Filter

### Modify: `backend/routes/menu.ts`

Add `isAvailable: true` to the WHERE clause in the GET `/` endpoint:

```typescript
// When mealType is provided (waiter query)
where.isAvailable = true;
where.stock = { gt: 0 };
```

### Modify: `desktop/ui/pages/waiterPos/WaiterMenu.tsx`

No frontend changes needed — the backend filter handles it. The waiter already fetches from `/api/menu?mealType=X`.

---

## Files Summary

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `backend/prisma/schema.prisma` | 1 | Add `isAvailable` to Menu model |
| `backend/routes/menu.ts` | 2 | Add `/cooked` endpoint, `/availability` endpoint, filter by `isAvailable` |
| `desktop/ui/components/menu/CookedFoodTable.tsx` | 3 | Full rewrite — search, edit, delete |
| `desktop/ui/components/menu/AssignmentModal.tsx` | 3 | May need refresh integration |
| `desktop/ui/lib/api.ts` | 3 | Add `getCookedMenus()`, `updateMenuAvailability()` |
| `desktop/ui/types/electron.d.ts` | 3 | Add `CookedMenuItem` type |
| `desktop/ui/pages/admin/Menu.tsx` | 3 | Integrate new CookedFoodTable |

### Total: 7 files modified

---

## Validation Rules

### Soft Delete
1. Only `isAvailable` is toggled — no record deletion
2. Menu with `isAvailable = false` is excluded from waiter queries
3. Menu can be restored by setting `isAvailable = true`

### Edit
1. `name` is required
2. `price` must be >= 0
3. `slug` auto-generated from name if changed

### Cooked Menu Query
1. Only menus linked to a StockSupply with `isMenuStock = true`
2. Only menus whose StockSupply has at least one CookingRecord
3. Aggregated cooking data (produced/assigned/available) calculated server-side

---

## Edge Cases

- **No cooking records**: Menu items without cooked StockSupply are not shown in CookedFoodTable
- **Multiple menus per stock**: One StockSupply can link to multiple Menu variants
- **Sold out automatically**: When `available = 0`, frontend can show "SOLD OUT" badge and optionally auto-set `isAvailable = false`
- **Restore**: Admin can restore hidden menus by toggling `isAvailable` back to `true`

---

## Implementation Order

1. **Phase 1** — Schema change + migration
2. **Phase 2** — Backend endpoints
3. **Phase 3** — Frontend CookedFoodTable
4. **Phase 4** — Waiter filter

**Note:** Phases 3 and 4 can be done in parallel after Phase 2.
