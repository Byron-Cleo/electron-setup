# Settings & Store Route Refactor

## Overview

Reorganize the admin navigation so that:
- **Settings tab** only manages configuration data (categories, departments, kitchen config)
- **Store tab** owns all stock supply CRUD operations
- All `/admin/manager/` URLs are renamed to `/admin/settings/`

## Problem

Currently, StockSupply CRUD (the actual stock items like meat, rice, oil) lives under the Settings tab at `/admin/manager/stock-supplies`. This is wrong because:
- Settings should only handle **configuration** data used by other parts of the system
- Stock supplies are **operational** data that belong in the Store/Procurement area
- The URL uses "manager" but the sidebar label says "Settings"

## Solution

### 1. Rename `/admin/manager` → `/admin/settings`

All URLs containing `manager` change to `settings`:

| Before | After |
|--------|-------|
| `/admin/manager` | `/admin/settings` |
| `/admin/manager/stock-supply-categories` | `/admin/settings/stock-supply-categories` |
| `/admin/manager/stock-supply-categories/new` | `/admin/settings/stock-supply-categories/new` |
| `/admin/manager/stock-supply-categories/:id` | `/admin/settings/stock-supply-categories/:id` |
| `/admin/manager/departments` | `/admin/settings/departments` |
| `/admin/manager/kitchen-config` | `/admin/settings/kitchen-config` |

### 2. Move StockSupplies to Store section

| Before | After |
|--------|-------|
| `/admin/manager/stock-supplies` | `/admin/store/stock-supplies` |
| `/admin/manager/stock-supplies/new` | `/admin/store/stock-supplies/new` |
| `/admin/manager/stock-supplies/:id` | `/admin/store/stock-supplies/:id` |

### 3. Settings tab keeps ONLY these 3 models

| Model | CRUD | Location |
|-------|------|----------|
| StockSupplyCategory | Create, Read, Update, Delete | `/admin/settings/stock-supply-categories` |
| Department | Create, Read, Update, Delete | Inline in Settings hub |
| Kitchen Stock Config | Read, Update | Inline in Settings hub |

### 4. Store tab gets StockSupply CRUD

| Operation | Route |
|-----------|-------|
| List stock supplies | `/admin/store/stock-supplies` |
| Create new supply | `/admin/store/stock-supplies/new` |
| Edit supply | `/admin/store/stock-supplies/:id` |

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `desktop/ui/App.tsx` | Rename route path `manager` → `settings`; move stock-supplies routes out of settings into standalone routes |
| 2 | `desktop/ui/components/admin/AdminLayout.tsx` | Update sidebar link: `/admin/manager` → `/admin/settings` |
| 3 | `desktop/ui/pages/admin/Manager.tsx` | Update card paths: `/admin/manager/*` → `/admin/settings/*` |
| 4 | `desktop/ui/pages/admin/StockSupplies.tsx` | Back button → `/admin/store`; Add New button → `/admin/store/stock-supplies/new` |
| 5 | `desktop/ui/pages/admin/StockSupplyForm.tsx` | Save/Back/Cancel → `/admin/store/stock-supplies` |
| 6 | `desktop/ui/pages/admin/StockSupplyCategories.tsx` | Update paths: `/admin/manager/*` → `/admin/settings/*` |
| 7 | `desktop/ui/pages/admin/StockSupplyCategoryForm.tsx` | Update paths: `/admin/manager/*` → `/admin/settings/*` |
| 8 | `desktop/ui/pages/Store.tsx` | Update edit button: `/admin/manager/stock-supplies/:id` → `/admin/store/stock-supplies/:id` |

---

## New Route Structure

```
/admin/settings                                → Settings hub (3 cards)
/admin/settings/stock-supply-categories         → StockSupplyCategories list
/admin/settings/stock-supply-categories/new     → StockSupplyCategoryForm (create)
/admin/settings/stock-supply-categories/:id     → StockSupplyCategoryForm (edit)
/admin/settings/departments                     → (inline in Manager.tsx)
/admin/settings/kitchen-config                  → (inline in Manager.tsx)

/admin/store                                   → Store hub (3 cards)
/admin/store/stock-supplies                    → StockSupplies list
/admin/store/stock-supplies/new                → StockSupplyForm (create)
/admin/store/stock-supplies/:id                → StockSupplyForm (edit)
```

---

## What Each Tab Handles

### Settings Tab (Configuration)
- **Stock Supply Categories** — Group stock items into categories (e.g., "Ingredients", "Supplies", "Cleaning")
- **Departments** — Restaurant departments that can request stock (Kitchen, Waiter, Cleaning)
- **Kitchen Stock Config** — Configure platesPerUnit and menuId for ingredients

### Store Tab (Operations)
- **All Current Stock Items** — View, create, edit, delete stock supplies
- **Inhouse Stock Requests** — Track and fulfill requests from departments
- **Restock / Procure Items** — Order new stock when levels are low

---

## Validation

After implementation:
1. Sidebar "Settings" link goes to `/admin/settings`
2. Settings hub shows 3 cards (Departments, Categories, Kitchen Config)
3. Clicking "Stock Supply Categories" card goes to `/admin/settings/stock-supply-categories`
4. Sidebar "Store/Procurement" link goes to `/admin/store`
5. Store dashboard "All Current Stock Items" card shows stock list at `/admin/store/stock-supplies`
6. Edit button in stock table opens modal (no navigation)
7. Add New button goes to `/admin/store/stock-supplies/new`
8. No URLs contain `/admin/manager` anywhere
9. StockSupplyForm save/cancel navigates back to `/admin/store/stock-supplies`
