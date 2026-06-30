# Admin Dashboard — Layout Design & Navigation Shell

> Full specification for the admin dashboard layout with header, sidebar, main content area, and footer.

---

## Architecture

### Layout Structure

```
┌─────────────────────────────────────────────┐
│                  Top Header                  │
├──────────┬──────────────────────────────────┤
│          │                                  │
│  Sidebar │         Main Content             │
│          │                                  │
│  • Users │                                  │
│  • Menu  │                                  │
│  • Kitchen│                                  │
│  • Store │                                  │
│  • Cashier│                                  │
│          │                                  │
├──────────┴──────────────────────────────────┤
│                  Footer                      │
└─────────────────────────────────────────────┘
```

### Navigation (React Router)

All routes nested under `/admin/*`:

```
/admin              → Dashboard (stats overview)
/admin/users        → Users management page (future)
/admin/menu         → Menu management page (future)
/admin/kitchen      → Kitchen orders view (future)
/admin/store        → Store inventory page (future)
/admin/cashier      → Cashier / billing page (future)
```

---

## Files Created/Modified

| Layer | File | Change |
|---|---|---|
| Layout | `desktop/ui/components/admin/AdminLayout.tsx` | **Create** — Shell with header, sidebar, main, footer |
| Layout CSS | (inline Tailwind in component) | Styling via Tailwind brand tokens |
| Dashboard | `desktop/ui/pages/Dashboard.tsx` | **Rewrite** — Replace placeholder with full layout + nested routes |
| Sidebar nav | (part of AdminLayout) | Links for Users, Menu, Kitchen, Store, Cashier |
| Route config | `desktop/ui/App.tsx` | Update `/admin/*` to render AdminLayout with nested routes |
| Placeholder pages | `desktop/ui/pages/admin/Users.tsx` | **Create** — Placeholder for Users |
| Placeholder pages | `desktop/ui/pages/admin/Menu.tsx` | **Create** — Placeholder for Menu |
| Placeholder pages | `desktop/ui/pages/admin/Kitchen.tsx` | **Create** — Placeholder for Kitchen |
| Placeholder pages | `desktop/ui/pages/admin/Store.tsx` | **Create** — Placeholder for Store |
| Placeholder pages | `desktop/ui/pages/admin/Cashier.tsx` | **Create** — Placeholder for Cashier |

---

## Design — Sections (from screenshot analysis)

### 1. Top Header
- Full-width bar at the top, height ~60px
- Contains: app logo/title on the left, user name on the right, logout button
- Background: `#F5F9FF` (very light blue-white), text: `#333333`
- Clean, minimal — no dark bg
- Padding horizontal: 24px

### 2. Sidebar
- Vertical navigation panel on the left, width ~250px
- Background: `#FFFFFF` (white), text: `#666666` (medium gray)
- Icons + text links: **Users**, **Menu**, **Kitchen**, **Store**, **Cashier**
- Active link background: `#0087D4` (primary accent), text: white
- Hover: subtle bg change
- Nav items have 16px padding, rounded corners, icon size ~18px

### 3. Main Content
- Background: `#FAFBFE` (very light gray)
- Right of sidebar, fills remaining space
- Renders nested routes via `<Outlet />`
- Cards: white bg, rounded corners, subtle border `#E5E5E5`, padding 24px
- Dashboard default view shows stat cards (3–4 columns) + chart area

### 4. Cards (Dashboard)
- Background: white, border: `#E5E5E5`, rounded corners (8px)
- Size: ~300px wide × 180px tall
- Shadow: subtle (small box-shadow or elevation)
- Content: icon/emoji + label + large number value + optional trend indicator
- Layout: 3 or 4 columns in a grid

### 5. Chart Area
- Card containing a line chart
- Chart line color: `#0087D4` (primary accent)
- Date range label above chart
- Axes labels in muted text `#999999`

### 6. Footer
- Full-width bar at the bottom, height ~40px
- Background: `#FAFBFE` matching main content
- Copyright text, small (12px), muted `#999999`

---

## Key Decisions

- Layout uses React Router's `<Outlet />` for nested route rendering inside AdminLayout
- Sidebar links use `<NavLink>` from react-router-dom for active state styling
- No new dependencies — Tailwind CSS, lucide-react icons for sidebar icons
- All brand colors from `@theme inline` in `index.css`
- Placeholder pages are minimal — `<h1>Page Name</h1>` + `<p>Coming soon</p>`
- AdminLayout wraps all admin sub-routes, not just Dashboard
- Logout button in header calls `useAuthStore.getState().logout()`

---

## Sidebar Navigation Items

| Label | Path | Icon (lucide) |
|---|---|---|
| Users | `/admin/users` | `Users` |
| Menu | `/admin/menu` | `UtensilsCrossed` |
| Kitchen | `/admin/kitchen` | `ChefHat` |
| Store | `/admin/store` | `Warehouse` |
| Cashier | `/admin/cashier` | `Receipt` |
