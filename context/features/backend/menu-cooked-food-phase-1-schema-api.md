# Menu Cooked Food Variants — Phase 1: Schema + Backend API

## Platform

backend

## Status

Not Started

## Goals

- Add `isAvailable` field to Menu model for soft-delete
- Create GET `/api/menu/cooked` endpoint for cooked menu items
- Create PUT `/api/menu/:id/availability` endpoint for soft-delete/restore
- Modify GET `/api/menu` to filter by `isAvailable = true` for waiter queries

## Notes

- `isAvailable = true` (default) → menu shown on waiter screen
- `isAvailable = false` → menu hidden from waiter screen (soft-deleted or sold out)
- Cooked menus = Menu items linked to StockSupply (`isMenuStock=true`) that has CookingRecord entries
- This phase must be completed before frontend phase

---

## Schema Changes

### Modify: Menu

Add `isAvailable` field to existing model:

```prisma
model Menu {
  // ... existing fields
  isAvailable    Boolean  @default(true)   // NEW: false = hidden from waiter screen
}
```

**Migration**: `npx prisma migrate dev --name add-menu-is-available`

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| backend/prisma/schema.prisma | Modify | Add `isAvailable` to Menu model |
| backend/routes/menu.ts | Modify | Add `/cooked` endpoint, `/availability` endpoint, filter by `isAvailable` |
| backend/app.ts | Modify | No changes needed (menu route already registered) |

---

## Tasks

### Task 1: Update Prisma Schema

1. Open `backend/prisma/schema.prisma`
2. Add `isAvailable Boolean @default(true)` to Menu model
3. Run `npx prisma migrate dev --name add-menu-is-available`

### Task 2: Create GET `/api/menu/cooked` Endpoint

1. Open `backend/routes/menu.ts`
2. Add new route `GET /cooked`
3. Query: Menu items linked to StockSupply (`isMenuStock=true`) that have at least one CookingRecord
4. Include cooking aggregates: totalProduced, totalAssigned, totalAvailable
5. Return array with menu details + stock supply info + cooking data

### Task 3: Create PUT `/api/menu/:id/availability` Endpoint

1. Open `backend/routes/menu.ts`
2. Add new route `PUT /:id/availability`
3. Accept `{ isAvailable: boolean }` in request body
4. Update the menu's `isAvailable` field
5. Return updated menu

### Task 4: Modify GET `/api/menu` Endpoint

1. Open `backend/routes/menu.ts`
2. When `mealType` query param is present (waiter query), add `isAvailable: true` to where clause
3. This ensures waiter screen only shows available menus

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/menu/cooked` | List menus whose StockSupply has CookingRecords |
| PUT | `/api/menu/:id/availability` | Set `isAvailable` flag (soft-delete/restore) |
| GET | `/api/menu?mealType=X` | Modified: filter by `isAvailable = true` |

### GET `/api/menu/cooked`

Response shape:

```json
[
  {
    "id": "uuid",
    "name": "Chicken Fry",
    "slug": "chicken-fry",
    "category": "Chicken",
    "price": 15000,
    "stock": 20,
    "isAvailable": true,
    "images": ["url1"],
    "stockSupply": {
      "id": "uuid",
      "name": "Chicken",
      "unit": "KG",
      "platesPerUnit": 4.5
    },
    "cooking": {
      "totalProduced": 45,
      "totalAssigned": 20,
      "totalAvailable": 25
    }
  }
]
```

### PUT `/api/menu/:id/availability`

Request: `{ "isAvailable": false }`

Response: Updated menu object

---

## Validation Rules

### Soft Delete
1. Only `isAvailable` is toggled — no record deletion
2. Menu with `isAvailable = false` is excluded from waiter queries
3. Menu can be restored by setting `isAvailable = true`

### Cooked Menu Query
1. Only menus linked to a StockSupply with `isMenuStock = true`
2. Only menus whose StockSupply has at least one CookingRecord
3. Aggregated cooking data calculated server-side

---

## Edge Cases

- **No cooking records**: Menu items without cooked StockSupply are not shown in `/cooked` endpoint
- **Multiple menus per stock**: One StockSupply can link to multiple Menu variants
- **Existing menus**: All existing menus get `isAvailable = true` by default (migration)

---

## Testing Checklist

- [ ] Schema migration applies cleanly
- [ ] Menu model has `isAvailable` field with default `true`
- [ ] GET `/api/menu/cooked` returns correct data
- [ ] GET `/api/menu/cooked` only returns menus with cooked StockSupply
- [ ] GET `/api/menu/cooked` includes cooking aggregates
- [ ] PUT `/api/menu/:id/availability` updates `isAvailable` flag
- [ ] PUT `/api/menu/:id/availability` returns updated menu
- [ ] GET `/api/menu?mealType=X` filters by `isAvailable = true`
- [ ] GET `/api/menu` (no mealType) returns all menus regardless of `isAvailable`
- [ ] Server starts without errors
