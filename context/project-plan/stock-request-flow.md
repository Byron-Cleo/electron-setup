# Stock Request Flow — Kitchen ↔ Store

## Overview
Kitchen staff can view current stock levels and request items from the store. Store person sees all incoming requests and fulfills them (partial or full). Status tracks progress: PENDING → PARTIAL → APPROVED.

## Problem
Currently there is no way for kitchen staff to formally request stock from the store. Requests happen verbally or on paper, with no tracking of what was requested, what was delivered, or what's remaining.

## Goal
- Kitchen views current stock levels before requesting
- Kitchen submits stock requests with specific items and quantities
- Store sees all pending/partial/approved requests in one place
- Store fulfills requests (partial or full delivery)
- Status auto-calculates based on fulfillment progress
- Both sides can view request history

---

## New Prisma Models

### 1. StockRequest
A request from kitchen (or any department) for stock items.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK, gen_random_uuid() |
| requestedById | UUID | FK → User (who made the request) |
| department | String | "kitchen", "waiter", etc. |
| status | StockRequestStatus | PENDING (default), PARTIAL, APPROVED |
| notes | String? | optional notes from requester |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |
| requestedBy | User | relation |
| items | StockRequestItem[] | relation |

### 2. StockRequestItem
Line items within a stock request.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK, gen_random_uuid() |
| stockRequestId | UUID | FK → StockRequest (onDelete: Cascade) |
| stockSupplyId | UUID | FK → StockSupply |
| quantityRequested | Decimal | Decimal(12,2) — what kitchen asked for |
| quantityDelivered | Decimal | Decimal(12,2), default 0 — what store actually gave |
| createdAt | DateTime | default now() |
| updatedAt | DateTime | @updatedAt |
| stockRequest | StockRequest | relation |
| stockSupply | StockSupply | relation |

### New Enum

```prisma
enum StockRequestStatus {
  PENDING    // request created, nothing delivered yet
  PARTIAL    // some items delivered, not all
  APPROVED   // all requested items fully delivered
}
```

### Schema Changes to Existing Models

**User** — add relation:
```prisma
model User {
  // ... existing fields ...
  StockRequest StockRequest[]  // requests made by this user
}
```

**StockSupply** — no changes needed (StockRequestItem links to it directly).

---

## Status Logic

| Status | Condition | Set by |
|---|---|---|
| `PENDING` | Request just created | Auto on POST |
| `PARTIAL` | Any item has `quantityDelivered < quantityRequested` | Auto on fulfill |
| `APPROVED` | All items have `quantityDelivered >= quantityRequested` | Auto on fulfill |

The status is **auto-calculated** on the backend when store fulfills — no manual status selection needed.

---

## API Routes

### `/api/stock-requests`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all requests (optional `?status=PENDING` filter) |
| GET | `/:id` | Single request with items + stockSupply details |
| POST | `/` | Create request (kitchen submits) |
| PUT | `/:id/fulfill` | Store updates delivered quantities per item |

### POST `/api/stock-requests` — Create Request

Request body:
```json
{
  "requestedById": "uuid",
  "department": "kitchen",
  "notes": "Need rice and oil for this week",
  "items": [
    { "stockSupplyId": "uuid", "quantityRequested": 5 },
    { "stockSupplyId": "uuid", "quantityRequested": 2 }
  ]
}
```

Response: created StockRequest with items, status=PENDING

### PUT `/api/stock-requests/:id/fulfill` — Fulfill Request

Request body:
```json
{
  "items": [
    { "stockRequestItemId": "uuid", "quantityDelivered": 3 },
    { "stockRequestItemId": "uuid", "quantityDelivered": 2 }
  ]
}
```

Backend logic:
1. Update each item's `quantityDelivered`
2. Auto-calculate status:
   - If ALL items have `quantityDelivered >= quantityRequested` → `APPROVED`
   - If ANY item has `quantityDelivered < quantityRequested` (and > 0) → `PARTIAL`
   - If ALL items have `quantityDelivered == 0` → `PENDING`
3. Update `StockRequest.status`
4. Return updated request with items

---

## Frontend Pages

### Store Page (`/store`)

Dashboard layout with **3 clickable cards** at top:
- **Stock Requests** → shows request list with pending/partial/approved tabs
- **Current Stock** → shows all StockSupply items (read-only table)
- *(Future: Suppliers card)*

#### Stock Requests View
- Tabs: `Pending (n)` | `Partial (n)` | `Approved (n)`
- Each request card shows:
  - Requester name, department, date
  - Items list: name, requested qty, delivered qty, unit
  - Status badge (color-coded)
  - "Fulfill" button (only for PENDING/PARTIAL)

