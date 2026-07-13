# Procurement Phase 2 — StockSupply CRUD (Frontend Spec)

> Frontend implementation for managing stock supplies with full CRUD operations and soft-delete.

---

## Overview

Phase 2 of the procurement frontend. Implements the StockSupply management interface with list view, create/edit forms, and soft-delete functionality. Supplies are linked to StockSupplyCategories created in Phase 1.

---

## Goals

- Create StockSupply list page with data table
- Implement create/edit form for StockSupplies
- Add delete confirmation dialog (soft-delete)
- Wire up IPC handlers and preload methods for StockSupplies
- Add TypeScript types for StockSupplies
- Display category relation in table and form

---

## Navigation Structure

```
/admin/manager                      → Manager (two thumbnail cards)
/admin/manager/stock-supplies       → StockSupply list (table + CRUD)
/admin/manager/stock-supplies/new   → Create new supply
/admin/manager/stock-supplies/:id   → Edit existing supply
```

---

## StockSupply List Page

### Route
`/admin/manager/stock-supplies`

### Layout
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stock Supplies                                         [+ Add Supply]     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Search: [______________]        Filter Category: [All ▼]                  │
├─────┬──────────────┬─────────────┬──────┬─────────┬───────────┬────────────┤
│ #   │ Name         │ Category    │ Unit │ Stock   │ Reorder   │ Actions    │
├─────┼──────────────┼─────────────┼──────┼─────────┼───────────┼────────────┤
│ 1   │ Fish         │ Proteins    │ PCS  │ 10.00   │ 5.00      │ Edit|Del   │
│ 2   │ Sugar        │ Spices      │ KG   │ 25.00   │ 10.00     │ Edit|Del   │
│ 3   │ Oil          │ Oils & Fats │ L    │ 15.00   │ 5.00      │ Edit|Del   │
│ ... │ ...          │ ...         │ ...  │ ...     │ ...       │ ...        │
└─────┴──────────────┴─────────────┴──────┴─────────┴───────────┴────────────┘
```

### Table Columns
| Column | Field | Width |
|--------|-------|-------|
| # | Row number (auto) | 60px |
| Name | `supply.name` | flex-1 |
| Category | `supply.category.name` | 140px |
| Unit | `supply.unit` | 80px |
| Stock | `supply.currentStock` | 100px |
| Reorder Level | `supply.reorderLevel` | 100px |
| Actions | Edit + Delete buttons | 150px |

### Features
- **Search**: Filter by name (client-side)
- **Category Filter**: Dropdown to filter by category (client-side)
- **Add Supply Button**: Top-right, navigates to `/admin/manager/stock-supplies/new`
- **Edit Button**: Navigates to `/admin/manager/stock-supplies/:id`
- **Delete Button**: Opens confirmation dialog (soft-delete)
- **Low Stock Highlight**: Highlight rows where `currentStock <= reorderLevel`

### Delete Dialog (Soft-Delete)
```
┌─────────────────────────────────────┐
│  Deactivate Supply                  │
├─────────────────────────────────────┤
│                                     │
│  Are you sure you want to deactivate│
│  "Fish (Tilapia)"?                  │
│                                     │
│  This supply will be hidden from    │
│  active inventory but preserved     │
│  for historical records.            │
│                                     │
├─────────────────────────────────────┤
│           [Cancel]  [Deactivate]    │
└─────────────────────────────────────┘
```

- Title says "Deactivate" (not "Delete") to indicate soft-delete
- Message explains supply will be hidden, not permanently removed
- On success: close dialog, refresh list
- On error: show error message in dialog

---

## StockSupply Form Page

### Routes
- Create: `/admin/manager/stock-supplies/new`
- Edit: `/admin/manager/stock-supplies/:id`

### Form Fields
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text input | Yes | Min 1 char |
| Description | textarea | No | — |
| Category | select dropdown | Yes | Must select existing category |
| Unit | select dropdown | Yes | Must be valid ItemUnit (KG, G, L, ML, PCS) |
| Current Stock | number input | No | Default 0, min 0 |
| Reorder Level | number input | No | Min 0 |

### Form Layout
```
┌─────────────────────────────────────┐
│  New Stock Supply                   │
├─────────────────────────────────────┤
│                                     │
│  Name *                             │
│  [____________________________]     │
│                                     │
│  Description                        │
│  [____________________________]     │
│  [____________________________]     │
│                                     │
│  Category *          Unit *         │
│  [Proteins ▼]        [PCS ▼]        │
│                                     │
│  Current Stock      Reorder Level   │
│  [0.00________]     [0.00________]  │
│                                     │
├─────────────────────────────────────┤
│              [Cancel]  [Save]       │
└─────────────────────────────────────┘
```

### Behavior
- **Create mode**: Empty form, POST to `/api/stock-supplies`
- **Edit mode**: Fetch supply by ID, populate form, PUT to `/api/stock-supplies/:id`
- **Slug auto-generated**: Backend generates slug from name if not provided
- **Category dropdown**: Fetch all categories from `/api/stock-supply-categories` on mount
- **Validation errors**: Display inline below each field
- **API errors**: Display at top of form (e.g., "Slug already exists")
- **Success**: Navigate back to list page
- **Cancel**: Navigate back to list page

---

## Files to Create/Modify

### Electron Layer

| Layer | File | Action |
|-------|------|--------|
| Types | `desktop/ui/types/electron.d.ts` | Add `StockSupply`, `StockSupplyCreateData`, `StockSupplyUpdateData` types; add `stockSupply` namespace to `ElectronAPI` |
| Preload | `desktop/electron/preload.cts` | Expose `stockSupply.*` IPC methods |
| IPC | `desktop/electron/ipc-handlers.ts` | Add `registerStockSupplyHandlers()` |

### Frontend Layer

| Layer | File | Action |
|-------|------|--------|
| List | `desktop/ui/pages/admin/StockSupplies.tsx` | **Create** — Table with CRUD |
| Form | `desktop/ui/pages/admin/StockSupplyForm.tsx` | **Create** — Create/Edit form |
| Routes | `desktop/ui/App.tsx` | Add nested routes under `/admin/manager/stock-supplies` |

---

## TypeScript Types

```typescript
interface StockSupply {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  unit: "KG" | "G" | "L" | "ML" | "PCS";
  categoryId: string;
  currentStock: number;
  reorderLevel: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
}

