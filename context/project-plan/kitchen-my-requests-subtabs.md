# Kitchen My Requests — Sub-tabs by Status

## Overview
Enhance the Kitchen → Request Food → My Requests tab with 3 sub-tabs (Pending, Partial, Completed) that show filtered tables of stock requests grouped by status.

## Problem
Currently My Requests shows all requests in a flat expandable list with no filtering. Kitchen staff must manually scan through all requests to find pending ones or check on partial deliveries.

## Goal
- Add 3 sub-tabs: Pending, Partial, Completed
- Each tab shows a table of requests filtered to that status
- Kitchen staff can quickly see what's awaiting attention, what's partially delivered, and what's done
- Each table shows request date, items count, and expandable detail

---

## Current Implementation

**File:** `desktop/ui/pages/Kitchen.tsx` — `MyRequestsView` (lines 370-454)

- Fetches all stock requests, filters to `requestedById === userId`
- Shows flat list of expandable Cards with status badge + date + item count
- Expanded view shows items with delivered / requested quantities
- No sub-tabs, no filtering by status

---

## New Layout

### Sub-tabs

| Tab Key | Label | Icon | Filter |
|---|---|---|---|
| `"pending"` | Pending | `Clock` | `status === "PENDING"` |
| `"partial"` | Partial | `Package` | `status === "PARTIAL"` |
| `"completed"` | Completed | `CheckCircle` | `status === "COMPLETED"` |

Each tab shows a **count badge** like `Pending (3)`.

### Table Columns (same for all 3 tabs)

| Column | Key | Description |
|---|---|---|
| Date | `date` | Request date (dd MMM yyyy) |
| Items | `items` | Number of items in request |
| Notes | `notes` | Request notes (truncated, "—" if none) |
| Details | `details` | Expand/collapse button |

### Expanded Row
When a row is expanded, show the items breakdown:

| Item | Requested | Delivered | Unit |
|------|-----------|-----------|------|
| Rice | 5 | 3 | kg |
| Oil | 2 | 2 | litres |

- Delivered qty in **green** if complete, **orange** if partial

---

## Implementation Steps

### Step 1: Add sub-tab state
**File:** `desktop/ui/pages/Kitchen.tsx` — `MyRequestsView`

```ts
type MyRequestTab = "pending" | "partial" | "completed"
const [activeTab, setActiveTab] = useState<MyRequestTab>("pending")
```

### Step 2: Add tab definitions with counts
```ts
const tabs: { key: MyRequestTab; label: string; icon: typeof Clock }[] = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "partial", label: "Partial", icon: Package },
  { key: "completed", label: "Completed", icon: CheckCircle },
]

// Compute counts from requests
const tabCounts = {
  pending: requests.filter((r) => r.status === "PENDING").length,
  partial: requests.filter((r) => r.status === "PARTIAL").length,
  completed: requests.filter((r) => r.status === "COMPLETED").length,
}
```

### Step 3: Filter requests by active tab
```ts
const filteredRequests = requests.filter((r) => {
  switch (activeTab) {
    case "pending":   return r.status === "PENDING"
    case "partial":   return r.status === "PARTIAL"
    case "completed": return r.status === "COMPLETED"
  }
})
```

### Step 4: Render tab buttons
```tsx
<div className="flex items-center gap-2 border-b border-admin-card-border">
  {tabs.map(({ key, label, icon: Icon }) => (
    <button
      key={key}
      onClick={() => setActiveTab(key)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === key
          ? "border-b-2 border-admin-accent text-admin-accent"
          : "text-admin-muted hover:text-admin-header-text"
      }`}
    >
      <Icon size={16} />
      {label}
      <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-admin-content text-admin-muted">
        {tabCounts[key]}
      </span>
    </button>
  ))}
</div>
```

### Step 5: Replace Card list with DataTable
**File:** `desktop/ui/pages/Kitchen.tsx` — `MyRequestsView`

```ts
const columns: Column[] = [
  { label: "Date", key: "date" },
  { label: "Items", key: "items" },
  { label: "Notes", key: "notes" },
  { label: "Details", key: "details", isAction: true },
]
```

Render each cell:
```ts
function renderCell(request: StockRequest, column: Column) {
  switch (column.key) {
    case "date":
      return (
        <span className="text-sm">
          {new Date(request.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      )
    case "items":
      return (
        <span className="text-sm text-admin-muted">
          {request.items.length} item{request.items.length !== 1 ? "s" : ""}
        </span>
      )
    case "notes":
      return (
        <span className="text-sm text-admin-muted truncate max-w-[200px]">
          {request.notes || "—"}
        </span>
      )
    case "details":
      return (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
        >
          <Eye size={14} className="mr-1" />
          {expandedId === request.id ? "Hide" : "Details"}
        </Button>
      )
    default:
      return null
  }
}
```

### Step 6: Expandable row detail
When a row is expanded (via `expandedId`), show items breakdown below the table row. Each item shows its image.

```tsx
{expandedRequest && (
  <Card className="p-4 mt-2">
    <Heading as="h3" className="text-sm font-medium text-admin-header-text mb-3">
      Request Details — {new Date(expandedRequest.createdAt).toLocaleDateString("en-GB")}
    </Heading>
    <div className="space-y-2">
      {expandedRequest.notes && (
        <p className="text-sm text-admin-muted italic">{expandedRequest.notes}</p>
      )}
      <div className="grid grid-cols-5 text-xs font-medium text-admin-muted border-b pb-1">
        <span>Image</span>
        <span>Item</span>
        <span>Requested</span>
        <span>Delivered</span>
        <span>Unit</span>
      </div>
      {expandedRequest.items.map((item) => {
        const delivered = Number(item.quantityDelivered)
        const requested = Number(item.quantityRequested)
        const isComplete = delivered >= requested
        return (
          <div key={item.id} className="grid grid-cols-5 items-center text-sm py-1">
            {item.stockSupply.image ? (
              <img
                src={stockSupplyImageUrl(item.stockSupply.image) ?? ""}
                alt=""
                className="h-8 w-8 rounded object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded bg-admin-content flex items-center justify-center">
                <Package size={14} className="text-admin-header-text/30" />
              </div>
            )}
            <span>{item.stockSupply.name}</span>
            <span>{requested}</span>
            <span className={isComplete ? "text-green-600" : "text-orange-600"}>
              {delivered}
            </span>
            <span className="text-admin-muted">{item.stockSupply.unit}</span>
          </div>
        )
      })}
    </div>
  </Card>
)}
```

### Step 7: Empty state per tab
```tsx
{filteredRequests.length === 0 && (
  <div className="text-center py-8 text-admin-muted">
    No {activeTab} requests
  </div>
)}
```

---

## Files to Modify

| File | Action |
|---|---|
| `desktop/ui/pages/Kitchen.tsx` | Modify `MyRequestsView` — add sub-tabs, filter logic, DataTable, expandable detail |

**Total: 1 file modified**

---

## No Backend Changes Needed

All required data is already available:
- `GET /api/stock-requests` — returns all requests with items
- Frontend filters by status and user ID

---

## Verification

1. Run `npm run lint` — no errors
2. Run `npm run build` — type-check passes
3. Visual check: 3 sub-tabs render with count badges
4. Test scenarios:
   - Click Pending tab → only PENDING requests shown
   - Click Partial tab → only PARTIAL requests shown
   - Click Completed tab → only COMPLETED requests shown
   - Click Details button → expandable row shows items with requested/delivered breakdown
   - Empty tab → shows "No {status} requests" message
   - Tab counts update correctly
