# Menu Tab Redesign — Dashboard with Two Tables + Create Modal

## Goal
Replace the current tab-based Menu page (Cooked Food | Create Menu Item) with a dashboard layout featuring two clickable cards, a top-right Create button, and sub-views.

## Status
Not Started

## Dependencies
- Backend spec: `context/features/backend/menu-tab-redesign.md` — no changes needed, existing APIs cover everything.
- Existing `CookedFoodTable`, `MenuForm`, `EditMenuDialog` components are reused as-is.

## Tasks

### 1. `desktop/ui/pages/admin/Menu.tsx` — Rewrite

Convert from tabs to dashboard layout.

**New state:**
```ts
type MenuView = "dashboard" | "cooked-food" | "all-menu"
```
Default: `"dashboard"`

**Layout:**
```
<Heading>Menu</Heading>
<Button "Create Menu Item" />  ← top-right, opens CreateMenuDialog

Dashboard view (default):
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │  Today's Cooked Food     │  │  All Restaurant Menu     │
  │  View cooked menu items  │  │  View all menu items     │
  └──────────────────────────┘  └──────────────────────────┘
```

- Cards match Kitchen dashboard pattern: clickable, hover effects, transitions
- On card click → switch to sub-view with Back button

**Sub-views:**
- `view="cooked-food"` → `<CookedFoodTable />`
- `view="all-menu"` → `<AllMenuTable />`
- Each sub-view has a `<Button><ArrowLeft /> Back</Button>` at top

**Imports:**
- `ArrowLeft`, `UtensilsCrossed`, `List` from lucide-react
- `CookedFoodTable` from `@/components/menu/CookedFoodTable`
- `AllMenuTable` from `@/components/menu/AllMenuTable`
- `CreateMenuDialog` from `@/components/menu/CreateMenuDialog`

---

### 2. `desktop/ui/components/menu/AllMenuTable.tsx` — New component

**Data:** `getMenus()` from `@/lib/api` → `MenuItem[]`

**Columns (left to right):**

| Details | Name | Category | Price | Stock | Rating | Status | Actions |
|---------|------|----------|-------|-------|--------|--------|---------|

- **Details** — button (far left) with an `Eye` icon, opens `MenuDetailDialog`
- **Name** — `item.name`, font-medium
- **Category** — `item.category`
- **Price** — formatted `KSh {item.price}`
- **Stock** — `item.stock`
- **Rating** — `item.rating` / 5
- **Status** — badge: green "Available" if `isAvailable`, red "Unavailable" if not
- **Actions** — Edit button + Hide button (right-aligned)
  - **Edit** → opens `CreateMenuDialog` in edit mode (`editId`)
  - **Hide** → confirmation dialog → `updateMenuAvailability(id, false)` → removes row from list

**Features:**
- Search input (filter by name, category, brand)
- Pagination via `usePagination`
- Loading state: `"Loading menu items..."`
- Empty state: `"No menu items found."` (or search-specific message)
- Error state: display error message

**State variables:**
```ts
items: MenuItem[]
loading: boolean
error: string
search: string
detailTarget: MenuItem | null
editDialog: { open: boolean; editId: string | null }
hideDialog: { open: boolean; item: MenuItem | null }
hiding: boolean
```

**Data loading:**
```ts
async function loadData() {
  setLoading(true)
  const data = await getMenus()
  setItems(data)
}
useEffect(() => { loadData() }, [])
```

**Refresh:** After edit/hide, call `loadData()` to refresh.

---

### 3. `desktop/ui/components/menu/MenuDetailDialog.tsx` — New component

**Propagates:**
```ts
interface Props {
  open: boolean
  onClose: () => void
  menuId: string | null
}
```

**Data:** `getMenuById(menuId)` from `@/lib/api` → `MenuItem`

**Layout (inside DialogContent, sm:max-w-lg):**

DialogTitle: `"{item.name} Details"`

Two-column grid (`inline-grid grid-cols-[auto_1fr]`) showing:

| Label | Value |
|-------|-------|
| Name | `item.name` |
| Slug | `item.slug` |
| Category | `item.category` |
| Brand | `item.brand` |
| Price | `KSh {item.price}` |
| Stock | `item.stock` |
| Rating | `{item.rating} / 5` |
| Num Reviews | `item.numReviews` |
| Description | `item.description` |
| Is Featured | Yes (amber badge) / No (gray badge) |
| Is Available | Yes (green badge) / No (red badge) |
| Meal Types | tag list of `item.mealTypes` or "—" |
| Starch | `{item.starch?.name}` (`KSh {item.starch?.price}`) or "—" |
| Vegetable | `{item.vegetable?.name}` (`KSh {item.vegetable?.price}`) or "—" |
| Created | `formatDate(item.createdAt)` |

**Loading/error states:** Show loading text while fetching, error text on failure.

**Footer:** Close button.

---

### 4. `desktop/ui/components/menu/CreateMenuDialog.tsx` — New component

**Propagates:**
```ts
interface Props {
  open: boolean
  onClose: () => void
  editId: string | null
  onSaved: () => void
}
```

**Behavior:**
- Wraps `MenuForm` inside a shadcn `Dialog`
- Renders `MenuForm` inside `DialogContent` (no Card wrapper — form is already in a dialog)
- Passes props to MenuForm:
  - `editId` → from dialog prop
  - `onSaved` → calls `onSaved()` parent callback + `onClose()`
  - `onCancel` → calls `onClose()`

**Note:** `MenuForm` is reused **without modification**. When `editId` is null → create mode, when set → edit mode.

---

### 5. `desktop/ui/types/electron.d.ts` — Add `isAvailable` to `MenuItem`

Add `isAvailable: boolean` to the `MenuItem` interface. Already done in prior work.

---

## Data Flow

```
/admin/menu → Menu (dashboard)
  ├── Card "Today's Cooked Food"
  │     └── CookedFoodTable (unchanged)
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

## Files

| File | Action |
|------|--------|
| `desktop/ui/pages/admin/Menu.tsx` | Rewrite |
| `desktop/ui/components/menu/AllMenuTable.tsx` | **Create** |
| `desktop/ui/components/menu/MenuDetailDialog.tsx` | **Create** |
| `desktop/ui/components/menu/CreateMenuDialog.tsx` | **Create** |
| `desktop/ui/types/electron.d.ts` | Add `isAvailable` (done) |
| `desktop/ui/components/menu/CookedFoodTable.tsx` | No change |
| `desktop/ui/components/menu/EditMenuDialog.tsx` | No change |
| `desktop/ui/components/MenuForm.tsx` | No change |
