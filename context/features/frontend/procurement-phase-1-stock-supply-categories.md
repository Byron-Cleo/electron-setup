# Procurement Phase 1 — StockSupplyCategory CRUD (Frontend Spec)

> Frontend implementation for managing stock supply categories with full CRUD operations.

---

## Overview

Phase 1 of the procurement frontend. Implements the StockSupplyCategory management interface accessible from the Manager page. Provides list view with table, create/edit forms, and delete confirmation dialog.

---

## Goals

- Update Manager page with two thumbnail cards (Stock Supply Categories, Stock Supplies)
- Create StockSupplyCategory list page with data table
- Implement create/edit form for StockSupplyCategory
- Add delete confirmation dialog
- Wire up IPC handlers and preload methods for StockSupplyCategory
- Add TypeScript types for StockSupplyCategory

---

## Navigation Structure

```
/admin/manager                         → Manager (two thumbnail cards)
/admin/manager/stock-supply-categories → StockSupplyCategory list (table + CRUD)
/admin/manager/stock-supply-categories/new  → Create new category
/admin/manager/stock-supply-categories/:id  → Edit existing category
/admin/manager/stock-supplies          → StockSupply list (Phase 2)
```

---

## Manager Page Design

The Manager page (`/admin/manager`) displays two clickable thumbnail cards:

```
┌─────────────────────────────────────────────────────────────┐
│                        Manager                              │
├─────────────────────────┬───────────────────────────────────┤
│                         │                                   │
│   ┌─────────────────┐   │   ┌─────────────────┐            │
│   │  📦             │   │   │  🏷️             │            │
│   │  Stock Supply   │   │   │  Stock Supplies │            │
│   │  Categories     │   │   │  Manage raw     │            │
│   │  Manage types   │   │   │  materials      │            │
│   └─────────────────┘   │   └─────────────────┘            │
│                         │                                   │
└─────────────────────────┴───────────────────────────────────┘
```

### Card Specs
- Width: ~300px each, side-by-side with gap
- Background: `bg-admin-card` (white)
- Border: `border-admin-card-border`
- Rounded corners, subtle shadow
- Icon from lucide-react: `Package` for categories, `Tag` for supplies
- Click navigates to respective list page

---

## StockSupplyCategory List Page

### Route
`/admin/manager/stock-supply-categories`

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Stock Supply Categories              [+ Add Category]      │
├─────────────────────────────────────────────────────────────┤
│  Search: [______________]                                   │
├─────┬──────────────────┬─────────────────┬──────────────────┤
│ #   │ Name             │ Supplies Count  │ Actions          │
├─────┼──────────────────┼─────────────────┼──────────────────┤
│ 1   │ Proteins         │ 3               │ Edit | Delete    │
│ 2   │ Spices           │ 2               │ Edit | Delete    │
│ 3   │ Oils & Fats      │ 1               │ Edit | Delete    │
│ ... │ ...              │ ...             │ ...              │
└─────┴──────────────────┴─────────────────┴──────────────────┘
```

### Table Columns
| Column | Field | Width |
|--------|-------|-------|
| # | Row number (auto) | 60px |
| Name | `category.name` | flex-1 |
| Supplies Count | `category._count.StockSupply` | 120px |
| Actions | Edit + Delete buttons | 150px |

### Features
- **Search**: Filter by name (client-side)
- **Add Category Button**: Top-right, navigates to `/admin/manager/stock-supply-categories/new`
- **Edit Button**: Navigates to `/admin/manager/stock-supply-categories/:id`
- **Delete Button**: Opens confirmation dialog

### Delete Dialog
```
┌─────────────────────────────────────┐
│  Delete Category                    │
├─────────────────────────────────────┤
│                                     │
│  Are you sure you want to delete    │
│  "Proteins"?                        │
│                                     │
│  This action cannot be undone.      │
│                                     │
├─────────────────────────────────────┤
│           [Cancel]  [Delete]        │
└─────────────────────────────────────┘
```

- Show category name in message
- If category has supplies, show warning: "This category has X supplies. Delete failed."
- On success: close dialog, refresh list
- On error: show error message in dialog

---

## StockSupplyCategory Form Page

### Routes
- Create: `/admin/manager/stock-supply-categories/new`
- Edit: `/admin/manager/stock-supply-categories/:id`

### Form Fields
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text input | Yes | Min 1 char, unique |
| Description | textarea | No | — |

### Form Layout
```
┌─────────────────────────────────────┐
│  New Stock Supply Category          │
├─────────────────────────────────────┤
│                                     │
│  Name *                             │
│  [____________________________]     │
│                                     │
│  Description                        │
│  [____________________________]     │
│  [____________________________]     │
│                                     │
├─────────────────────────────────────┤
│              [Cancel]  [Save]       │
└─────────────────────────────────────┘
```

### Behavior
- **Create mode**: Empty form, POST to `/api/stock-supply-categories`
- **Edit mode**: Fetch category by ID, populate form, PUT to `/api/stock-supply-categories/:id`
- **Validation errors**: Display inline below each field
- **API errors**: Display at top of form (e.g., "Name already exists")
- **Success**: Navigate back to list page
- **Cancel**: Navigate back to list page

---

## Files to Create/Modify

### Electron Layer

| Layer | File | Action |
|-------|------|--------|
| Types | `desktop/ui/types/electron.d.ts` | Add `StockSupplyCategory`, `StockSupplyCategoryCreateData`, `StockSupplyCategoryUpdateData` types; add `stockSupplyCategory` namespace to `ElectronAPI` |
| Preload | `desktop/electron/preload.cts` | Expose `stockSupplyCategory.*` IPC methods |
| IPC | `desktop/electron/ipc-handlers.ts` | Add `registerStockSupplyCategoryHandlers()` |

### Frontend Layer

| Layer | File | Action |
|-------|------|--------|
| Manager | `desktop/ui/pages/admin/Manager.tsx` | **Rewrite** — Two thumbnail cards with navigation |
| List | `desktop/ui/pages/admin/StockSupplyCategories.tsx` | **Create** — Table with CRUD |
| Form | `desktop/ui/pages/admin/StockSupplyCategoryForm.tsx` | **Create** — Create/Edit form |
| Routes | `desktop/ui/App.tsx` | Add nested routes under `/admin/manager/stock-supply-categories` |

---

## TypeScript Types

```typescript
interface StockSupplyCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { StockSupply: number };
}

