# Procurement Plan

## Overview
Capture every food item and supply used in the restaurant — recording, categorizing, ordering, and tracking across all departments (kitchen, service, etc.).

## Problem
Currently there is no system to track raw ingredients, supplies, or procurement requests. Departments have no formal way to order or track items.

## Goal
- Record every item used in the restaurant (fish, chicken, sugar, salt, cooking oil, packaging, cleaning supplies, etc.)
- Categorize items by type
- Allow departments to request items
- Track stock levels and movements (purchases, usage, waste, adjustments)

## New Prisma Models (8 total)

### 1. ItemCategory
Groups items into types.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | unique |
| description | String? | optional |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| items | Item[] | relation |

Example categories: Proteins, Spices, Oils/Fats, Produce, Beverages, Packaging, Cleaning

### 2. Item
A raw ingredient or supply tracked in procurement.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| slug | String | unique |
| description | String? | |
| unit | ItemUnit enum | KG, G, L, ML, PCS |
| categoryId | UUID | FK -> ItemCategory |
| currentStock | Decimal | current quantity on hand |
| reorderLevel | Decimal? | optional low-stock threshold |
| isActive | Boolean | default true |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| category | ItemCategory | relation |
| stockMovements | StockMovement[] | relation |
| requestItems | DepartmentRequestItem[] | relation |
| purchaseItems | PurchaseItem[] | relation |

### 3. StockMovement
Tracks every stock change (purchase, usage, waste, adjustment).
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| itemId | UUID | FK -> Item |
| type | MovementType enum | PURCHASE, USAGE, ADJUSTMENT, WASTE |
| quantity | Decimal | positive = in, negative = out |
| referenceId | String? | links to requestId or purchaseId |
| notes | String? | |
| createdAt | DateTime | |

### 4. DepartmentRequest
A request from any department (kitchen, service, etc.) for items.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| department | String | e.g. "kitchen", "service" |
| status | RequestStatus enum | PENDING, APPROVED, REJECTED, FULFILLED |
| requestedBy | UUID | FK -> User |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| items | DepartmentRequestItem[] | relation |
| user | User | relation |

### 5. DepartmentRequestItem
Line items within a department request.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| requestId | UUID | FK -> DepartmentRequest |
| itemId | UUID | FK -> Item |
| quantityRequested | Decimal | |
| quantityFulfilled | Decimal | default 0 |
| request | DepartmentRequest | relation |
| item | Item | relation |

### 6. Supplier
Vendor/supplier information.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| contact | String? | |
| phone | String? | |
| email | String? | |
| address | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| purchases | Purchase[] | relation |

### 7. Purchase
A purchase order from a supplier.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| supplierId | UUID? | FK -> Supplier (optional) |
| date | DateTime | |
| totalCost | Decimal | |
| notes | String? | |
| createdAt | DateTime | |
| supplier | Supplier? | relation |
| items | PurchaseItem[] | relation |

### 8. PurchaseItem
Line items within a purchase.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| purchaseId | UUID | FK -> Purchase |
| itemId | UUID | FK -> Item |
| quantity | Decimal | |
| unitCost | Decimal | |
| totalCost | Decimal | |
| purchase | Purchase | relation |
| item | Item | relation |

## Enums to Add

```
enum ItemUnit {
  KG
  G
  L
  ML
  PCS
}

enum MovementType {
  PURCHASE
  USAGE
  ADJUSTMENT
  WASTE
}

enum RequestStatus {
  PENDING
  APPROVED
  REJECTED
  FULFILLED
}
```

## Phased Implementation

### Phase 1 — Item Recording (MVP)
- Models: `ItemCategory`, `Item`
- Backend: CRUD routes for categories and items
- Frontend: Admin pages to add/view/edit items and categories
- IPC handlers for procurement operations

### Phase 2 — Department Requests
- Models: `DepartmentRequest`, `DepartmentRequestItem`
- Backend: Request CRUD + workflow (approve/reject/fulfill)
- Frontend: Request form, pending list, approval views
- Kitchen and other departments can submit requests

### Phase 3 — Stock & Purchases
- Models: `StockMovement`, `Supplier`, `Purchase`, `PurchaseItem`
- Backend: Purchase CRUD, stock movement recording
- Frontend: Stock summary page, supplier management, purchase tracking
- Optional: low-stock alerts, spending reports

## Kitchen Reuse
Kitchen does NOT get separate models. It reuses:
- `Item` — for ingredients
- `StockMovement` (type=USAGE) — for consumption tracking
- `DepartmentRequest` (department="kitchen") — for ingredient requests
- Optional future addition: `MenuItemIngredient` to link `Menu` items to `Item` quantities (recipe mapping)

## API Routes (planned)

| Route | Method | Description |
|---|---|---|
| /api/item-categories | GET/POST | List / create categories |
| /api/item-categories/:id | GET/PUT/DELETE | Single category CRUD |
| /api/items | GET/POST | List / create items |
| /api/items/:id | GET/PUT/DELETE | Single item CRUD |
| /api/department-requests | GET/POST | List / create requests |
| /api/department-requests/:id | GET/PUT | Get / update request (approve/reject/fulfill) |
| /api/stock-movements | GET/POST | List / record movements |
| /api/suppliers | GET/POST | List / create suppliers |
| /api/suppliers/:id | GET/PUT/DELETE | Single supplier CRUD |
| /api/purchases | GET/POST | List / create purchases |
| /api/purchases/:id | GET | Single purchase detail |

## Frontend Pages (planned)

| Page | Path | Description |
|---|---|---|
| ProcurementItems | /admin/store/items | Add/view/edit items |
| ProcurementCategories | /admin/store/categories | Manage item categories |
| DepartmentRequests | /admin/store/requests | View and manage requests |
| StockSummary | /admin/store/stock | Current stock levels |
| Suppliers | /admin/store/suppliers | Supplier directory |
| Purchases | /admin/store/purchases | Purchase history |

## Notes
- All monetary values use Decimal(12,2)
- UUIDs via `gen_random_uuid()` (consistent with existing schema)
- Soft-delete via `isActive` flag for items
- No hard deletes on items with existing stock movements
