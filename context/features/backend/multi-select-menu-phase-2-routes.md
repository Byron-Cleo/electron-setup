# Multi-Select Menu — Phase 2: Routes + API

## Platform

backend

## Status

Not Started

## Goals

- Update `POST /api/stock-supplies` to accept `menuIds: string[]` and create junction rows
- Update `PUT /api/stock-supplies/:id` to accept `menuIds: string[]` and replace junction rows
- Update serialize function to return `menus: [{ id, name }]` from junction relation
- Remove `menuId` auto-update logic from cooking records route
- Update `GET /api/menu/cooked` query to join through junction table

## Notes

- `menuIds` is sent as a JSON string (like `departmentIds`) because the route uses `multipart/form-data` for image upload
- Parse with: `JSON.parse(menuIds)` — same pattern as `departmentIds`
- Empty array or omitted = no menu links
- The cooking records auto-update of `Menu.stock` (lines 177-183, 234-240 in cookingRecords.ts) must be REMOVED — plate allocation is handled by `CookingRecordAssignment`, not by stock supply links

## Changes

### 1. `backend/routes/items.ts` — Create endpoint (POST)

```typescript
// Destructure menuIds alongside other fields
const { ..., menuIds } = req.body;

// Parse menuIds (JSON string from FormData)
const parsedMenuIds = (() => {
  if (!menuIds) return [];
  try {
    const parsed = typeof menuIds === "string" ? JSON.parse(menuIds) : menuIds;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
})();

// In Prisma create:
const item = await prisma.stockSupply.create({
  data: {
    // ... existing fields ...
    ...(parsedMenuIds.length > 0 && {
      menus: {
        create: parsedMenuIds.map((id: string) => ({ menuId: id })),
      },
    }),
  },
  include: { menus: { include: { menu: { select: { id: true, name: true } } } } },
});
```

### 2. `backend/routes/items.ts` — Update endpoint (PUT)

```typescript
// Replace junction rows on update
await tx.stockSupplyMenu.deleteMany({ where: { stockSupplyId: id } });
if (parsedMenuIds.length > 0) {
  await tx.stockSupplyMenu.createMany({
    data: parsedMenuIds.map((menuId: string) => ({ stockSupplyId: id, menuId })),
  });
}
```

### 3. `backend/routes/items.ts` — Serialize function

Add to the serialized object:
```typescript
menus: item.menus?.map((sm) => ({ id: sm.menu.id, name: sm.menu.name })) ?? [],
```

### 4. `backend/routes/cookingRecords.ts`

- Remove the `menuId` auto-update blocks (create: lines 177-183, delete: lines 234-240)
- Update `include` clauses: replace `stockSupply: { select: { ..., menuId: true } }` with `stockSupply: { select: { ..., menus: { include: { menu: { select: { id: true, name: true } } } } } }`
- Remove `include: { menu: { select: { id: true, stock: true } } }` from the stock supply lookup (line 121)

### 5. `backend/routes/menu.ts` — Cooked query

Update the `GET /api/menu/cooked` endpoint:

```typescript
// Before: StockSupply.some({ isMenuStock: true, CookingRecord: { some: {} } })
// After: StockSupplyMenu.some({ stockSupply: { isMenuStock: true, CookingRecord: { some: {} } } })

const menus = await prisma.menu.findMany({
  where: {
    stockSupplyMenus: {
      some: {
        stockSupply: {
          isMenuStock: true,
          CookingRecord: { some: {} },
        },
      },
    },
  },
  include: {
    stockSupplyMenus: {
      where: { stockSupply: { isMenuStock: true } },
      include: {
        stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true } },
      },
    },
  },
  orderBy: { createdAt: "desc" },
});

// Update aggregation to use junction:
for (const menu of menus) {
  const stockSupplyIds = menu.stockSupplyMenus.map((sm) => sm.stockSupply.id);
  // ... rest of cooking records aggregation stays the same ...
}
```

## Verification

- `npx prisma generate` succeeds
- `npm run dev:backend` starts without errors
- POST/PUT `/api/stock-supplies` with `menuIds` creates/updates junction rows
- GET `/api/stock-supplies` returns `menus: [...]` array
- GET `/api/menu/cooked` returns menus with correct cooking aggregates via junction
- Cooking records CRUD no longer references `menuId`
