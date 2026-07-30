# Menu Create/Edit — Meal Type Selection + Accompaniment Assignment

## Goal

Extend the menu create/edit flow so that when creating or editing a menu item, the user can:
1. Select one or more meal types (`MenuMealType` join table — `ServiceTime` enum values)
2. Assign a starch accompaniment and a vegetable accompaniment (`starchId` / `vegetableId` FK to `MenuAccompaniment`)

All in a single form, single request, single DB transaction.

---

## Problem

Currently `POST /api/menu` and `PUT /api/menu/:id` only accept `name`, `slug`, `category`, `stock`, `price`. The `MenuMealType` join table is never written to, and `starchId`/`vegetableId` are never set. The `MenuForm.tsx` form has no fields for meal types or accompaniments.

The `MenuItem` GET response already includes `mealTypes: string[]`, `starch`, `vegetable`, `starchId`, `vegetableId` — but these are read-only. The write path is incomplete.

---

## Approach

### Single Atomic Request with Transaction

One form → one `POST`/`PUT` → one `$transaction` that creates/updates the Menu row, its MenuMealType rows, and its accompaniment FKs atomically.

**Why a transaction:**
- If `MenuMealType.createMany` fails, the Menu row is rolled back — no orphan data
- If any step fails, nothing is committed
- On update, we `deleteMany` old meal types + `createMany` new ones in the same transaction — if the delete succeeds but create fails, the rollback restores the old meal types instead of leaving the menu with none

**Why not separate endpoints:**
- Meal types and accompaniments are intrinsic properties of a menu item, not separate sub-resources
- Separate endpoints = more network requests, potential for inconsistent state, and a more complex edit form with multiple save triggers

---

## Backend Changes

### `backend/routes/menu.ts`

#### 1. `POST /api/menu` — Accept `mealTypes`, `starchId`, `vegetableId`

```typescript
// Incoming body:
// { name, slug, category, stock, price, mealTypes: string[], starchId?: string, vegetableId?: string }

const result = await prisma.$transaction(async (tx) => {
  const menu = await tx.menu.create({
    data: {
      name, slug, category, stock, price,
      starchId: starchId || null,
      vegetableId: vegetableId || null,
    },
  })

  if (mealTypes?.length > 0) {
    await tx.menuMealType.createMany({
      data: mealTypes.map((mt: string) => ({
        menuId: menu.id,
        mealType: mt,
      })),
    })
  }

  return tx.menu.findUnique({
    where: { id: menu.id },
    include: {
      MenuMealType: { select: { mealType: true } },
      MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
      MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
    },
  })
})

// Return with same shape as GET /:id
res.status(201).json(serialize(result))
```

#### 2. `PUT /api/menu/:id` — Accept `mealTypes`, `starchId`, `vegetableId`

```typescript
// Transaction:
// 1. Update the menu row (name, slug, category, stock, price, starchId, vegetableId)
// 2. Delete all existing MenuMealType rows for this menu
// 3. Create new MenuMealType rows from the incoming array
// 4. Return the updated menu with includes

const result = await prisma.$transaction(async (tx) => {
  await tx.menu.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(category !== undefined && { category }),
      ...(stock !== undefined && { stock }),
      ...(price !== undefined && { price }),
      ...(starchId !== undefined && { starchId: starchId || null }),
      ...(vegetableId !== undefined && { vegetableId: vegetableId || null }),
    },
  })

  // Replace meal types — delete all + create new
  await tx.menuMealType.deleteMany({ where: { menuId: id } })

  if (mealTypes?.length > 0) {
    await tx.menuMealType.createMany({
      data: mealTypes.map((mt: string) => ({
        menuId: id,
        mealType: mt,
      })),
    })
  }

  return tx.menu.findUnique({
    where: { id },
    include: {
      MenuMealType: { select: { mealType: true } },
      MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
      MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
    },
  })
})
```

#### 3. Shared Validate + Serialize helpers

Extract a `serializeMenu()` helper to avoid duplicating the mapping logic across POST, PUT, and GET.

```typescript
function serializeMenu(item: any) {
  const {
    MenuMealType,
    MenuAccompaniment_Menu_starchIdToMenuAccompaniment: starchRel,
    MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: vegetableRel,
    ...menu
  } = item
  return {
    ...menu,
    mealTypes: MenuMealType.map((mt: any) => mt.mealType),
    starch: starchRel,
    vegetable: vegetableRel,
  }
}
```

