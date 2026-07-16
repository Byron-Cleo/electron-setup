# Stock Management System — Complete Plan

## Overview

A comprehensive stock management system that tracks procured items from purchase through to plates served to customers, with complete audit trails at every step.

---

## The Complete Flow

```
PROCUREMENT → STORE → KITCHEN REQUEST → FULFILLMENT → COOKING → MENU STOCK → REVENUE
```

### Visual Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE STOCK FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. PROCUREMENT                                                             │
│     Items purchased and stored in warehouse                                 │
│     StockSupply.currentStock = 100 kg                                       │
│                                                                             │
│  2. KITCHEN REQUEST                                                         │
│     Kitchen asks for 10 kg of meat                                          │
│     StockRequest created (status = PENDING)                                 │
│                                                                             │
│  3. STORE FULFILLMENT (Partial)                                             │
│     Store delivers 8 kg (2 kg not available yet)                            │
│     StockSupply.currentStock: 100 → 92 kg                                   │
│     StockRequest.status → PARTIAL                                           │
│                                                                             │
│  4. KITCHEN COOKING                                                         │
│     Kitchen cooks 5 kg of the 8 kg received                                 │
│     Conversion: 1 kg = 6 plates                                             │
│     Plates produced: 5 × 6 = 30 plates                                      │
│     Menu.stock += 30 plates                                                 │
│     Kitchen remaining: 8 - 5 = 3 kg                                         │
│                                                                             │
│  5. STORE FULFILLMENT (Complete)                                            │
│     Store delivers remaining 2 kg                                           │
│     StockSupply.currentStock: 92 → 90 kg                                    │
│     StockRequest.status → COMPLETED                                         │
│                                                                             │
│  6. KITCHEN COOKING (Remaining)                                             │
│     Kitchen cooks the remaining 3 kg                                        │
│     Plates produced: 3 × 6 = 18 plates                                      │
│     Menu.stock: 30 → 48 plates                                              │
│     Kitchen remaining: 0 kg                                                 │
│                                                                             │
│  7. WAITER SERVES                                                           │
│     Waiter serves 20 plates to customers                                    │
│     Menu.stock: 48 → 28 plates                                              │
│     Revenue generated                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Final State After Complete Flow

| Location | Item | Amount |
|----------|------|--------|
| Store | Meat stock | 90 kg |
| Kitchen | Meat inventory | 0 kg (all cooked) |
| Menu | Grilled Meat plates | 28 plates available |
| Total cooked | — | 8 kg → 48 plates |
| Total served | — | 20 plates → Revenue |

---

## What Gets Tracked at Each Step

### Step 1: Procurement (Already exists)
- Items added to StockSupply with currentStock
- Categories for organization

### Step 2: Department Request
| Data Captured | Field |
|---------------|-------|
| Who requested | requestedById (User) |
| Department | "kitchen", "waiter", "floor", etc. |
| What items | StockRequestItem records |
| How much | quantityRequested |
| When | createdAt |
| Status | PENDING |

**Supported Departments:**
- Kitchen — requests ingredients for cooking
- Waiter/Floor — requests supplies for service
- Any future department — system is extensible

### Step 3: Store Fulfillment
| Data Captured | Field |
|---------------|-------|
| Who delivered | fulfilledById (User) |
| What items | StockFulfillmentItem records |
| How much delivered | quantityDelivered |
| When | createdAt |
| Notes | optional notes |
| Store stock reduced | StockSupply.currentStock -= delivered |
| Stock movement logged | StockMovement record created |
| Status updated | PENDING → PARTIAL or COMPLETED |

**Multiple fulfillments allowed** — Each is a separate record building a trail.

### Step 4: Kitchen Cooking
| Data Captured | Field |
|---------------|-------|
| What was cooked | stockSupplyId |
| How much cooked | quantityCooked (kg) |
| Expected plates | platesExpected (calculated) |
| Who cooked | cookedById (User) |
| When | createdAt |
| Notes | optional notes |
| Menu stock updated | Menu.stock += platesExpected |

**Kitchen inventory is calculated:** Total Received − Total Cooked

### Step 5: Menu Stock (Auto-updated)
- When cooking is recorded, Menu.stock increases by platesExpected
- When waiter serves, Menu.stock decreases (existing logic)

---

## Fulfillment Trail Example

Kitchen requested 10 kg of meat. Here's the complete trail:

