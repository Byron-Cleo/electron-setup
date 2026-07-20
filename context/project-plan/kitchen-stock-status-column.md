# Kitchen Current Stock — Status + Last Request Columns

## Overview
Enhance the Kitchen → Request Food → Current Stock table with two pieces of information:
1. **Stock status** (Available / Not Available) — shown in the Name column beside the item name
2. **Last Request** — a new column showing the last requested quantity + request status (Pending / Partial / Completed)

This gives kitchen staff a quick glance at what's available in the store and the state of any requests they've made.

## Problem
Kitchen staff currently see stock levels but have no visibility into whether they've already requested an item, how much they requested, or if a request is being processed. They must check "My Requests" tab separately.

## Goal
- Show stock availability status (Available / Not Available) in the Name column
- Add "Last Request" column showing requested qty + request status
- Kitchen staff can immediately see what's available and what they've requested
- Detailed requested vs delivered breakdown stays in the "My Requests" tab

---

## Two Separate Concepts

| Concept | Statuses | Where Shown | Meaning |
|---|---|---|---|
| **Stock Status** | Available, Not Available | Name column | Is there stock in the store to request? |
| **Request Status** | Pending, Partial, Completed | Last Request column | What's the state of my last request? |

---

## Status Logic

### Stock Status (Name Column)
Shown when **no request exists** for that item.

| Status | Condition | Badge Color |
|---|---|---|
| `Available` | `currentStock > 0` | Green |
| `Not Available` | `currentStock <= 0` | Red |

### Request Status (Last Request Column)
Shown when **a request exists** for that item.

| Status | Condition | Badge Color |
|---|---|---|
| `Pending` | Request made, nothing delivered yet | Yellow |
| `Partial` | Some but not all delivered | Orange |
| `Completed` | Fully delivered | Green |

### Decision Flow

```
For each StockSupply item:
  1. Find most recent StockRequestItem where stockSupplyId matches
     AND stockRequest.department === "kitchen"
     (order by stockRequest.createdAt DESC, take first)

  2. If no request found → Stock Status (Name column):
       → currentStock > 0: "Available" (green)
       → currentStock <= 0: "Not Available" (red)

  3. If request found → Request Status (Last Request column):
       → status === "PENDING":   "Pending" (yellow)
       → status === "PARTIAL":  "Partial" (orange)
       → status === "COMPLETED": "Completed" (green)
```

---

## Table Layout

### Current Columns
| Details | Image | Name | Stock | Actions |

### New Columns
| Details | Image | Name | Stock | Last Request | Actions |

### Visual — No Request Yet
| Details | Image | Name | Stock | Last Request | Actions |
|---------|-------|------|-------|-------------|---------|
| Details | 🖼️ | Rice · `Available` | 50 kg | — | Request |
| Details | 🖼️ | Oil · `Not Available` | 0 litres | — | Request |

- Name shows item name + stock status badge
- Last Request shows "—" (no request made)

### Visual — Request Made
| Details | Image | Name | Stock | Last Request | Actions |
|---------|-------|------|-------|-------------|---------|
| Details | 🖼️ | Rice | 50 kg | 5 kg · `Pending` | Request |
| Details | 🖼️ | Oil | 10 litres | 3 litres · `Partial` | Request |
| Details | 🖼️ | Sugar | 20 kg | 10 kg · `Completed` | Request |

- Name shows item name only (no stock status badge)
- Last Request shows quantity + request status badge

---

## Badge Colors

| Status | Tailwind Classes |
|---|---|
| Available | `bg-green-100 text-green-700` |
| Not Available | `bg-red-100 text-red-700` |
| Pending | `bg-yellow-100 text-yellow-700` |
| Partial | `bg-orange-100 text-orange-700` |
| Completed | `bg-green-100 text-green-700` |

---

## Data Requirements

### What's Already Available
- `StockSupply[]` — fetched via `getStockSupplies()` (already loaded in `CurrentStockView`)
- `StockRequest[]` — fetched via `getStockRequests()` (already exists in `lib/api.ts`)
- `StockRequestItem` — nested inside `StockRequest.items[]`

### What Needs to Change
- `CurrentStockView` needs to **also fetch stock requests** on mount
- Build a lookup map: `stockSupplyId → most recent StockRequestItem`
- Compute stock status and request status for each row

---

## Implementation Steps

### Step 1: Update `CurrentStockView` data fetching
**File:** `desktop/ui/pages/Kitchen.tsx` — `CurrentStockView` component

- Add `StockRequest` state: `const [requests, setRequests] = useState<StockRequest[]>([])`
- Fetch requests on mount alongside stock supplies:
  ```ts
  const [stockData, requestData] = await Promise.all([
    getStockSupplies(),
    getStockRequests(),
  ])
  ```