#### 4. Validation

Validate `mealTypes` values against the `ServiceTime` enum:

```typescript
const VALID_MEAL_TYPES = Object.values(ServiceTime) as string[]

if (mealTypes) {
  if (!Array.isArray(mealTypes)) {
    return res.status(400).json({ error: "mealTypes must be an array" })
  }
  for (const mt of mealTypes) {
    if (!VALID_MEAL_TYPES.includes(mt)) {
      return res.status(400).json({ error: `Invalid mealType: ${mt}` })
    }
  }
}
```

---

## Frontend Changes

### `desktop/ui/types/electron.d.ts` — Update `MenuCreateData`

Add mealTypes, starchId, vegetableId:

```typescript
interface MenuCreateData {
  name: string
  slug?: string
  category: string
  stock?: number
  price: number
  mealTypes: string[]
  starchId?: string | null
  vegetableId?: string | null
}

type MenuUpdateData = Partial<MenuCreateData>
```

### `desktop/ui/components/MenuForm.tsx` — Add Meal Types + Accompaniments

#### Schema

```typescript
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  mealTypes: z.array(z.string()).min(1, "At least one meal type is required"),
  starchId: z.string().optional(),
  vegetableId: z.string().optional(),
})
```

#### State

- Fetch meal types via `GET /api/meal-types` → `MealType[]` (for the multi-select options)
- Fetch accompaniments via `getAccompaniments()` → filter by `STARCH` and `VEGETABLE`

#### UI Fields

1. **Meal Types** — Multi-select (checkbox group or shadcn multi-select):
   - Options from meal types endpoint: BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE
   - Shown as labeled checkboxes in a 2-column grid, or as a multi-select dropdown
   - Default: none selected (with validation requiring at least 1)
   - Label: "Meal Periods"

2. **Starch Accompaniment** — Single `<Select>`:
   - Options filtered from accompaniments where `category === "STARCH"`
   - First option "None" (value: empty string)
   - Label: "Starch Accompaniment"

3. **Vegetable Accompaniment** — Single `<Select>`:
   - Options filtered from accompaniments where `category === "VEGETABLE"`
   - First option "None" (value: empty string)
   - Label: "Vegetable Accompaniment"

#### Data Loading (edit mode)

```typescript
useEffect(() => {
  if (!editId) return
  getMenuById(editId).then((item) => {
    form.reset({
      name: item.name,
      category: item.category,
      price: Number(item.price),
      mealTypes: item.mealTypes ?? [],
      starchId: item.starchId ?? undefined,
      vegetableId: item.vegetableId ?? undefined,
    })
  })
}, [editId, form])
```

#### Submit Payload

```typescript
const payload = {
  name: data.name,
  slug: slugify(data.name),
  category: data.category,
  price: data.price,
  mealTypes: data.mealTypes,
  starchId: data.starchId || null,
  vegetableId: data.vegetableId || null,
}
```

---

## Files Changed

| File | Action |
|------|--------|
| `backend/routes/menu.ts` | Update POST, PUT with transaction, serialize helper, validation |
| `desktop/ui/types/electron.d.ts` | Update `MenuCreateData`, `MenuUpdateData` |
| `desktop/ui/components/MenuForm.tsx` | Add meal types multi-select, accompaniment selects, schema updates |
| `desktop/ui/lib/api.ts` | No changes needed (already passes data through) |
| `desktop/ui/components/menu/CreateMenuDialog.tsx` | No changes needed (wraps MenuForm) |
| `desktop/ui/components/menu/EditMenuDialog.tsx` | No changes needed (separate dialog for plate assignment) |

---

## No Schema/Migration Needed

- `MenuMealType` join table already exists
- `starchId` and `vegetableId` columns already exist on `Menu`
- `ServiceTime` enum already has all values

---

## Interaction with Existing Code

- `GET /api/menu?mealType=X` already filters by `MenuMealType.some(...)` — no change needed
- `GET /api/menu/cooked` for cooked menus — no change needed
- Waiter POS filtering by meal type — works unchanged once meal types are populated
- `AllMenuTable` and `MenuDetailDialog` already display `mealTypes`, `starch`, `vegetable` from API — they'll just show data that's now properly populated
