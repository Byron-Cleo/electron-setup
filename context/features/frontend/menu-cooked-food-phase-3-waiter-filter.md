# Menu Cooked Food Variants — Phase 3: Waiter Menu Filter

## Platform

frontend

## Status

Not Started

## Goals

- Ensure waiter menu query only returns `isAvailable = true` menus
- Hide sold-out or soft-deleted menus from waiter ordering screen

## Notes

- This phase depends on Phase 1 (backend `isAvailable` field must exist)
- Backend already handles the filter in GET `/api/menu?mealType=X`
- No frontend changes needed — backend filter is sufficient
- Verify waiter menu works correctly with the filter

## Backend Dependency

This phase uses the modified endpoint from Phase 1:
- `GET /api/menu?mealType=X` — now filters by `isAvailable = true`

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| desktop/ui/pages/waiterPos/WaiterMenu.tsx | Verify | Confirm waiter menu filters correctly |
| backend/routes/menu.ts | Already done | `isAvailable: true` filter in GET `/api/menu` |

---

## Tasks

### Task 1: Verify Backend Filter

1. Confirm `GET /api/menu?mealType=LUNCH` only returns menus with `isAvailable = true`
2. Test with a menu that has `isAvailable = false` — should not appear

### Task 2: Verify Waiter UI

1. Open waiter menu screen
2. Confirm menus with `isAvailable = false` are not displayed
3. Confirm sold-out menus (if `isAvailable` set to false) are hidden

---

## Testing Checklist

- [ ] GET `/api/menu?mealType=X` filters by `isAvailable = true`
- [ ] Menus with `isAvailable = false` not shown on waiter screen
- [ ] Waiter can still browse and order available menus
- [ ] No changes needed in WaiterMenu.tsx (backend handles filter)
