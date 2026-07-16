# Stock Management System — Phase 2: Frontend Types + API Layer

## Platform

frontend

## Status

Not Started

## Goals

- Add TypeScript types for all new models (Department, StockFulfillment, CookingRecord, etc.)
- Update existing types (StockRequestStatus, StockSupply, StockRequest)
- Add API functions for all new endpoints
- Update existing API functions for modified endpoints

## Notes

- Types go in desktop/ui/types/electron.d.ts
- API functions go in desktop/ui/lib/api.ts
- Follow existing patterns in both files
- Full implementation plan in @context/project-plan/stock-management-system.md

## TypeScript Types to Add/Update

### New Types

```typescript
// Department
interface Department {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

// DepartmentStockSupply (junction)
interface DepartmentStockSupply {
  departmentId: string
  stockSupplyId: string
}

// StockFulfillment
interface StockFulfillment {
  id: string
  stockRequestId: string
  fulfilledById: string
  notes: string | null
  createdAt: string
  fulfilledBy: { id: string; name: string }
  items: StockFulfillmentItem[]
}

// StockFulfillmentItem
interface StockFulfillmentItem {
  id: string
  stockFulfillmentId: string
  stockRequestItemId: string
  quantityDelivered: number
  stockRequestItem: StockRequestItem
}

// CookingRecord
interface CookingRecord {
  id: string
  stockSupplyId: string
  quantityCooked: number
  platesExpected: number
  cookedById: string
  notes: string | null
  createdAt: string
  stockSupply: StockSupply
  cookedBy: { id: string; name: string }
}

// KitchenInventory
interface KitchenInventory {
  stockSupplyId: string
  name: string
  unit: string
  totalReceived: number
  totalCooked: number
  kitchenInventory: number
  platesPerUnit: number | null
}
```

### Updated Types

```typescript
// StockRequestStatus — rename APPROVED to COMPLETED
type StockRequestStatus = "PENDING" | "PARTIAL" | "COMPLETED"

// StockSupply — add new fields
interface StockSupply {
  // ... existing fields ...
  platesPerUnit: number | null
  menuId: string | null
  departments: Department[]  // linked departments
}

// StockRequest — add fulfillments
interface StockRequest {
  // ... existing fields ...
  fulfillments: StockFulfillment[]
}
```

### New Input Types

```typescript
// Create Department
interface CreateDepartmentData {
  name: string
  description?: string
}

// Update Department
interface UpdateDepartmentData {
  name?: string
  description?: string
}

// Create Cooking Record
interface CreateCookingRecordData {
  stockSupplyId: string
  quantityCooked: number
  cookedById: string
  notes?: string
}

// Fulfill Stock Request (updated)
interface FulfillStockRequestData {
  fulfilledById: string
  notes?: string
  items: {
    stockRequestItemId: string
    quantityDelivered: number
  }[]
}

// Kitchen Stock Configuration
interface KitchenConfigData {
  stockSupplyId: string
  platesPerUnit: number
  menuId: string | null
}
```

## API Functions to Add/Update

### New Functions in lib/api.ts

```typescript
// Department API
getDepartments(): Promise<Department[]>
createDepartment(data: CreateDepartmentData): Promise<Department>
updateDepartment(id: string, data: UpdateDepartmentData): Promise<Department>
deleteDepartment(id: string): Promise<void>

// Cooking Records API
getCookingRecords(stockSupplyId?: string): Promise<CookingRecord[]>
createCookingRecord(data: CreateCookingRecordData): Promise<CookingRecord>
deleteCookingRecord(id: string): Promise<void>

// Kitchen Inventory API
getKitchenInventory(stockSupplyId: string): Promise<KitchenInventory>

// Low Stock API
getLowStockCount(): Promise<{ count: number }>

// Kitchen Config API
getKitchenConfig(): Promise<KitchenConfigData[]>
saveKitchenConfig(data: KitchenConfigData): Promise<void>
```

### Updated Functions

```typescript
// fulfillStockRequest — update to include fulfilledById and notes
fulfillStockRequest(id: string, data: FulfillStockRequestData): Promise<StockRequest>

// getStockSupplies — add optional departmentId filter
getStockSupplies(departmentId?: string): Promise<StockSupply[]>
```

## Files to Modify

| File | Action |
|------|--------|
| desktop/ui/types/electron.d.ts | Modify — Add new types, update existing types |
| desktop/ui/lib/api.ts | Modify — Add new API functions, update existing functions |

## Testing Checklist

- [ ] Verify all TypeScript types compile without errors
- [ ] Test each API function against backend endpoints
- [ ] Verify department filtering works
- [ ] Verify cooking record creation works
- [ ] Verify kitchen inventory calculation works
- [ ] Verify low stock count works
