# Menu-StockSupply Link — Phase 1: Backend Accept menuId

## Platform

backend

## Status

Not Started

## Goals

- Accept `menuId` in POST `/api/stock-supplies` create endpoint
- Accept `menuId` in PUT `/api/stock-supplies/:id` update endpoint
- Pass `menuId` to Prisma create/update (nullable field)
- No schema change needed — `menuId` already exists on StockSupply model

## Notes

- `menuId` is already defined in Prisma schema as `String? @db.Uuid` on StockSupply
- No migration needed — the field exists but is never populated
- This phase must be completed before frontend phase
- The `menuId` should be optional — not all stock supplies are menu ingredients

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| backend/routes/items.ts | Modify | Add `menuId` to POST and PUT destructuring, pass to Prisma |

---

## Tasks

### Task 1: Add menuId to POST Create

1. Open `backend/routes/items.ts`
2. Find POST `/` route (line 161)
3. Add `menuId` to destructuring: `const { name, slug, description, unit, currentStock, reorderLevel, isMenuStock, departmentIds, menuId } = req.body`
4. Add `menuId` to Prisma create data (only if provided and non-empty):
   ```typescript
   ...(menuId && { menuId }),
   ```

### Task 2: Add menuId to PUT Update

1. Open `backend/routes/items.ts`
2. Find PUT `/:id` route (line 211)
3. Add `menuId` to destructuring: `const { name, slug, description, unit, currentStock, reorderLevel, isActive, isMenuStock, departmentIds, menuId } = req.body`
4. Add `menuId` to Prisma update data:
   ```typescript
   ...(menuId !== undefined && { menuId: menuId || null }),
   ```
   - If `menuId` is provided and non-empty → set it
   - If `menuId` is empty string or null → set to null (unlink)

---

## API Changes

### POST `/api/stock-supplies`

Request body (新增):
```json
{
  "name": "Beef",
  "unit": "KG",
  "isMenuStock": true,
  "menuId": "uuid-of-menu-item",   // NEW: optional
  ...
}
```

### PUT `/api/stock-supplies/:id`

Request body (新增):
```json
{
  "name": "Beef",
  "menuId": "uuid-of-menu-item",   // NEW: optional, null to unlink
  ...
}
```

---

## Validation Rules

1. `menuId` is optional — omit or null means no menu link
2. If provided, must be a valid UUID (Prisma will reject invalid IDs)
3. Empty string `""` should be treated as null (unlink)
4. `menuId` is independent of `isMenuStock` — backend doesn't enforce the link

---

## Testing Checklist

- [ ] POST `/api/stock-supplies` with `menuId` saves correctly
- [ ] POST `/api/stock-supplies` without `menuId` saves with `menuId: null`
- [ ] PUT `/api/stock-supplies/:id` with `menuId` updates correctly
- [ ] PUT `/api/stock-supplies/:id` with `menuId: null` clears the link
- [ ] GET `/api/stock-supplies` returns `menuId` in response
- [ ] Server starts without errors
