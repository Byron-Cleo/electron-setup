# Waiter Menu — Backend: Accompaniment Relation Includes & Type Fixes

> Supporting the frontend 4-column layout: Column 3 (Detail Panel) needs to display starch and vegetable accompaniment **names**, not just UUIDs.

## Architecture

### Data Flow

```
WaiterMenu (React) → window.electron.menu.getByMealType("LUNCH")
  → ipcMain.handle("menu:get-by-meal-type") → GET /api/menu?mealType=LUNCH
    → Express route → Prisma findMany
      → include: { MenuMealType, starch relation, vegetable relation }
        → Returns MenuItem[] with starch: { name, price } | null, vegetable: { name, price } | null
```

## Files Modified

| Layer | File | Change |
|---|---|---|
| Backend route | `backend/routes/menu.ts` | Add `include` for `MenuAccompaniment_Menu_starchIdToMenuAccompaniment` and `MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment` in the `GET /` query; map them as `starch` and `vegetable` in response |
| Frontend types | `desktop/ui/types/electron.d.ts` | Fix `accompanyId` → `starchId` to match Prisma schema; add `starch: { name: string; price: number } | null` and `vegetable: { name: string; price: number } | null` to `MenuItem` |
| IPC handlers | `desktop/electron/ipc-handlers.ts` | No change needed — already proxies `GET /menu?mealType=` generically |
| Preload | `desktop/electron/preload.cts` | No change needed — already exposes `menu.getByMealType()` |

## Current State (Backend `GET /` route)

```ts
// Current — only includes MenuMealType
const items = await prisma.menu.findMany({
  where,
  include: { MenuMealType: { select: { mealType: true } } },
  orderBy: { createdAt: "desc" },
});

const result = items.map(({ MenuMealType, ...menu }) => ({
  ...menu,
  mealTypes: MenuMealType.map((mt) => mt.mealType),
}));
```

## Required Changes

### 1. Backend Route — Add Accompaniment Includes

The Prisma relation field names (from schema.prisma:60-61):
- `MenuAccompaniment_Menu_starchIdToMenuAccompaniment` — links `starchId` → `MenuAccompaniment`
- `MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment` — links `vegetableId` → `MenuAccompaniment`

Add these to the `include` and map them in the response:

```ts
const items = await prisma.menu.findMany({
  where,
  include: {
    MenuMealType: { select: { mealType: true } },
    MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
    MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
  },
  orderBy: { createdAt: "desc" },
});

const result = items.map(({ 
  MenuMealType, 
  MenuAccompaniment_Menu_starchIdToMenuAccompaniment: starchRel, 
  MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: vegetableRel, 
  ...menu 
}) => ({
  ...menu,
  mealTypes: MenuMealType.map((mt) => mt.mealType),
  starch: starchRel,
  vegetable: vegetableRel,
}));
```

**Important:** The response must remain backward-compatible — existing fields (`id`, `name`, `slug`, `category`, `images`, `brand`, `description`, `stock`, `price`, `rating`, `numReviews`, `isFeatured`, `banner`, `createdAt`, `starchId`, `vegetableId`, `mealTypes`) are all preserved. `starch` and `vegetable` are **new optional fields**.

### 2. Frontend Types (`electron.d.ts`)

Fix `accompanyId` → `starchId` and add accompaniment object types:

```ts
interface MenuItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  images: string[];
  brand: string;
  description: string;
  stock: number;
  price: number;
  rating: number;
  numReviews: number;
  isFeatured: boolean;
  banner: string | null;
  createdAt: string;
  starchId: string | null;          // was accompanyId
  vegetableId: string | null;
  mealTypes: string[];
  starch: { name: string; price: number } | null;      // NEW
  vegetable: { name: string; price: number } | null;    // NEW
}
```

## Key Decisions

- **Field name fix**: `accompanyId` was inconsistent with Prisma's `starchId`. Renaming to `starchId` eliminates confusion and matches the actual database schema. This is a breaking change for any code referencing `accompanyId` — the only consumer is `WaiterMenu.tsx`, which will be fully refactored in the frontend phase.
- **Response shape**: The accompaniment objects are returned as `{ name, price }` rather than the full `MenuAccompaniment` record — only the name is needed for display in Column 3, and price may be needed for future feature. If more fields are needed later, the select can be expanded.
- **Null handling**: `starchId`/`vegetableId` are optional in the schema, so `starch` and `vegetable` will be `null` when no accompaniment is linked. The frontend handles this with conditional rendering (show "No starch" or hide the row).
- **No migration needed**: Only the Prisma query `include` and TypeScript types change — no schema or database changes.
