# Reusable Stock Requests Design

## Overview
Extract the stock requests table from `StockRequestsList` into a shared `RequestStockDesign` component that can be reused in both Store (in-house requests) and Kitchen (my requests) with configurable columns and filtering.

## Goals
- Single source of truth for stock request table design
- Store shows department column, Kitchen hides it
- Kitchen filters by department="kitchen", Store shows all
- Same status tabs, badge styles, and action button styling
- Reduces code duplication between Store and Kitchen

## Component Design

### File Location
`desktop/ui/components/shared/RequestStockDesign.tsx`

### Props Interface
```tsx
interface RequestStockDesignProps {
  /** Filter requests by department. If undefined, shows all departments */
  department?: string
  /** Show the Department column. Default: true */
  showDepartmentColumn?: boolean
  /** Show the Action column (Fulfill button). Default: true */
  showActionColumn?: boolean
  /** Callback when a request is fulfilled */
  onRequestFulfilled?: () => void
}
```

### Columns
| # | Key | Label | Always shown | Notes |
|---|-----|-------|-------------|-------|
| 1 | image | Image | Yes | Product thumbnail |
| 2 | name | Name | Yes | Stock supply name |
| 3 | requested | Requested | Yes | Quantity requested |
| 4 | delivered | Delivered | Yes | Color matches status |
| 5 | status | Request Status | Yes | Badge pill |
| 6 | department | Department | Configurable | Hidden when `showDepartmentColumn=false` |
| 7 | requestedBy | Requested By | Yes | Who made the request |
| 8 | action | Action | Configurable | Fulfill button, hidden when `showActionColumn=false` |

### Status Tabs
- 4 tabs: ALL / PENDING / PARTIAL / COMPLETED
- Count badges per tab
- Same design as current StockRequestsList

### Status Badge Colors (CSS variables)
- Pending: `bg-status-pending-bg text-status-pending-text`
- Partial: `bg-status-partial-bg text-status-partial-text`
- Completed: `bg-status-completed-bg text-status-completed-text`

### Delivered Column Colors
- Uses `STATUS_TEXT_COLOR` map matching status badge text colors
- Pending: `text-yellow-500`
- Partial: `text-status-partial-text`
- Completed: `text-status-completed-text`

### Action Button
- Fulfill button with `ShoppingBasket` icon
- Green styling: `bg-green-100 text-green-700 hover:bg-green-200 border-green-200`
- Hidden when request status is COMPLETED
- Opens `FulfillItemDialog`

### Data Flow
1. Fetch all requests via `getStockRequests()`
2. Filter by `department` prop if provided
3. Flatten to `{ item: StockRequestItem, request: StockRequest }` rows
4. Filter by active status tab
5. Paginate via `usePagination`

## Files to Create
| File | Action |
|---|---|
| `desktop/ui/components/shared/RequestStockDesign.tsx` | Create reusable component |

## Files to Modify
| File | Action |
|---|---|
| `desktop/ui/components/store/StockRequestsList.tsx` | Refactor to use `RequestStockDesign` |
| `desktop/ui/pages/Kitchen.tsx` | Replace `MyRequestsView` with `RequestStockDesign` |

## Usage Examples

### Store (In-House Requests)
```tsx
<RequestStockDesign
  showDepartmentColumn={true}
  showActionColumn={true}
  onRequestFulfilled={loadData}
/>
```

### Kitchen (My Requests)
```tsx
<RequestStockDesign
  department="kitchen"
  showDepartmentColumn={false}
  showActionColumn={false}
/>
```

## Verification
- Store table shows all columns including Department
- Kitchen table hides Department column
- Kitchen only shows kitchen department requests
- Status tabs work with correct counts
- Fulfill button works in Store
- Fulfill button hidden in Kitchen (read-only)
- Delivered text colors match status badge colors
- No visual regressions in either view