| # | Date | Requested By | Department | Delivered By | Amount | Status |
|---|------|--------------|------------|--------------|--------|--------|
| 1 | Day 1 | Chef John | Kitchen | Alice | 8 kg | PARTIAL |
| 2 | Day 2 | Chef John | Kitchen | Bob | 2 kg | COMPLETED |

**Status progression:** PENDING → PARTIAL → COMPLETED

**Note:** Any department can request items — kitchen, waiter, floor, or future departments.

---

## Cooking Trail Example

Kitchen received 10 kg of meat total. Here's what happened:

| # | Date | Cooked By | Amount | Plates Produced | Remaining |
|---|------|-----------|--------|-----------------|-----------|
| 1 | Day 1 | Chef John | 5 kg | 30 plates | 5 kg |
| 2 | Day 2 | Chef John | 3 kg | 18 plates | 2 kg |
| 3 | Day 3 | Chef Mary | 2 kg | 12 plates | 0 kg |

**Kitchen Inventory Formula:** Total Received (10 kg) − Total Cooked (10 kg) = 0 kg

---

## Reorder Threshold Alerts

When a stock item reaches or falls below its reorder level:

| Item | Current Stock | Reorder Level | Status |
|------|---------------|---------------|--------|
| Cooking Oil | 15 L | 20 L | ⚠️ RESTOCK |
| Rice | 50 kg | 30 kg | ✅ OK |
| Meat | 8 kg | 10 kg | ⚠️ RESTOCK |

**Dashboard Badge:** Shows count of items needing restock (e.g., "2 items need restocking")

---

## Dashboard Thumbnails with Descriptions

### Store Dashboard
| Icon | Title | Description | Badge |
|------|-------|-------------|-------|
| 📦 | All Current Stock Items | View and manage all procured inventory items | Count of items |
| 📋 | Inhouse Stock Requests | Track requests from all departments (kitchen, waiter, floor, etc.) | Pending/Partial counts |
| 🔄 | Restock / Procure Items | Order new stock when levels are low | Low stock count |

### Kitchen Dashboard
| Icon | Title | Description |
|------|-------|-------------|
| 📤 | Request Food / Items | Request ingredients and supplies from store |
| 🔥 | Cook Food | Record cooking activities and track plates produced |
| 📜 | Cooking History | View past cooking activities and plates produced |

---

## Data Models Summary

### Existing Models (Already in Database)
| Model | Purpose |
|-------|---------|
| StockSupply | Stores items with currentStock, reorderLevel, unit |
| StockSupplyCategory | Groups stock items |
| StockRequest | Tracks requests with status |
| StockRequestItem | Line items with quantityRequested and quantityDelivered |
| Menu | Menu items with stock (plates available) |

### New Fields on Existing Models
| Model | New Field | Purpose | Applies To |
|-------|-----------|---------|------------|
| StockSupply | platesPerUnit | Conversion rate (e.g., 6 plates per kg) | Ingredients only |
| StockSupply | menuId | Link to Menu item | Ingredients only |

### New Model: Department
| Model | Purpose |
|-------|---------|
| Department | Restaurant departments (Kitchen, Waiter, Floor, Cleaning, etc.) |
| DepartmentStockSupply | Junction table linking stock items to departments that can order them |

**Department Model Fields:**
| Field | Purpose |
|-------|---------|
| id | Unique identifier |
| name | Department name (e.g., "Kitchen", "Waiter") |
| description | Optional description |
| createdAt | Creation timestamp |
| updatedAt | Last update timestamp |

**DepartmentStockSupply Junction Table:**
| Field | Purpose |
|-------|---------|
| departmentId | Link to Department |
| stockSupplyId | Link to StockSupply |

**Example:**
- Kitchen can order: Meat, Rice, Cooking Oil
- Waiter can order: Takeaway Boxes, Napkins
- Cleaning can order: Detergent, Soap

---

## Admin Configuration UI: Settings Tab

### Location

**Path:** Admin → Settings

### Three Cards Layout

The Settings page displays three cards side by side:

| Card 1: Restaurant Departments | Card 2: Stock Supply Categories | Card 3: Kitchen Stock Configuration |
|--------------------------------|----------------------------------|--------------------------------------|
| **New** — Manage departments | Existing CRUD for categories | **New** — Configuration for plate conversion |
| Name, description | Name, description | Stock item, plates per unit, menu item |

### Card 1: Restaurant Departments (New)

**Title:** Restaurant Departments
**Description:** "Manage departments that can request stock items"

