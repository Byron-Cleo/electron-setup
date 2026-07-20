# Reusable Stock Requests Design

## Platform
frontend

## Status
Not Started

## Goals
- Create a shared `RequestStockDesign` component in `components/shared/`
- Store uses it with department column + fulfill action
- Kitchen uses it with department filter + no action (read-only)
- Eliminate duplicated table design code

## Notes
- Component location: `desktop/ui/components/shared/RequestStockDesign.tsx`
- Props: `department`, `showDepartmentColumn`, `showActionColumn`, `onRequestFulfilled`
- Columns: image, name, requested, delivered, status, (department), requestedBy, (action)
- Delivered text color matches status badge color
- Fulfill button uses ShoppingBasket icon with green styling
- Status tabs: ALL / PENDING / PARTIAL / COMPLETED with counts
- Branch: `feature/frontend/reusable-stock-requests-design`

## Implementation Steps
1. Create `desktop/ui/components/shared/RequestStockDesign.tsx`
2. Move `STATUS_CONFIG`, `STATUS_TEXT_COLOR`, `COLUMNS` logic from `StockRequestsList`
3. Accept props for department filter, column visibility, action callback
4. Refactor `StockRequestsList.tsx` to import and use `RequestStockDesign`
5. Replace `MyRequestsView` in `Kitchen.tsx` with `RequestStockDesign`
6. Run `tsc --noEmit` and `npm run lint` to verify

## Files to Create
| File | Action |
|---|---|
| `desktop/ui/components/shared/RequestStockDesign.tsx` | Create |

## Files to Modify
| File | Action |
|---|---|
| `desktop/ui/components/store/StockRequestsList.tsx` | Refactor to use RequestStockDesign |
| `desktop/ui/pages/Kitchen.tsx` | Replace MyRequestsView with RequestStockDesign |

## History

(none yet)
