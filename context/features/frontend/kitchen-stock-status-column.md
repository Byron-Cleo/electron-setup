# Kitchen Current Stock — Status + Last Request Columns

## Platform
frontend

## Status
Not Started

## Goals
- Add stock availability status (Available / Not Available) in the Name column beside item name
- Add "Last Request" column showing last requested quantity + request status (Pending / Partial / Completed)
- Compute statuses from stock requests kitchen has made to the store
- No request exists → show stock status (Available/Not Available) in Name column
- Request exists → show qty + request status in Last Request column

## Notes
- Single file modification: `desktop/ui/pages/Kitchen.tsx` — `CurrentStockView` component
- No backend changes — all data already available via existing APIs
- Fetch `getStockRequests()` alongside `getStockSupplies()` on mount
- Build `Map<stockSupplyId, StockRequestItem>` for most recent request per item
- Badge colors: Available (green), Not Available (red), Pending (yellow), Partial (orange), Completed (green)
- Branch: `feature/frontend/kitchen-stock-status-column`

## Implementation Steps
1. Add `StockRequest[]` state and fetch on mount with `Promise.all`
2. Build `getLastRequestMap()` — sort requests by createdAt DESC, map stockSupplyId → most recent StockRequestItem
3. Add `computeStockStatus()` and `computeRequestStatus()` functions
4. Add `stockStatusClasses` and `requestStatusClasses` badge style maps
5. Update Name column render — show stock status badge when no request exists
6. Add "Last Request" column definition and render case
7. Run `npm run lint` and `npm run build` to verify

## Files to Modify
| File | Action |
|---|---|
| `desktop/ui/pages/Kitchen.tsx` | Modify `CurrentStockView` — add requests fetch, status logic, Name update, Last Request column |

## History

(none yet)