**Form fields:**

| Field | Type | Purpose |
|-------|------|---------|
| Name | Text input | Department name (e.g., "Kitchen", "Waiter") |
| Description | Textarea | Optional description |

**Example departments:**
- Kitchen — requests ingredients for cooking
- Waiter — requests supplies for service
- Floor — requests supplies for floor operations
- Cleaning — requests cleaning supplies

**Actions:** Add, Edit, Delete departments

---

### Card 2: Kitchen Stock Configuration

**Title:** Kitchen Stock Configuration
**Description:** "Configure how stock items convert to menu plates"

**Form fields:**

| Field | Type | Purpose |
|-------|------|---------|
| Stock Item | Dropdown (from StockSupply) | Select which stock item to configure |
| Plates per Unit | Number input | How many plates 1 unit produces |
| Menu Item | Dropdown (from Menu) | Which menu item this stock becomes |

**Example configuration:**
- Stock Item: Meat (selected from dropdown)
- Plates per Unit: 6
- Menu Item: Grilled Meat (selected from dropdown)

### Visual Layout (Three Cards)

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  🏢 Restaurant Departments          │  │  📦 Stock Supply Categories         │  │  🍽️ Kitchen Stock Configuration     │
│  ----------------------------------│  │  ----------------------------------│  │  ----------------------------------│
│  [List of departments...]           │  │  [List of categories...]            │  │  Configure how stock items         │
│                                     │  │                                     │  │  convert to menu plates            │
│  [+ Add Department]                 │  │  [+ Add Category]                   │  │                                     │
│                                     │  │                                     │  │  Stock Item: [Meat ▼]              │
│                                     │  │                                     │  │  Plates per Unit: [6]              │
│                                     │  │                                     │  │  Menu Item: [Grilled Meat ▼]       │
│                                     │  │                                     │  │                                     │
│                                     │  │                                     │  │  [Save Configuration]              │
└─────────────────────────────────────┘  └─────────────────────────────────────┘  └─────────────────────────────────────┘
```

### Important: NOT in StockSupplyForm

The configuration fields (`platesPerUnit` and `menuId`) are **NOT** added to the StockSupplyForm where name, category, unit, stock, and reorder level are entered.

They are configured **separately** in the Kitchen Stock Configuration card on the Settings page.

### StockSupplyForm Update: Department Access

When adding/editing a stock supply, admin can now link it to departments:

| Field | Type | Purpose |
|-------|------|---------|
| Name | Text | Stock item name |
| Category | Dropdown | Stock supply category |
| Unit | Dropdown | KG, G, L, ML, PCS |
| Current Stock | Number | Current quantity |
| Reorder Level | Number | Low stock threshold |
| **Access Departments** | **Multi-select** | **Which departments can order this item** |

**Example:**
- Stock Item: Cooking Oil
- Access Departments: [Kitchen] (only kitchen can request it)

**Example:**
- Stock Item: Napkins
- Access Departments: [Waiter, Floor] (both can request it)

---

## Ingredients vs Supplies

### Ingredients (Become Plates)

Stock items that get **converted into menu items** customers order and pay for.

| Stock Item | Becomes Menu Item | Conversion |
|------------|-------------------|------------|
| Meat | Grilled Meat | 1 kg → 6 plates |
| Rice | Fried Rice | 1 kg → 10 plates |
| Fish | Fish Fillet | 1 kg → 5 plates |
| Chicken | Roasted Chicken | 1 kg → 4 plates |

**Key characteristic:** Measured in quantity (kg, L) and converted to plates (portions) on the menu.

**Configuration:** Required in Kitchen Stock Configuration card (platesPerUnit + menuId).

### Supplies (Do NOT Become Plates)

Stock items used in operations but **don't directly become plates**.

| Stock Item | Purpose |
|------------|---------|
| Cooking Oil | Cooking medium |
| Detergent | Cleaning |
| Takeaway Boxes | Packaging |
| Gas/Cooking Fuel | Energy |
| Spices/Salt | Seasoning (small amounts) |

**Key characteristic:** Consumed during cooking or operations, not directly resulting in a plate.

**Configuration:** Not configured — just tracked as inventory in StockSupplyForm only.

### Configuration Rule

| Item Type | platesPerUnit | menuId | Kitchen Config Card |
|-----------|---------------|--------|---------------------|
| Ingredient | Required | Required | ✅ Configured |
| Supply | Empty | Empty | ❌ Not configured |

---

## Department-Based Stock Access

### How It Works

1. **Admin configures departments** in Settings → Restaurant Departments card
2. **Admin links stock items to departments** when adding/editing stock supply (multi-select)
3. **Department logs in** → System filters stock items by their department
4. **Department sees only relevant items** — cleaner UI, no irrelevant items
5. **Department requests items** → StockRequest created with department field

### Example

| Stock Item | Type | Access Departments |
|------------|------|-------------------|
| Meat | Ingredient | Kitchen |
| Rice | Ingredient | Kitchen |
| Cooking Oil | Supply | Kitchen |
| Detergent | Supply | Cleaning |
| Takeaway Boxes | Supply | Waiter |
| Napkins | Supply | Waiter, Floor |

**Kitchen sees:** Meat, Rice, Cooking Oil
**Waiter sees:** Takeaway Boxes, Napkins
**Cleaning sees:** Detergent

### Department Request Flow

1. **Kitchen logs in** → System filters stock items by department: Kitchen
2. **Kitchen sees only:** Meat, Rice, Cooking Oil (items linked to Kitchen)
3. **Kitchen requests items** → StockRequest created with department: "Kitchen"
4. **Store fulfills** → Stock deducted, trail recorded
5. **Kitchen cooks** → Plates produced, menu stock updated (for ingredients)

**Same flow works for Waiter, Cleaning, or any other department.**

### New Models
| Model | Purpose |
|-------|---------|
| StockFulfillment | Records each delivery event (who, when, notes) |
| StockFulfillmentItem | Line items in a fulfillment (which item, how much) |
| CookingRecord | Records cooking activities (what, how much, expected plates) |
| StockMovement | Tracks all stock changes (already in procurement plan) |

---

## Status Values

### StockRequest Status
| Status | Meaning |
|--------|---------|
| PENDING | Request created, nothing delivered yet |
| PARTIAL | Some items delivered, not all |
| COMPLETED | All requested items fully delivered |

*Note: Renamed APPROVED → COMPLETED for clarity*

---

## Key Calculations

### Kitchen Inventory (Derived, not stored)
```
Kitchen Inventory = Total Received − Total Cooked

