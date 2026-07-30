# Menu Create/Edit — Meal Type + Accompaniment Backend

## Platform

backend

## Status

Not Started

## Goals

- Update `POST /api/menu` to accept `mealTypes: string[]`, `starchId: string | null`, `vegetableId: string | null` and write them in a `$transaction`
- Update `PUT /api/menu/:id` to accept the same fields and replace `MenuMealType` rows (deleteMany + createMany) in a `$transaction`
- Validate `mealTypes` values against the `ServiceTime` enum
- Extract a `serializeMenu()` helper to avoid duplicating the response shape across GET, POST, PUT
- Ensure both endpoints return the full menu with `mealTypes`, `starch`, `vegetable` in the response

## Notes

- **Transaction pattern is mandatory** — use `prisma.$transaction(async (tx) => { ... })` to ensure atomicity:
  - POST: create menu row → createMany MenuMealType → return with includes
  - PUT: update menu row → deleteMany MenuMealType → createMany MenuMealType → return with includes
- `starchId` and `vegetableId` are nullable FKs — accept `null` explicitly, pass `null` to Prisma (not `undefined`)
- `mealTypes` is optional in the request body — when omitted, no MenuMealType rows are created/deleted
- `PUT` should fully replace meal types: delete all existing, then insert the new set
- The `existing GET /:id` already returns the correct shape — refactor it to use the same `serializeMenu()` helper
- No schema or migration changes needed — all columns and tables already exist
- Reference: `ServiceTime` enum values → `BREAKFAST`, `LUNCH`, `DINNER`, `DESSERT`, `BEVERAGE`

## Changes

### 1. `backend/routes/menu.ts` — Add serializeMenu helper

```typescript
function serializeMenu(menu: any) {
  const {
    MenuMealType,
    MenuAccompaniment_Menu_starchIdToMenuAccompaniment: starchRel,
    MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: vegetableRel,
    ...rest
  } = menu
  return {
    ...rest,
    mealTypes: MenuMealType.map((mt: any) => mt.mealType),
    starch: starchRel,
    vegetable: vegetableRel,
  }
}
```

### 2. `backend/routes/menu.ts` — Update POST

- Destructure `mealTypes`, `starchId`, `vegetableId` from `req.body`
- Validate `mealTypes` against `ServiceTime` enum
- Wrap in `$transaction`:
  - `tx.menu.create()` with basic fields + `starchId`, `vegetableId`
  - If `mealTypes.length > 0`: `tx.menuMealType.createMany()` mapping each to `{ menuId, mealType }`
  - `tx.menu.findUnique()` with includes → pass to `serializeMenu()`
- Return `res.status(201).json(serializeMenu(result))`

### 3. `backend/routes/menu.ts` — Update PUT

- Same destructure and validation as POST
- Wrap in `$transaction`:
  - `tx.menu.update()` with optional spread for each field (name, slug, category, stock, price, starchId, vegetableId)
  - `tx.menuMealType.deleteMany({ where: { menuId: id } })`
  - If `mealTypes.length > 0`: `tx.menuMealType.createMany()` with new mappings
  - `tx.menu.findUnique()` with includes → `serializeMenu()`
- Handle Prisma errors: `P2025` (not found), `P2002` (slug conflict)

### 4. `backend/routes/menu.ts` — Refactor GET /:id

- Replace inline mapping with `serializeMenu()` call

### 5. `backend/routes/menu.ts` — GET / list

- Already returns correct shape — no change needed (but verify consistency with serializeMenu)

## Verification

- `npm run dev:backend` starts without errors
- `POST /api/menu` with `mealTypes: ["BREAKFAST", "LUNCH"]`, `starchId: "some-uuid"`, `vegetableId: "some-uuid"` → 201 with mealTypes and accompaniments in response
- `POST /api/menu` without mealTypes → 201 with empty mealTypes array
- `POST /api/menu` with invalid mealType (e.g., "SNACK") → 400 error
- `PUT /api/menu/:id` changing mealTypes from `["BREAKFAST"]` to `["LUNCH", "DINNER"]` → correct replacement
- `PUT /api/menu/:id` setting `starchId: null` → starch cleared
- `GET /api/menu/:id` returns same shape as POST/PUT response
- `GET /api/menu?mealType=BREAKFAST` correctly filters by the new data
- `GET /api/menu/cooked` unchanged