#### Fulfill Form (modal or inline)
- Shows each item with:
  - Item name + unit
  - Requested quantity
  - Available stock (from StockSupply.currentStock)
  - Input field for delivered quantity
- Two actions:
  - **Save as Partial** — saves deliveries, status → PARTIAL
  - **Mark Complete** — saves deliveries, status → APPROVED (only if all fully delivered)

#### Current Stock View
- Read-only table: Name | Category | Current Stock | Unit | Reorder Level
- Low stock items highlighted (currentStock <= reorderLevel)

### Kitchen Page (`/kitchen`)

Sub-tabs: `Current Stock` | `Request Stock` | `My Requests`

#### Current Stock (read-only)
- Table of all active StockSupply items
- Shows: Name | Category | Stock Level | Unit
- Helps kitchen see what's available before requesting

#### Request Stock (form)
- Search/select stock items
- Add multiple items with quantities
- Optional notes field
- Submit → creates StockRequest with status=PENDING

#### My Requests (history)
- List of kitchen staff's past requests
- Shows status badge, date, items summary
- Click to expand details

---

## Electron IPC

### Preload (`preload.cts`)
```typescript
stockRequest: {
  getAll: (status?: string) => ipcRenderer.invoke("stock-request:get-all", status),
  getById: (id: string) => ipcRenderer.invoke("stock-request:get-by-id", id),
  create: (data: any) => ipcRenderer.invoke("stock-request:create", data),
  fulfill: (id: string, data: any) => ipcRenderer.invoke("stock-request:fulfill", id, data),
}
```

### IPC Handlers (`ipc-handlers.ts`)
- `registerStockRequestHandlers()` — proxies to Express API

---

## Frontend API (`lib/api.ts`)

```typescript
// Stock Requests
getStockRequests(status?: string): Promise<StockRequest[]>
getStockRequestById(id: string): Promise<StockRequest>
createStockRequest(data: CreateStockRequestData): Promise<StockRequest>
fulfillStockRequest(id: string, data: FulfillStockRequestData): Promise<StockRequest>
```

---

## Types (`electron.d.ts`)

```typescript
type StockRequestStatus = "PENDING" | "PARTIAL" | "APPROVED"

interface StockRequestItem {
  id: string
  stockRequestId: string
  stockSupplyId: string
  quantityRequested: number
  quantityDelivered: number
  createdAt: string
  updatedAt: string
  stockSupply: StockSupply
}

interface StockRequest {
  id: string
  requestedById: string
  department: string
  status: StockRequestStatus
  notes: string | null
  createdAt: string
  updatedAt: string
  requestedBy: { id: string; name: string }
  items: StockRequestItem[]
}

interface CreateStockRequestData {
  requestedById: string
  department: string
  notes?: string
  items: { stockSupplyId: string; quantityRequested: number }[]
}

interface FulfillStockRequestData {
  items: { stockRequestItemId: string; quantityDelivered: number }[]
}
```

---

## Implementation Order

1. **Prisma schema** — Add StockRequest, StockRequestItem models + enum + User relation → migrate
2. **Backend route** — `/api/stock-requests` (GET all, GET by id, POST create, PUT fulfill)
3. **Electron IPC** — preload.cts + ipc-handlers.ts + main.ts registration
4. **Frontend types** — electron.d.ts updates
5. **Frontend API** — lib/api.ts new functions
6. **Store page** — Dashboard cards, requests list with tabs, fulfill form, stock view
7. **Kitchen page** — Stock view, request form, request history

## Files to Create/Modify

| File | Action |
|---|---|
| `backend/prisma/schema.prisma` | Add models + enum + User relation |
| `backend/routes/stockRequests.ts` | **Create** — new route |
| `backend/app.ts` | Register stock-requests route |
| `desktop/electron/preload.cts` | Add stockRequest methods |
| `desktop/electron/ipc-handlers.ts` | Add registerStockRequestHandlers |
| `desktop/electron/main.ts` | Register stock request handlers |
| `desktop/ui/types/electron.d.ts` | Add StockRequest types |
| `desktop/ui/lib/api.ts` | Add stock request API functions |
| `desktop/ui/pages/Store.tsx` | **Rewrite** — dashboard cards + views |
| `desktop/ui/pages/Kitchen.tsx` | **Rewrite** — tabs with stock/request/history |
| `desktop/ui/components/store/FulfillRequest.tsx` | **Create** — fulfill form component |
| `desktop/ui/components/store/RequestStockForm.tsx` | **Create** — kitchen request form |
| `desktop/ui/components/store/StockRequestsList.tsx` | **Create** — requests list with tabs |

**Total: 13 files** (3 create new routes/components, 10 modify existing)