Total Received = Sum of all quantityDelivered for this stock supply
Total Cooked = Sum of all quantityCooked for this stock supply
```

### Plates Expected (Calculated on cooking)
```
Plates Expected = quantityCooked × platesPerUnit
Example: 5 kg × 6 plates/kg = 30 plates
```

### Store Stock Deduction (On fulfillment)
```
New Stock = Current Stock − quantityDelivered
Example: 100 kg − 8 kg = 92 kg
```

---

## Implementation Phases

### Phase 1: Schema Updates
- Add new fields to StockSupply (platesPerUnit, menuId) — for ingredients only
- Add new models (Department, DepartmentStockSupply, StockFulfillment, StockFulfillmentItem, CookingRecord)
- Rename APPROVED → COMPLETED
- Add relations to existing models

### Phase 2: Backend API
- Update fulfillment endpoint (deduct stock, create trail)
- Add cooking records endpoint (record cooking, update menu stock)
- Add kitchen inventory endpoint (calculate received minus cooked)
- Add low stock count endpoint (for dashboard badges)
- Add kitchen config endpoint (manage platesPerUnit and menuId for ingredients)

### Phase 3: Frontend Types
- Add TypeScript types for new models
- Update API functions in lib/api.ts

### Phase 4: Store Dashboard
- Add descriptions to dashboard cards
- Add low stock badge on Restock card
- Update status badges (APPROVED → COMPLETED)

### Phase 5: Stock Requests List
- Show fulfillment count on each request
- Display fulfillment trail when expanding request

### Phase 6: Fulfill Request Form
- Show previous fulfillments as history
- Add notes field for each fulfillment
- Validate stock availability before submission

### Phase 7: Kitchen Dashboard
- Add descriptions to dashboard cards
- Add Cook Food view (kitchen inventory + cooking form)
- Add Cooking History view

### Phase 8: Electron IPC
- Add preload methods for new endpoints
- Add IPC handlers
- Register handlers in main.ts

---

## Files to Create/Modify

| File | Action |
|------|--------|
| backend/prisma/schema.prisma | Modify — Add fields, models, relations |
| backend/routes/stockRequests.ts | Modify — Update fulfill endpoint |
| backend/routes/stockSupplies.ts | Modify — Add kitchen inventory, low stock endpoints, department filter |
| backend/routes/cookingRecords.ts | **Create** — Cooking records CRUD |
| backend/routes/kitchenConfig.ts | **Create** — Kitchen stock configuration CRUD |
| backend/routes/departments.ts | **Create** — Department CRUD |
| backend/app.ts | Modify — Register new routes |
| desktop/ui/types/electron.d.ts | Modify — Add new types |
| desktop/ui/lib/api.ts | Modify — Add new API functions |
| desktop/ui/pages/Store.tsx | Modify — Descriptions, badges |
| desktop/ui/components/store/StockRequestsList.tsx | Modify — Fulfillment trail |
| desktop/ui/components/store/FulfillRequest.tsx | Modify — Notes, validation |
| desktop/ui/pages/Kitchen.tsx | Modify — Cooking functionality |
| desktop/ui/pages/Settings.tsx | Modify — Add three configuration cards |
| desktop/ui/components/admin/DepartmentManager.tsx | **Create** — Department management component |
| desktop/ui/components/admin/KitchenStockConfig.tsx | **Create** — Kitchen stock configuration component |
| desktop/electron/preload.cts | Modify — Add methods |
| desktop/electron/ipc-handlers.ts | Modify — Add handlers |
| desktop/electron/main.ts | Modify — Register handlers |

**Total: 19 files** (4 new routes/components, 15 modifications)

---

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

---

## Edge Cases

### Fulfillment
- Zero stock: Show error when trying to fulfill with no stock
- Over-request: Allow but warn (stock may arrive later)
- Multiple partials: Support unlimited partial deliveries
- Delete request: Only allowed if status is PENDING

### Cooking
- Zero kitchen inventory: Cannot cook if nothing received
- No platesPerUnit: Show warning, skip menu stock update
- No menuId: Record cooking but don't update menu stock
- Delete cooking record: Reverse menu stock when deleted

---

## Complete Data Flow Example

```
DAY 1:
─────────────────────────────────────────────
Store: 100 kg meat (platesPerUnit = 6)
Kitchen: Requests 10 kg
Store: Delivers 8 kg
  → Store stock: 92 kg
  → Kitchen inventory: 8 kg
  → Status: PARTIAL

