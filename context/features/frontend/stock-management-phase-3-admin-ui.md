# Stock Management System — Phase 3: Admin UI (Settings Page)

## Platform

frontend

## Status

Not Started

## Goals

- Create Settings page with three configuration cards
- Create DepartmentManager component for department CRUD
- Create KitchenStockConfig component for plate conversion configuration
- Update StockSupplyForm to include department access multi-select

## Notes

- Settings page shows three cards side by side
- DepartmentManager: CRUD for restaurant departments
- KitchenStockConfig: Configure platesPerUnit and menuId for ingredients
- StockSupplyForm: Add "Access Departments" multi-select field
- Full implementation plan in @context/project-plan/stock-management-system.md

## UI Layout

### Settings Page (Three Cards)

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

## Components to Create

### 1. desktop/ui/pages/Settings.tsx (Modify)

**Current state:** Settings page exists but needs three cards layout.

**Changes:**
- Add three cards in a grid layout
- Card 1: Restaurant Departments (DepartmentManager component)
- Card 2: Stock Supply Categories (existing component)
- Card 3: Kitchen Stock Configuration (KitchenStockConfig component)

### 2. desktop/ui/components/admin/DepartmentManager.tsx (New)

**Purpose:** CRUD management for restaurant departments.

**Features:**
- List all departments in a table
- Add new department (name, description)
- Edit department
- Delete department (with confirmation)
- Search/filter departments

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| Name | Text input | Yes |
| Description | Textarea | No |

### 3. desktop/ui/components/admin/KitchenStockConfig.tsx (New)

**Purpose:** Configure how stock items convert to menu plates.

**Features:**
- List all configurations
- Add new configuration (stock item, plates per unit, menu item)
- Edit configuration
- Delete configuration

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| Stock Item | Dropdown (from StockSupply) | Yes |
| Plates per Unit | Number input | Yes |
| Menu Item | Dropdown (from Menu) | No (optional) |

**Example:**
- Stock Item: Meat
- Plates per Unit: 6
- Menu Item: Grilled Meat

### 4. desktop/ui/components/admin/StockSupplyForm.tsx (Modify)

**Current state:** Form has name, category, unit, currentStock, reorderLevel.

**Changes:**
- Add "Access Departments" multi-select field
- Admin can link stock item to multiple departments
- Only departments that can order this item are selected

**New field:**
| Field | Type | Required |
|-------|------|----------|
| Access Departments | Multi-select dropdown | No |

**Example:**
- Stock Item: Cooking Oil
- Access Departments: [Kitchen]

- Stock Item: Napkins
- Access Departments: [Waiter, Floor]

## Files to Create/Modify

| File | Action |
|------|--------|
| desktop/ui/pages/Settings.tsx | Modify — Add three cards layout |
| desktop/ui/components/admin/DepartmentManager.tsx | **Create** — Department CRUD component |
| desktop/ui/components/admin/KitchenStockConfig.tsx | **Create** — Kitchen stock configuration component |
| desktop/ui/components/admin/StockSupplyForm.tsx | Modify — Add department access multi-select |

## Testing Checklist

- [ ] Settings page displays three cards correctly
- [ ] Can create, edit, delete departments
- [ ] Can configure platesPerUnit and menuId for stock items
- [ ] Stock supply form shows department multi-select
- [ ] Department selection saves correctly
- [ ] All components use shadcn/ui primitives
- [ ] Loading and error states handled
