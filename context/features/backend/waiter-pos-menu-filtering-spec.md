# Waiter POS Menu Filtering by Meal Period — Backend Implementation Spec

> Full specification document for the menu filtering by serving time implementation phase.

---

## Architecture

### Data Flow

```
WaiterPOS → window.electron.menu.getByMealType(mealType) → ipcRenderer.invoke("menu:get-by-meal-type", mealType)
  → ipcMain.handle("menu:get-by-meal-type", ...) → GET /api/menu?mealType=<time>
    → Express route → Prisma → PostgreSQL
      → MenuMealType join filter → stock > 0 filter → return menus with mealTypes[]
```

### Route Structure

```
GET  /api/menu              → All menus (with mealTypes[] field)
GET  /api/menu?mealType=X   → Filtered menus (stock > 0, matching mealType)
GET  /api/menu/:id          → Single menu
POST /api/menu              → Create menu
PUT  /api/menu/:id          → Update menu
DELETE /api/menu/:id        → Delete menu
GET  /api/meal-types        → All ServiceTime enum values (fixed, not CRUD-manageable)
```

---

## Files Created/Modified

| Layer | File | Change |
|---|---|---|
| Database | `backend/prisma/schema.prisma` | Remove `MenuServiceTime` + `MenuServiceTimeType`; add `MenuMealType` (direct Menu→ServiceTime) |
| Migration | `backend/prisma/migrations/20260701130229_add_menu_meal_type/` | **Create** — migration SQL for new schema |
| Seed data | `backend/db/sample-data.ts` | Remove `mealTypes` array; `menuMealTypes` now uses `{ menuId, mealType: ServiceTime.LUNCH }` |
| Seed script | `backend/db/seed.ts` | Replace `menuServiceTime`/`menuServiceTimeType` with `menuMealType`; enable user seeding with PINs |
| Backend route | `backend/routes/menu.ts` | Modify `GET /` — accept `?mealType`, validate, filter by MenuMealType + stock > 0, return `mealTypes[]` |
| Backend route | `backend/routes/mealTypes.ts` | Replace `MenuServiceTime` CRUD with fixed ServiceTime enum response (enums no longer CRUD-manageable) |
| IPC handlers | `desktop/electron/ipc-handlers.ts` | Add `menu:get-by-meal-type` handler (proxies to `/menu?mealType=`) |
| Preload | `desktop/electron/preload.cts` | Expose `menu.getByMealType()` method |
| Types | `desktop/ui/types/electron.d.ts` | Add `mealTypes: string[]` to `MenuItem`; add `getByMealType` to `ElectronAPI.menu` |
| Spec | `context/current-feature.md` | Status → Not Started (reset for next feature); add history entry |

---

## Key Decisions

- **Direct model over join table**: `MenuMealType` replaces the legacy `MenuServiceTime` → `MenuServiceTimeType` triple-join with a direct composite-key model (`menuId`, `mealType`). This enables single-query filtering with Prisma's `{ some: { mealType } }` syntax
- **Stock filtering is business logic**: Not an API parameter. When `?mealType` is provided, `stock > 0` is applied automatically in the application layer. `GET /api/menu` (no filter) still returns all items regardless of stock for admin use
- **ServiceTime enum is fixed**: Meal types (BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE) are Prisma enums, not CRUD-manageable entities. The `/api/meal-types` endpoint was converted from DB-backed CRUD to static enum reflection
- **Response always includes `mealTypes[]`**: Even when no filter is applied, every menu response includes its associated meal types array for consistent frontend consumption
- **Backward compatibility preserved**: All existing CRUD endpoints (`GET /:id`, `POST`, `PUT`, `DELETE`) remain unchanged. The `GET /` response shape is extended (new field), not broken
- **Enum validation**: Invalid `mealType` values return 400 with the list of valid options
- **Prisma field name**: The relation field is `MenuMealType` (PascalCase) in schema and generated client — confirmed via tsc compilation
