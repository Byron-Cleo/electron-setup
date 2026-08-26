# Menu Category Management

## Platform

fullstack

## Goals

- Add a `Category` model to the database so menu categories are no longer hardcoded
- Provide a CRUD management card in the Settings page for admin/manager to add, edit, and delete categories
- Seed the database with the exact categories currently hardcoded in the frontend + "Staff"
- Update Menu create/edit forms to fetch categories from the API instead of using the hardcoded `CATEGORIES` array
- Remove the hardcoded `CATEGORIES` constant from `MenuForm.tsx`

## Current Hardcoded Categories (to seed)

```
Beef, Chicken, Vegetable, Drinks, Beverages, Starch, Fish, 1/2 Fish, Liver, Matumbo, Snacks
```

Plus new category: **Staff**

## Phases

### Phase 1 — Prisma Schema + Migration

- Add `Category` model to `backend/prisma/schema.prisma`:
  - `id` UUID (default gen_random_uuid)
  - `name` String (unique)
  - `createdAt` DateTime
  - `updatedAt` DateTime
- Run `npx prisma db push` to apply
- Regenerate Prisma client

### Phase 2 — Backend API Routes

- Create `backend/routes/categories.ts` with CRUD:
  - `GET /api/categories` — list all, ordered by name
  - `POST /api/categories` — create (validate unique name → 409)
  - `PUT /api/categories/:id` — update (validate unique name → 409)
  - `DELETE /api/categories/:id` — delete
- Mount in `backend/app.ts` at `/api/categories`
- Follow existing pattern from `departments.ts`

### Phase 3 — Seed Script

- Update `backend/db/seed.ts` to seed categories:
  - Seed the 11 hardcoded categories + "Staff" (12 total)
  - Wipe existing categories first (`prisma.category.deleteMany()`)
  - Run after departments seed

### Phase 4 — Frontend API Layer

- Add to `desktop/ui/lib/api.ts`:
  - `getCategories()` — GET /api/categories
  - `createCategory(data)` — POST /api/categories
  - `updateCategory(id, data)` — PUT /api/categories/:id
  - `deleteCategory(id)` — DELETE /api/categories/:id
- Add types to `desktop/ui/types/electron.d.ts`:
  - `Category` interface (id, name, createdAt, updatedAt)
  - `CreateCategoryData`, `UpdateCategoryData` types

### Phase 5 — Category Manager in Settings

- Create `desktop/ui/components/admin/CategoryManager.tsx` following `DepartmentManager.tsx` pattern:
  - DataTable with search + pagination
  - Add/Edit dialog (name input)
  - Delete confirm dialog
- Register in `desktop/ui/pages/admin/Manager.tsx`:
  - New card: "Menu Categories" with Tag icon
  - View: `"categories"`
  - `adminOnly: false` (manager can access)

### Phase 6 — Update MenuForm

- In `desktop/ui/components/MenuForm.tsx`:
  - Remove `CATEGORIES` constant
  - Fetch categories via `getCategories()` on mount
  - Render `<SelectItem>` from fetched categories
- Remove any other references to hardcoded categories if found

### Phase 7 — Verification

- `npx prisma db push` succeeds
- Backend `tsc --noEmit` clean
- Root `tsc --noEmit` clean
- `npm run lint` clean
- Seed populates all 12 categories
- Settings → Menu Categories card shows categories
- Add/edit/delete categories works
- Menu create/edit form shows dynamic categories from DB
- "Staff" category appears in the dropdown

## Notes

- Menu.category remains a `String` field (not a FK) — categories are a flat list for dropdown population, not a relational constraint. This keeps it simple and avoids a migration on the Menu table.
- The existing `Menu.category` column stores the category name as a string, so no FK migration is needed.
- The seed should be idempotent (deleteMany before createMany).