Kitchen: Cooks 5 kg
  → Plates: 30
  → Menu stock: 30 plates
  → Kitchen inventory: 3 kg

DAY 2:
─────────────────────────────────────────────
Store: Delivers 2 kg
  → Store stock: 90 kg
  → Kitchen inventory: 5 kg
  → Status: COMPLETED

Kitchen: Cooks 3 kg
  → Plates: 18
  → Menu stock: 48 plates
  → Kitchen inventory: 2 kg

DAY 3:
─────────────────────────────────────────────
Kitchen: Cooks 2 kg
  → Plates: 12
  → Menu stock: 60 plates
  → Kitchen inventory: 0 kg

Waiter: Serves 20 plates
  → Menu stock: 40 plates
  → Revenue generated

FINAL STATE:
─────────────────────────────────────────────
Store: 90 kg meat
Kitchen: 0 kg
Menu: 40 plates available
Revenue: 20 plates served
```

---

## Testing Checklist

### Department Tests
- [ ] Create department (Kitchen, Waiter, Cleaning)
- [ ] Edit department
- [ ] Delete department
- [ ] Link stock item to department (multi-select)
- [ ] Verify department filtering works

### Fulfillment Tests
- [ ] Create stock request from kitchen
- [ ] Fulfill request partially (verify stock deduction)
- [ ] Fulfill request completely (verify status = COMPLETED)
- [ ] View fulfillment trail (who delivered what, when)
- [ ] Record cooking activity (verify plates calculation)
- [ ] Verify kitchen inventory (received - cooked)
- [ ] Verify menu stock auto-update
- [ ] Verify low stock badge appears
- [ ] Test validation: cannot over-deliver
- [ ] Test validation: cannot cook more than available
- [ ] Delete cooking record (verify menu stock reversal)
- [ ] Complete flow: Request → Fulfill → Cook → Serve

---

## Notes

- All monetary values use Decimal(12,2)
- UUIDs via gen_random_uuid()
- Kitchen inventory is derived, not stored separately
- Menu stock auto-updates when cooking is recorded
- Plates calculation uses Math.floor (no fractional plates)
- platesPerUnit is user-defined per stock supply
- Each fulfillment and cooking record is a separate audit trail entry