interface StockSupplyCreateData {
  name: string;
  slug?: string;
  description?: string;
  unit: "KG" | "G" | "L" | "ML" | "PCS";
  categoryId: string;
  currentStock?: number;
  reorderLevel?: number;
}

interface StockSupplyUpdateData {
  name?: string;
  slug?: string;
  description?: string;
  unit?: "KG" | "G" | "L" | "ML" | "PCS";
  categoryId?: string;
  currentStock?: number;
  reorderLevel?: number;
  isActive?: boolean;
}
```

### ElectronAPI Addition

```typescript
stockSupply: {
  getAll: () => Promise<StockSupply[]>;
  getById: (id: string) => Promise<StockSupply>;
  create: (data: StockSupplyCreateData) => Promise<StockSupply>;
  update: (id: string, data: StockSupplyUpdateData) => Promise<StockSupply>;
  delete: (id: string) => Promise<{ message: string; id: string }>;
};
```

---

## IPC Handler Pattern

Follow existing pattern from `registerMealTypeHandlers()`:

```typescript
export function registerStockSupplyHandlers() {
  ipcMain.handle("stock-supply:get-all", async () => apiFetch("/stock-supplies"));
  ipcMain.handle("stock-supply:get-by-id", async (_event, id: string) => apiFetch(`/stock-supplies/${id}`));
  ipcMain.handle("stock-supply:create", async (_event, data) =>
    apiFetch("/stock-supplies", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply:update", async (_event, id: string, data) =>
    apiFetch(`/stock-supplies/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply:delete", async (_event, id: string) =>
    apiFetch(`/stock-supplies/${id}`, { method: "DELETE" })
  );
}
```

---

## Component Patterns

### Use shadcn/ui Primitives
- `Card`, `CardHeader`, `CardContent`, `CardTitle` for page containers
- `Button` for actions (variant="outline" for cancel, default for submit)
- `Input` for text and number fields
- `Textarea` for description
- `Label` for form labels
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` for dropdowns
- `Dialog` for delete confirmation

### Form Pattern (from MenuForm.tsx)
- `react-hook-form` with `zodResolver`
- Schema defined as `formSchema`, type inferred: `type FormValues = z.infer<typeof formSchema>`
- `form.setError("root", ...)` for API errors
- `form.reset()` in `useEffect` for edit mode

### Table Pattern
- Use `<Card>` as container
- Native `<table>` with Tailwind classes
- Loading state: skeleton or spinner
- Error state: red text with retry
- Empty state: "No supplies found" message

---

## Route Configuration (App.tsx)

```tsx
<Route path="manager/stock-supplies" element={<StockSupplies />} />
<Route path="manager/stock-supplies/new" element={<StockSupplyForm />} />
<Route path="manager/stock-supplies/:id" element={<StockSupplyForm />} />
```

---

## Key Decisions

- **Soft-delete only**: DELETE sets `isActive = false`, supply hidden from list but preserved
- **No hard deletes**: Supplies with historical stock movements must not be permanently deleted
- **Slug auto-generated**: Backend generates from name if not provided (e.g., "Cooking Oil" → "cooking-oil")
- **Category dropdown**: Fetch categories on form mount, not hardcoded
- **Unit enum**: KG, G, L, ML, PCS — matches backend `ItemUnit` enum
- **Decimal display**: Format `currentStock` and `reorderLevel` to 2 decimal places
- **Low stock indicator**: Visual highlight when `currentStock <= reorderLevel`
- **Inactive supplies hidden**: GET `/api/stock-supplies` only returns `isActive: true` supplies

---

## Verification

After implementation, verify:
1. Manager page "Stock Supplies" card navigates to supply list page
2. Table loads seeded supplies from API with category names
3. Category filter dropdown works correctly
4. "Add Supply" button opens empty form with category dropdown
5. Category dropdown loads categories from API
6. Submitting form creates supply and returns to list
7. Clicking "Edit" opens form pre-filled with supply data
8. Updating form saves changes and returns to list
9. Clicking "Delete" opens deactivation confirmation dialog
10. Confirming deactivation hides supply from list (soft-delete)
11. Low stock supplies are visually highlighted
12. Search filter works by supply name