- Build a `Map<string, StockRequestItem>` — for each stock supply, find the most recent request item:
  ```ts
  function getLastRequestMap(requests: StockRequest[]): Map<string, StockRequestItem> {
    const map = new Map<string, StockRequestItem>()
    const sorted = [...requests].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    for (const req of sorted) {
      for (const item of req.items) {
        if (!map.has(item.stockSupplyId)) {
          map.set(item.stockSupplyId, item)
        }
      }
    }
    return map
  }
  ```

### Step 2: Add status computation functions
**File:** `desktop/ui/pages/Kitchen.tsx`

```ts
type StockDisplayStatus = "Available" | "Not Available"
type RequestDisplayStatus = "Pending" | "Partial" | "Completed"

function computeStockStatus(stock: StockSupply): StockDisplayStatus {
  return stock.currentStock > 0 ? "Available" : "Not Available"
}

function computeRequestStatus(
  lastRequest: StockRequest | undefined
): RequestDisplayStatus | null {
  if (!lastRequest) return null
  switch (lastRequest.status) {
    case "PENDING":   return "Pending"
    case "PARTIAL":   return "Partial"
    case "COMPLETED": return "Completed"
    default:          return null
  }
}
```

### Step 3: Add Last Request column to table
**File:** `desktop/ui/pages/Kitchen.tsx` — `CurrentStockView`

Add column definition:
```ts
{ label: "Last Request", key: "lastRequest" }
```

### Step 4: Update Name column render
**File:** `desktop/ui/pages/Kitchen.tsx` — `CurrentStockView`

Update the `name` case to show stock status when no request exists:
```ts
case "name": {
  const lastItem = lastRequestMap.get(item.id)
  const lastReq = lastItem
    ? requests.find(r => r.id === lastItem.stockRequestId)
    : undefined
  const reqStatus = computeRequestStatus(lastReq)
  const stockStatus = computeStockStatus(item)
  return (
    <div className="flex items-center gap-2">
      <span>{item.name}</span>
      {!reqStatus && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          stockStatus === "Available"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}>
          {stockStatus}
        </span>
      )}
    </div>
  )
}
```

### Step 5: Add Last Request column render
**File:** `desktop/ui/pages/Kitchen.tsx` — `CurrentStockView`

```ts
case "lastRequest": {
  const lastItem = lastRequestMap.get(item.id)
  const lastReq = lastItem
    ? requests.find(r => r.id === lastItem.stockRequestId)
    : undefined
  const reqStatus = computeRequestStatus(lastReq)
  if (!reqStatus || !lastItem) {
    return <span className="text-admin-muted">—</span>
  }
  const qtyText = formatQuantityWithUnit(lastItem.quantityRequested, item.unit)
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{qtyText}</span>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        reqStatus === "Pending"
          ? "bg-yellow-100 text-yellow-700"
          : reqStatus === "Partial"
          ? "bg-orange-100 text-orange-700"
          : "bg-green-100 text-green-700"
      }`}>
        {reqStatus}
      </span>
    </div>
  )
}
```

### Step 6: Add badge style constants
**File:** `desktop/ui/pages/Kitchen.tsx`

```ts
const stockStatusClasses: Record<StockDisplayStatus, string> = {
  "Available":     "bg-green-100 text-green-700",
  "Not Available": "bg-red-100 text-red-700",
}

const requestStatusClasses: Record<RequestDisplayStatus, string> = {
  "Pending":   "bg-yellow-100 text-yellow-700",
  "Partial":   "bg-orange-100 text-orange-700",
  "Completed": "bg-green-100 text-green-700",
}
```

---

## Files to Modify

| File | Action |
|---|---|
| `desktop/ui/pages/Kitchen.tsx` | Modify `CurrentStockView` — add requests fetch, status logic, Name column update, Last Request column |

**Total: 1 file modified**

---

## No Backend Changes Needed

All required data is already available:
- `GET /api/stock-supplies` — returns all stock items
- `GET /api/stock-requests` — returns all requests with items

No new API endpoints, no schema changes, no IPC changes.

---

## Verification

1. Run `npm run lint` — no errors
2. Run `npm run build` — type-check passes
3. Visual check: Name column shows stock status, Last Request column shows qty + request status
4. Test scenarios:

| Scenario | Name Column | Last Request Column |
|---|---|---|
| No request + stock > 0 | Rice · `Available` (green) | `—` |
| No request + stock = 0 | Oil · `Not Available` (red) | `—` |
| Pending request | Rice | `5 kg · Pending` (yellow) |
| Partial request | Oil | `3 litres · Partial` (orange) |
| Completed request | Sugar | `10 kg · Completed` (green) |
