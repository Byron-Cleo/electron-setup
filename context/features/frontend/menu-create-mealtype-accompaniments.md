# Menu Create/Edit — Meal Type + Accompaniment Frontend

## Platform

frontend

## Status

Not Started

## Dependencies

- Backend spec: `context/features/backend/menu-create-mealtype-accompaniments.md` — must be implemented first (POST/PUT accept mealTypes, starchId, vegetableId)

## Goals

- Update `MenuCreateData` / `MenuUpdateData` types to include `mealTypes`, `starchId`, `vegetableId`
- Update `MenuForm.tsx` with:
  - Multi-select or checkbox group for meal types (BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE)
  - Single-select dropdown for starch accompaniment (filtered from accompaniments where `category === "STARCH"`)
  - Single-select dropdown for vegetable accompaniment (filtered from accompaniments where `category === "VEGETABLE"`)
- Update Zod schema to require at least one meal type and optionally accept starchId/vegetableId
- Fetch accompaniments and meal types on mount to populate dropdown options
- Handle edit mode — pre-populate meal types and accompaniment selections from fetched item data

## Notes

- Meal type options come from `GET /api/meal-types` → `MealType[]` with `{ id, name, sortOrder }`
- Accompaniment options come from `getAccompaniments()` → `Accompaniment[]` with `{ id, name, category }`
- Filter accompaniments into two groups: STARCH and VEGETABLE
- Each accompaniment dropdown should include a "None" option (empty value) as the first option
- When `starchId`/`vegetableId` is null or undefined in edit mode, the dropdown should show "None"
- The `MenuItem` type already has `mealTypes: string[]`, `starchId: string | null`, `vegetableId: string | null` — these are read and used for form reset in edit mode
- `api.ts` functions `createMenu()` and `updateMenu()` pass data through as-is — no changes needed there

## Changes

### 1. `desktop/ui/types/electron.d.ts` — Update MenuCreateData

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

### 2. `desktop/ui/components/MenuForm.tsx` — Full rewrite of form content

#### Imports to add

```typescript
import { useState, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { getAccompaniments } from "@/lib/api"
import { getMealTypes } from "@/lib/api" // add this function to api.ts
```

Or, if `getMealTypes` isn't in api.ts, add it:

```typescript
// In api.ts:
export async function getMealTypes(): Promise<MealType[]> {
  if (window.electron?.mealType?.getAll) {
    return window.electron.mealType.getAll()
  }
  return apiFetch("/meal-types")
}
```

#### State for dropdown options

```typescript
const [mealTypeOptions, setMealTypeOptions] = useState<MealType[]>([])
const [starchOptions, setStarchOptions] = useState<Accompaniment[]>([])
const [vegetableOptions, setVegetableOptions] = useState<Accompaniment[]>([])

useEffect(() => {
  async function load() {
    const [mealTypes, accs] = await Promise.all([getMealTypes(), getAccompaniments()])
    setMealTypeOptions(mealTypes)
    setStarchOptions(accs.filter((a) => a.category === "STARCH"))
    setVegetableOptions(accs.filter((a) => a.category === "VEGETABLE"))
  }
  load()
}, [])
```

#### Updated Zod Schema

```typescript
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  mealTypes: z.array(z.string()).min(1, "Select at least one meal period"),
  starchId: z.string().optional(),
  vegetableId: z.string().optional(),
})
```

#### Updated Form Reset (edit mode)

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

#### Updated Submit Payload

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

#### Meal Types UI (multi-select checkbox group)

```tsx
<FormField
  control={form.control}
  name="mealTypes"
  render={() => (
    <FormItem>
      <FormLabel>Meal Periods <span className="text-red-500 text-base font-bold">*</span></FormLabel>
      <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
        {mealTypeOptions
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((mt) => (
            <FormField
              key={mt.id}
              control={form.control}
              name="mealTypes"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value?.includes(mt.id)}
                      onCheckedChange={(checked) => {
                        const current = field.value ?? []
                        if (checked) {
                          field.onChange([...current, mt.id])
                        } else {
                          field.onChange(current.filter((v: string) => v !== mt.id))
                        }
                      }}
                    />
                  </FormControl>
                  <Label className="text-sm font-normal cursor-pointer">{mt.name}</Label>
                </FormItem>
              )}
            />
          ))}
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### Accompaniment Selects

```tsx
<div className="grid grid-cols-2 gap-4">
  <FormField
    control={form.control}
    name="starchId"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Starch Accompaniment</FormLabel>
        <Select onValueChange={field.onChange} value={field.value ?? ""}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select starch" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {starchOptions.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name="vegetableId"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Vegetable Accompaniment</FormLabel>
        <Select onValueChange={field.onChange} value={field.value ?? ""}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select vegetable" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {vegetableOptions.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
</div>
```

### 3. `desktop/ui/lib/api.ts` — Add getMealTypes (if not present)

```typescript
export async function getMealTypes(): Promise<MealType[]> {
  if (window.electron?.mealType?.getAll) {
    return window.electron.mealType.getAll()
  }
  return apiFetch("/meal-types")
}
```

## Verification

- Create a new menu with meal types "BREAKFAST" + "LUNCH", a starch, and a vegetable → saved, dialog closes, table refreshes with data
- Edit the same menu, change meal types to "DINNER", change accompaniments → saved, data reflects changes
- Edit without changing meal types or accompaniments → no regression
- Form validates: name, category, price required; at least one meal type required; accompaniments optional
- Menu detail dialog shows populated meal types, starch name, vegetable name
- Waiter POS `GET /api/menu?mealType=BREAKFAST` returns the newly created breakfast menu item
