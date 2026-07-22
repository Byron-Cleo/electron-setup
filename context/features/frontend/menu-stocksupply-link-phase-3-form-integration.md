# Menu-StockSupply Link — Phase 3: Integrate SearchableSelect into StockSupply Forms

## Platform

frontend

## Status

Not Started

## Goals

- Add `menuId` to frontend types and API functions
- Add `menuId` field to `StockSupplyForm.tsx` with SearchableSelect
- Add `menuId` field to `StockSupplyEditDialog.tsx` with SearchableSelect
- Add `menuId` field to `Store.tsx` Add Stock Item modal with SearchableSelect
- SearchableSelect only visible when `isMenuStock` checkbox is checked

## Notes

- This phase depends on Phase 1 (backend accepts menuId) and Phase 2 (SearchableSelect component)
- Menu items are fetched via `getMenus()` from `lib/api.ts`
- Options display menu item name only (e.g. "Beef Fry")
- `menuId` is optional — clearing the selection sets it to null

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/types/electron.d.ts | Modify | Add `menuId` to `StockSupplyCreateData` and `StockSupplyUpdateData` |
| desktop/ui/lib/api.ts | Modify | Pass `menuId` in `createStockSupply()` and `updateStockSupply()` |
| desktop/ui/pages/admin/StockSupplyForm.tsx | Modify | Add `menuId` field with SearchableSelect |
| desktop/ui/components/admin/StockSupplyEditDialog.tsx | Modify | Add `menuId` field with SearchableSelect |
| desktop/ui/pages/Store.tsx | Modify | Add `menuId` field to Add Stock Item modal |

---

## Tasks

### Task 1: Add menuId to Types

1. Open `desktop/ui/types/electron.d.ts`
2. Add `menuId?: string | null` to `StockSupplyCreateData` (after `isMenuStock`)
3. Add `menuId?: string | null` to `StockSupplyUpdateData` (after `isMenuStock`)

### Task 2: Update API Functions

1. Open `desktop/ui/lib/api.ts`
2. `createStockSupply()` — `menuId` is already passed through since it spreads `data` keys
3. `updateStockSupply()` — same, `menuId` will pass through automatically
4. Verify both functions handle `menuId: null` correctly (don't filter it out)

### Task 3: Add menuId to StockSupplyForm

1. Open `desktop/ui/pages/admin/StockSupplyForm.tsx`
2. Add `menuId: z.string().optional()` to `formSchema`
3. Add `menuId: undefined` to `defaultValues`
4. Fetch menus on mount: `getMenus()` → store in state
5. Add SearchableSelect **below the isMenuStock checkbox**, visible only when `isMenuStock` is true
6. Use `useWatch` to watch `isMenuStock` value for conditional rendering
7. Pass `menuId` to `createStockSupply()` / `updateStockSupply()`
8. In edit mode, pre-populate `menuId` from fetched supply data

### Task 4: Add menuId to StockSupplyEditDialog

1. Open `desktop/ui/components/admin/StockSupplyEditDialog.tsx`
2. Add `menuId: z.string().optional()` to the zod schema
3. Fetch menus on mount
4. Add SearchableSelect below isMenuStock checkbox, visible only when `isMenuStock` is true
5. Pre-populate with existing `menuId` when editing
6. Pass `menuId` in update payload

### Task 5: Add menuId to Store.tsx Add Modal

1. Open `desktop/ui/pages/Store.tsx`
2. Add `formMenuId` state: `useState<string | null>(null)`
3. Fetch menus on mount (or when `formIsMenuStock` becomes true)
4. Add SearchableSelect below isMenuStock toggle, visible only when `formIsMenuStock` is true
5. Pass `menuId: formMenuId` to `createStockSupply()`
6. Reset `formMenuId` when modal closes

---

## Conditional Rendering Pattern

All three forms use the same pattern:

```tsx
{isMenuStock && (
  <FormField
    control={form.control}
    name="menuId"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Menu Item</FormLabel>
        <FormControl>
          <SearchableSelect
            options={menuOptions}
            value={field.value ?? null}
            onChange={field.onChange}
            placeholder="Select menu item"
            searchPlaceholder="Search menus..."
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)}
```

---

## State Flow

```
User checks "Is Menu Item?" → SearchableSelect appears
  → User types "chicken" → dropdown filters to "Chicken Fry", "Chicken Stew"
  → User clicks "Chicken Fry" → field value = menu ID for Chicken Fry
  → Form submits with menuId = that ID
  → Backend saves menuId on StockSupply record
```

---

## Edge Cases

- **Unchecking isMenuStock**: Should clear `menuId` (set to null)
- **Edit mode**: Pre-populate with existing `menuId`, show correct menu name
- **Menu fetch fails**: Show error or empty dropdown gracefully
- **No menu items exist**: Show empty state "No menu items available"
- **Clearing selection**: X button on SearchableSelect sets `menuId` to null

---

## Testing Checklist

- [ ] Types include `menuId` in create/update data
- [ ] API functions pass `menuId` to backend
- [ ] StockSupplyForm shows SearchableSelect when isMenuStock checked
- [ ] StockSupplyForm hides SearchableSelect when isMenuStock unchecked
- [ ] StockSupplyForm clears menuId when isMenuStock unchecked
- [ ] StockSupplyForm fetches menus and populates dropdown
- [ ] StockSupplyForm saves menuId on submit
- [ ] StockSupplyEditDialog shows SearchableSelect when isMenuStock checked
- [ ] StockSupplyEditDialog pre-populates with existing menuId
- [ ] StockSupplyEditDialog saves menuId on update
- [ ] Store.tsx Add modal shows SearchableSelect when isMenuStock checked
- [ ] Store.tsx Add modal passes menuId to createStockSupply
- [ ] Store.tsx Add modal resets menuId when modal closes
- [ ] SearchableSelect filters menus as user types
- [ ] SearchableSelect clears selection with X button
- [ ] `tsc --noEmit` passes
- [ ] `npm run lint` passes