interface StockSupplyCategoryCreateData {
  name: string;
  description?: string;
}

type StockSupplyCategoryUpdateData = Partial<StockSupplyCategoryCreateData>;
```

### ElectronAPI Addition

```typescript
stockSupplyCategory: {
  getAll: () => Promise<StockSupplyCategory[]>;
  getById: (id: string) => Promise<StockSupplyCategory>;
  create: (data: StockSupplyCategoryCreateData) => Promise<StockSupplyCategory>;
  update: (id: string, data: StockSupplyCategoryUpdateData) => Promise<StockSupplyCategory>;
  delete: (id: string) => Promise<{ message: string; id: string }>;
};
```

---

## IPC Handler Pattern

Follow existing pattern from `registerMealTypeHandlers()`:

```typescript
export function registerStockSupplyCategoryHandlers() {
  ipcMain.handle("stock-supply-category:get-all", async () => apiFetch("/stock-supply-categories"));
  ipcMain.handle("stock-supply-category:get-by-id", async (_event, id: string) => apiFetch(`/stock-supply-categories/${id}`));
  ipcMain.handle("stock-supply-category:create", async (_event, data) =>
    apiFetch("/stock-supply-categories", { method: "POST", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply-category:update", async (_event, id: string, data) =>
    apiFetch(`/stock-supply-categories/${id}`, { method: "PUT", body: JSON.stringify(data) })
  );
  ipcMain.handle("stock-supply-category:delete", async (_event, id: string) =>
    apiFetch(`/stock-supply-categories/${id}`, { method: "DELETE" })
  );
}
```

---

## Component Patterns

### Use shadcn/ui Primitives
- `Card`, `CardHeader`, `CardContent`, `CardTitle` for page containers
- `Button` for actions (variant="outline" for cancel, default for submit)
- `Input` for text fields
- `Textarea` for description
- `Label` for form labels
- `Dialog` (needs to be added via `npx shadcn@latest add dialog`) for delete confirmation

### Form Pattern (from MenuForm.tsx)
- `react-hook-form` with `zodResolver`
- Schema defined as `formSchema`, type inferred: `type FormValues = z.infer<typeof formSchema>`
- `form.setError("root", ...)` for API errors
- `form.reset()` in `useEffect` for edit mode

### Table Pattern
- Use `<Card>` as container
- Native `<table>` with Tailwind classes (matching existing MealTypeList pattern)
- Loading state: skeleton or spinner
- Error state: red text with retry
- Empty state: "No categories found" message

---

## Route Configuration (App.tsx)

```tsx
<Route path="manager" element={<AdminManager />} />
<Route path="manager/stock-supply-categories" element={<StockSupplyCategories />} />
<Route path="manager/stock-supply-categories/new" element={<StockSupplyCategoryForm />} />
<Route path="manager/stock-supply-categories/:id" element={<StockSupplyCategoryForm />} />
```

---

## Key Decisions

- **Dialog component**: Must be added via `npx shadcn@latest add dialog` before implementation
- **No global state**: Each page fetches its own data (consistent with existing patterns)
- **Client-side search**: Filter table rows by name (no API search endpoint)
- **Hard delete for categories**: Unlike supplies, categories can be permanently deleted (no soft-delete)
- **Category delete guard**: Backend checks if supplies exist before allowing delete
- **Form resets**: Use `useEffect` with `editId` to fetch and populate form in edit mode

---

## Verification

After implementation, verify:
1. Manager page shows two clickable cards
2. Clicking "Stock Supply Categories" card navigates to list page
3. Table loads seeded categories from API
4. "Add Category" button opens empty form
5. Submitting form creates category and returns to list
6. Clicking "Edit" opens form pre-filled with category data
7. Updating form saves changes and returns to list
8. Clicking "Delete" opens confirmation dialog
9. Confirming delete removes category (if no supplies) and refreshes list
10. Error states display correctly (duplicate name, etc.)
