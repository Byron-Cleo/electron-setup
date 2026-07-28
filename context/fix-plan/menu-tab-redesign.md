# Menu Tab Redesign — Dashboard with Two Tables + Create Modal

## Goal
Replace the current tab-based Menu page (Cooked Food | Create Menu Item) with a dashboard layout (like Kitchen page) featuring two clickable cards, a top-right Create button, and sub-views.

---

## Plan

### 1. `desktop/ui/pages/admin/Menu.tsx` — Rewrite

**New structure:**
```
<Heading>Menu</Heading>
<Button "Create Menu Item" />  ← top-right

Dashboard view (default):
  Card: "Today's Cooked Food"      → onClick → view="cooked-food"
  Card: "All Restaurant Menu"       → onClick → view="all-menu"

Sub-views (with Back button):
  view="cooked-food"  → <CookedFoodTable />
  view="all-menu"     → <AllMenuTable />
```

State: `type MenuView = "dashboard" | "cooked-food" | "all-menu"`

### 2. `desktop/ui/components/menu/AllMenuTable.tsx` — New component

**Data:** `getMenus()` → `MenuItem[]`

**Columns (left to right):**
| Details | Name | Category | Price | Stock | Rating | Status | Actions |
|---------|------|----------|-------|-------|--------|--------|---------|

- **Details** — button (far left), opens `MenuDetailDialog`
- **Status** — Available (green) / Unavailable (red) badge based on `isAvailable`
- **Actions** — Edit (opens EditMenuDialog with full MenuForm) + Hide (soft delete via `updateMenuAvailability(id, false)`)

**Features:**
- Search input
- Pagination
- Loading / empty / error states

### 3. `desktop/ui/components/menu/MenuDetailDialog.tsx` — New component

Shows all raw Menu fields in a grid layout:

| Field | Value |
|-------|-------|
| Name | ... |
| Slug | ... |
| Category | ... |
| Brand | ... |
| Price | ... |
| Stock | ... |
| Rating | ... |
| Num Reviews | ... |
| Description | ... |
| Is Featured | Yes/No badge |
| Is Available | Yes/No badge |
| Images | preview or placeholder |
| Banner | preview or placeholder |
| Meal Types | tag list |
| Starch (accompaniment) | name + price or — |
| Vegetable (accompaniment) | name + price or — |
| Created At | formatted date |

### 4. `desktop/ui/components/menu/CreateMenuDialog.tsx` — New component

Wraps the existing `MenuForm` inside a shadcn `Dialog`.

- `CreateMenuDialog` renders `MenuForm` inside `DialogContent`
- Wires `MenuForm.onSaved` → close dialog + refresh tables
- Wires `MenuForm.onCancel` → close dialog
- Strips the `Card` wrapper from MenuForm when rendered inside dialog

### 5. `desktop/ui/types/electron.d.ts` — Add `isAvailable` to `MenuItem`

Already done in previous step.

### 6. `desktop/ui/components/menu/EditMenuDialog.tsx` — Update

The existing `EditMenuDialog` only supports editing `CookedMenuItem` (name, category, price, description). Need to expand it to handle full `MenuItem` editing, or use `CreateMenuDialog` in edit mode.

**Decision:** Reuse `CreateMenuDialog` in edit mode by passing `editId`. The existing `MenuForm` already supports `editId` prop for editing.

---

## Files Changed

| File | Action |
|------|--------|
| `desktop/ui/pages/admin/Menu.tsx` | Rewrite |
| `desktop/ui/components/menu/AllMenuTable.tsx` | **Create** |
| `desktop/ui/components/menu/MenuDetailDialog.tsx` | **Create** |
| `desktop/ui/components/menu/CreateMenuDialog.tsx` | **Create** |
| `desktop/ui/types/electron.d.ts` | Add `isAvailable` |
| `desktop/ui/components/menu/CookedFoodTable.tsx` | No change (reuse as-is) |
| `desktop/ui/components/MenuForm.tsx` | No change (reuse in dialog) |

## Data Flow

```
/admin/menu → Menu (dashboard)
  ├── Card "Today's Cooked Food"
  │     └── CookedFoodTable
  │           └── getCookedMenus() → /api/menu/cooked
  ├── Card "All Restaurant Menu"
  │     └── AllMenuTable
  │           ├── getMenus() → /api/menu
  │           ├── Details → MenuDetailDialog
  │           │              └── getMenuById(id) → /api/menu/:id
  │           ├── Edit → CreateMenuDialog(editId)
  │           │              └── window.electron.menu.update()
  │           └── Hide → updateMenuAvailability(id, false)
  └── Button "Create Menu Item"
        └── CreateMenuDialog
              └── MenuForm → window.electron.menu.create()
```
