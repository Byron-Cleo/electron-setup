# Multi-Select Menu — Phase 3: Forms + Display

## Platform

frontend

## Status

Not Started

## Goals

- Replace `SearchableSelect` with `MultiSearchableSelect` in Store.tsx StockView form
- Replace `SearchableSelect` with `MultiSearchableSelect` in StockSupplyEditDialog
- Replace `SearchableSelect` with `MultiSearchableSelect` in StockSupplyForm
- Update `StockSupplyDetailDialog` to show multiple linked menus
- Update state from single `formMenuId: string | null` to `formMenuIds: string[]`

## Notes

- Each form has its own `formMenuId` / `menuId` state — all must change to `formMenuIds: string[]`
- The "Is Menu Item?" checkbox still gates visibility of the menu multi-select
- When `isMenuStock` is unchecked, clear `formMenuIds` to `[]`
- The SearchableSelect component is NOT deleted — it stays for other single-select uses

## Changes

### 1. `desktop/ui/pages/Store.tsx` — StockView

```typescript
// State change:
// BEFORE: const [formMenuId, setFormMenuId] = useState<string | null>(null)
// AFTER:
const [formMenuIds, setFormMenuIds] = useState<string[]>([])

// resetForm():
// BEFORE: setFormMenuId(null)
// AFTER:
setFormMenuIds([])

// In handleAddItem():
// BEFORE: menuId: formMenuId
// AFTER:
menuIds: formMenuIds

// In JSX:
// BEFORE: <SearchableSelect ... value={formMenuId} onChange={setFormMenuId} />
// AFTER:
<MultiSearchableSelect
  options={menus.map((m) => ({ value: m.id, label: m.name }))}
  value={formMenuIds}
  onChange={setFormMenuIds}
  placeholder="Select menu items"
  searchPlaceholder="Search menus..."
/>
```

### 2. `desktop/ui/components/admin/StockSupplyEditDialog.tsx`

```typescript
// Zod schema:
// BEFORE: menuId: z.string().optional()
// AFTER:
menuIds: z.array(z.string()).optional()

// Default values:
// BEFORE: menuId: undefined
// AFTER:
menuIds: []

// Load from supply:
// BEFORE: menuId: supply.menuId ?? undefined
// AFTER:
menuIds: supply.menus?.map((m) => m.id) ?? []

// Reset when isMenuStock unchecked:
// BEFORE: form.setValue("menuId", undefined)
// AFTER:
form.setValue("menuIds", [])

// In JSX:
// BEFORE: <SearchableSelect ... value={field.value ?? null} onChange={(val) => field.onChange(val ?? undefined)} />
// AFTER:
<MultiSearchableSelect
  options={menus.map((m) => ({ value: m.id, label: m.name }))}
  value={field.value ?? []}
  onChange={(val) => field.onChange(val)}
  placeholder="Select menu items"
  searchPlaceholder="Search menus..."
/>
```

### 3. `desktop/ui/pages/admin/StockSupplyForm.tsx`

Same pattern as StockSupplyEditDialog — change `menuId` to `menuIds: string[]` in schema, state, form, and JSX.

### 4. `desktop/ui/components/admin/StockSupplyDetailDialog.tsx`

```typescript
// Show multiple menus instead of single menu:
// BEFORE: supply.menu?.name
// AFTER:
supply.menus?.map((m) => m.name).join(", ") || "—"
```

## Verification

- Store → Add Stock Item: multi-select shows menu items, selecting multiple works
- Store → Edit Stock Item: multi-select pre-populated with existing menu links
- StockSupplyForm: multi-select works for create and edit modes
- StockSupplyDetailDialog: shows all linked menus as comma-separated list
- Unchecking "Is Menu Item?" clears the menu selection
- Form submission sends `menuIds` array to backend
