# Stock Management System — Phase 1: Schema + Backend Routes

## Platform

backend

## Status

Not Started

## Goals

- Update Prisma schema with all new models and fields
- Create Department CRUD route
- Update stock request endpoint (deduct stock, create fulfillment trail)
- Create cooking records CRUD route
- Create kitchen stock configuration route
- Add kitchen inventory endpoint
- Add low stock count endpoint
- Register all new routes in Express app

## Notes

- Rename APPROVED → COMPLETED in StockRequestStatus enum
- Add platesPerUnit and menuId fields to StockSupply (for ingredients only)
- New models: Department, DepartmentStockSupply, StockFulfillment, StockFulfillmentItem, CookingRecord
- Fulfillment trail tracks each delivery event separately
- Kitchen inventory is derived: Total Received − Total Cooked
- Menu stock auto-updates when cooking is recorded (if menuId is set)
- Full implementation plan in @context/project-plan/stock-management-system.md

## Schema Changes

### New Fields on StockSupply
- platesPerUnit: Decimal (conversion rate, ingredients only)
- menuId: String (optional link to Menu item)

### New Models
- Department (id, name, description)
- DepartmentStockSupply (departmentId, stockSupplyId)
- StockFulfillment (id, stockRequestId, fulfilledById, notes, createdAt)
- StockFulfillmentItem (id, stockFulfillmentId, stockRequestItemId, quantityDelivered)
- CookingRecord (id, stockSupplyId, quantityCooked, platesExpected, cookedById, notes, createdAt)

### Enum Changes
- StockRequestStatus: PENDING, PARTIAL, COMPLETED (renamed from APPROVED)

## Backend Routes to Create/Modify

### 1. backend/routes/departments.ts (New)
- GET /api/departments — List all departments
- POST /api/departments — Create department
- PUT /api/departments/:id — Update department
- DELETE /api/departments/:id — Delete department

### 2. backend/routes/stockRequests.ts (Modify)
- PUT /api/stock-requests/:id/fulfill — Update to deduct stock, create fulfillment trail, use COMPLETED status

### 3. backend/routes/cookingRecords.ts (New)
- GET /api/cooking-records — List cooking records (optional ?stockSupplyId filter)
- POST /api/cooking-records — Create cooking record, calculate plates, update menu stock
- DELETE /api/cooking-records/:id — Delete cooking record, reverse menu stock

### 4. backend/routes/kitchenConfig.ts (New)
- GET /api/kitchen-config — List all configurations
- POST /api/kitchen-config — Create/update configuration (platesPerUnit + menuId)

### 5. backend/routes/stockSupplies.ts (Modify)
- GET /api/stock-supplies/low-stock-count — Return count of items at or below reorder level
- GET /api/stock-supplies/:id/kitchen-inventory — Return kitchen inventory for specific item
- GET /api/stock-supplies — Add department filter support

### 6. backend/app.ts (Modify)
- Register departments route
- Register cooking records route
- Register kitchen config route

## Files to Modify

| File | Action |
|------|--------|
| backend/prisma/schema.prisma | Modify — Add fields, models, relations |
| backend/routes/departments.ts | **Create** — Department CRUD |
| backend/routes/stockRequests.ts | Modify — Update fulfill endpoint |
| backend/routes/cookingRecords.ts | **Create** — Cooking records CRUD |
| backend/routes/kitchenConfig.ts | **Create** — Kitchen stock configuration |
| backend/routes/stockSupplies.ts | Modify — Add low stock, kitchen inventory endpoints |
| backend/app.ts | Modify — Register new routes |

## Validation Rules

### Fulfillment
1. Cannot deliver more than available store stock
2. Cannot deliver more than requested quantity
3. Status can only go forward: PENDING → PARTIAL → COMPLETED
4. Must have at least one item to fulfill

### Cooking
5. Cannot cook more than kitchen inventory (received minus cooked)
6. Must have platesPerUnit configured to cook
7. Quantity cooked must be greater than 0

## Testing Checklist

- [ ] Run prisma migrate to apply schema changes
- [ ] Test Department CRUD (create, read, update, delete)
- [ ] Test stock request fulfillment with stock deduction
- [ ] Test fulfillment trail creation
- [ ] Test cooking record creation with plate calculation
- [ ] Test menu stock auto-update
- [ ] Test kitchen inventory calculation
- [ ] Test low stock count endpoint
- [ ] Verify all routes registered in Express app
