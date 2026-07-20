# Kitchen My Requests — Sub-tabs by Status

## Platform
frontend

## Status
Not Started

## Goals
- Add 3 sub-tabs to My Requests: Pending, Partial, Completed
- Each tab shows a DataTable of requests filtered to that status
- Each tab shows count badge (e.g. "Pending (3)")
- Expandable detail row shows item image + requested vs delivered breakdown

## Notes
- Single file modification: `desktop/ui/pages/Kitchen.tsx` — `MyRequestsView` component
- No backend changes — all data already available via `getStockRequests()`
- Filter requests by `requestedById === userId` then by `status`
- Expanded detail shows: Image | Item | Requested | Delivered | Unit (5-column grid)
- Uses `stockSupplyImageUrl()` for item thumbnails
- Delivered qty in green if complete, orange if partial
- Branch: `feature/frontend/kitchen-my-requests-subtabs`

## Implementation Steps
1. Add `MyRequestTab` type and `activeTab` state (default: "pending")
2. Define tabs array with key, label, icon, and compute counts from requests
3. Filter requests by active tab status
4. Render tab buttons with count badges (same style as Request Food / Cooked Food tabs)
5. Replace Card list with DataTable — columns: Date, Items, Notes, Details
6. Add expandable detail section with 5-column grid (Image, Item, Requested, Delivered, Unit)
7. Add empty state per tab: "No {status} requests"
8. Run `npm run lint` and `npm run build` to verify

## Files to Modify
| File | Action |
|---|---|
| `desktop/ui/pages/Kitchen.tsx` | Modify `MyRequestsView` — add sub-tabs, filter logic, DataTable, expandable detail |

## History

(none yet)
