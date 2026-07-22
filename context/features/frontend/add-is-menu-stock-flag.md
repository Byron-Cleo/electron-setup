# Add `isMenuStock` Flag — Frontend

## Platform

frontend

## Status

Not Started

## Goals

- Add `isMenuStock: boolean` to all StockSupply-related TypeScript interfaces
- Add `isMenuStock` toggle to StockSupply create/edit forms
- Replace all `platesPerUnit > 0` checks with `isMenuStock`
- Show `isMenuStock` status in StockSupply detail dialog

## Notes

- Depends on backend spec (schema must have `isMenuStock` field)
- `platesPerUnit` stays as a numeric field — no longer doubles as a flag
- KitchenStockConfig already configures `platesPerUnit` — no change needed there
- The `isMenuStock` toggle should appear in StockSupplyForm and StockSupplyEditDialog

## Tasks

### Task 1: Update TypeScript Types

1. Open `desktop/ui/types/electron.d.ts`
2. Add `isMenuStock: boolean` to `StockSupply` interface
3. Add `isMenuStock?: boolean` to `StockSupplyCreateData` interface
4. Add `isMenuStock?: boolean` to `StockSupplyUpdateData` interface
5. Add `isMenuStock: boolean` to `KitchenStockItem` interface
6. Add `isMenuStock: boolean` to `KitchenConfigItem` interface
7. Add `isMenuStock: boolean` to `KitchenInventory` interface

### Task 2: Update StockSupplyForm

1. Open `desktop/ui/pages/admin/StockSupplyForm.tsx`
2. Add `isMenuStock: z.boolean().default(false)` to form schema
3. Add `isMenuStock` to default values
4. Add a checkbox/toggle field in the form (after reorder level, before image)
5. Include `isMenuStock` in `onSubmit` data

### Task 3: Update StockSupplyEditDialog

1. Open `desktop/ui/components/admin/StockSupplyEditDialog.tsx`
2. Add `isMenuStock: z.boolean().default(false)` to form schema
3. Add `isMenuStock` to `form.reset()` in useEffect
4. Add a checkbox/toggle field in the dialog
5. Include `isMenuStock` in submit data

### Task 4: Update StockSupplyDetailDialog

1. Open `desktop/ui/components/admin/StockSupplyDetailDialog.tsx`
2. Add "Menu Stock" row showing `isMenuStock` status (Yes/No badge)

### Task 5: Update MenuForm Filter

1. Open `desktop/ui/components/MenuForm.tsx`
2. Change filter from `items.filter((s) => s.platesPerUnit && Number(s.platesPerUnit) > 0)` to `items.filter((s) => s.isMenuStock)`

### Task 6: Update Kitchen.tsx

1. Open `desktop/ui/pages/Kitchen.tsx`
2. Change Cook button disabled check from `!item.platesPerUnit` to `!item.isMenuStock`

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `desktop/ui/types/electron.d.ts` | Add `isMenuStock` to 6 interfaces |
| 2 | `desktop/ui/pages/admin/StockSupplyForm.tsx` | Add toggle field + schema |
| 3 | `desktop/ui/components/admin/StockSupplyEditDialog.tsx` | Add toggle field + schema |
| 4 | `desktop/ui/components/admin/StockSupplyDetailDialog.tsx` | Show status |
| 5 | `desktop/ui/components/MenuForm.tsx` | Filter by `isMenuStock` |
| 6 | `desktop/ui/pages/Kitchen.tsx` | Use `isMenuStock` for disabled check |

## Validation

1. `npx tsc --noEmit` passes
2. `npm run lint` passes (no new errors)
3. StockSupplyForm shows "Menu Stock" toggle
4. StockSupplyEditDialog shows "Menu Stock" toggle
5. StockSupplyDetailDialog shows "Menu Stock" status
6. MenuForm dropdown only shows `isMenuStock: true` items
7. Kitchen Cook button disabled when `isMenuStock: false`
