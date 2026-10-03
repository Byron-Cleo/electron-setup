# Kitchen Config Search & Edit Fix Plan

## Branch
`feature/admin/kitchen-config-search-dropdown`

## Problem
1. **Search missing**: the table had no way to find a stock item quickly
2. **Obsolete add-flow**: `GET /api/kitchen-config` already returns **every active stock supply**
   (`where: { isActive: true }`), so there is nothing to "add". The old **Add Configuration** button
   + stock-item dropdown only existed to pick an item out of a list that is *already* the table

## Solution
The table is now a direct view of stock supplies: search any row, then Edit its `platesPerUnit`.
The add-flow is removed entirely.

### 1. Search across the whole row
- `search` state filters `configItems`
- Matches **stock item name**, **unit**, or any linked **menu item name** (case-insensitive, trimmed)
- Empty search → full list; non-matching search → message naming the query
- `usePagination` clamps `currentPage` to `totalPages`, so paging self-corrects when the list shrinks

### 2. Edit-only dialog
- **Add Configuration** button, `openCreate()`, `unconfiguredSupplies`, `configuredIds`, and the
  `Select` dropdown are all deleted
- `getStockSupplies()` is no longer called — `getKitchenConfig()` is the single source for the table
- Dialog title is fixed to **Edit Configuration**; the stock item renders as read-only text
  (`name (unit)`) instead of a disabled select
- `handleSave()` saves against `editItem.id` and still validates `platesPerUnit > 0`

### 3. Status column
New **Status** column makes the real state visible without opening a dialog:
- **Configured** (`platesPerUnit > 0`) — green
- **Not set** (`null` / `0`) — amber

## Files Modified
| File | Changes |
|------|---------|
| `desktop/ui/components/admin/KitchenStockConfig.tsx` | Search (name/unit/menu); removed add-flow + stock select + `getStockSupplies`; edit-only dialog; Status column; empty-message + copy updates |

## No Backend Changes Required
- `GET /api/kitchen-config` already returns all active stock supplies with `platesPerUnit` + `menus`
- `PUT /api/kitchen-config/:id` already persists `platesPerUnit`
- No schema changes, no `isMenuStock` default changes

## Testing Checklist
- [x] Search filters by stock item name
- [x] Search also matches unit and menu item name
- [x] Search clears → full list restored
- [x] Pagination clamps correctly as the filtered list shrinks
- [x] Non-matching search shows the query in the empty message
- [x] Every listed item is editable directly (no add step)
- [x] Edit pre-fills the current `platesPerUnit`
- [x] Save validates `> 0` and persists via `PUT /api/kitchen-config/:id`
- [x] Status column reads Configured / Not set correctly
- [x] No backend rebuild required (frontend-only)

## Verification
- `npx tsc -b` → no errors in `KitchenStockConfig.tsx` (remaining errors are pre-existing in
  `desktop/ui/tests/` — the known `@testing-library/dom` gap)
- `npx eslint desktop/ui/components/admin/KitchenStockConfig.tsx` → 3 errors, byte-identical to HEAD
  (2× `no-explicit-any`, 1× `react-hooks/set-state-in-effect`) — no new violations

## Related
- `context/fix-plan/menu-stock-supply-link.md` — earlier `isMenuStock` filtering discussion
- `context/fix-plan/add-is-menu-stock-flag.md` — origin of the `isMenuStock` dropdown restriction