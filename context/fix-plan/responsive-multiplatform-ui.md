---
plan: responsive-multiplatform-ui
platform: frontend (React 19 / Tailwind v4 / shadcn-ui — desktop/ui only)
status: Not Started → Ready to Execute
---

## Goal
Make the browser-served React app fully responsive so staff can view and operate it on
phones and tablets exactly as they do on the desktop terminals — without changing the
desktop/Electron layout at all. No printing, no PWA, no backend/schema/API changes.

Desktop visual parity is mandatory: every change is gated behind `sm:`/`md:`/`lg:`/`xl:`
prefixes or a mobile-only component. At ≥1024px (`lg`) the UI must render byte-identical
to today.

## Confirmed decisions (from user)
- Scope: **responsive UI only** — no browser printing, no PWA/installable app.
- Admin nav on phones/tablets (below `lg`): **hamburger + slide-in drawer** (shadcn Sheet).
- Waiter order summary on phones: **sticky bottom bar + slide-up cart Sheet**.
- Depth: **all pages**, phased (shells → waiter POS → grids/dialogs → tables → polish).
- Breakpoints: **keep Tailwind v4 defaults** — do NOT redefine in `@theme`.
- Delivery: frontend-only. Merge to `restaurant-build`, then
  `npm run build` → `npm run build:web -- --server same-origin`. **No backend rebuild, no
  `EraevaBackend` restart.** Installed .exe terminals unaffected (own packaged bundle).

## Breakpoint contract (documented, not redefined)
| Token | Width | Device class | Role in this app |
|---|---|---|---|
| base | 0–639px | Phone portrait | Mobile default: drawer nav, single column, stacked waiter cart |
| `sm:` | ≥640px | Phone landscape / small tablet | Two-col forms, waiter detail split |
| `md:` | ≥768px | Tablet portrait | Wider grids/cards; roomier tables |
| `lg:` | ≥1024px | **Desktop switch** | Fixed `w-60` sidebar returns; waiter two-pane returns; aligns with existing `@media (max-width:1024px)` font step-down |
| `xl:` | ≥1280px | Desktop | Waiter category grid 2→3 cols; denser layouts |
| `2xl:` | ≥1536px | Large desktop | **Unused — keep it that way** |

- Mobile-first; `lg:` is the single boundary between mobile/tablet layout and today's
  desktop layout.
- Landscape phones are caught by width alone (≈844px), so the two-pane shells additionally
  pair `lg:` with a min-height guard using the existing Login pattern
  (`[@media(min-width:1024px)_and_(min-height:600px)]:`).
- Note: media-query `rem` resolves against the browser's 16px initial font-size, so
  Tailwind breakpoints stay 640/768/1024/1280 despite the app's 18px `:root`. The 18px root
  only inflates spacing/text utility *values* (e.g. `max-h-20`=90px), not breakpoint positions.

## Diagnosis (current non-responsive hotspots, from full audit)

### P0 — blocks core use on a phone
- `components/admin/AdminLayout.tsx:119` — hard `w-60` sidebar, no drawer. On 390px the main
  column gets ~150px.
- `pages/waiterPos/WaiterMenuGrid.tsx:884` — order-summary column `w-[400px] shrink-0` never
  collapses; `:601` two-pane `flex`; `:638` detail `grid-cols-[2fr_3fr]`.
- `pages/waiterPos/WaiterHeader.tsx:31` / `WaiterLayout.tsx:7` — non-wrapping fixed header,
  `h-screen overflow-hidden` root.
- `components/menu/WastedStockCard.tsx:87` — `<table class="w-full">` with **no** scroll wrapper.
- Login `@media` pattern is good but other shells lack scroll safety on short viewports.

### P1 — degrades tablet/landscape
- Hardcoded `grid-cols-N` with no responsive prefix:
  `components/MenuForm.tsx:362,459,518,679`; `pages/Store.tsx:469,496`;
  `pages/admin/Cashier.tsx:147,1163,1567,2213,2247,2359`; `pages/admin/StockSupplyForm.tsx:194,235`;
  `pages/admin/Reports.tsx:93`; `pages/admin/Menu.tsx:192`; `pages/admin/ShiftManagement.tsx:552`;
  `pages/admin/Users.tsx:393`; `components/admin/StockSupplyEditDialog.tsx:210,251`;
  `components/menu/AccompanimentDialog.tsx:212`; `components/menu/AssignmentModal.tsx:194`;
  `components/shift/ShiftCloseDialog.tsx:771`; `pages/waiterPos/WaiterMenuGrid.tsx:638,871`.
- Dialog bare `max-w-*` overrides defeat the base `sm:max-w-sm` guard
  (`components/ui/dialog.tsx:62`) → overflow <640px: VoidOrdersDialog:67, Customers:136/186/206,
  ShiftManagement:542/624, Cashier:1155/1557/2330, CustomerPickerDialog:95, Store:456/890,
  Kitchen:519/930/1359, CookedFoodTable:269, RequestStockDesign:303, CategoryManager:182,
  DepartmentManager:189, KitchenStockConfig:226, StockSupplies:216, Users:234,
  ShiftCloseDialog:882, ShiftReport:593.
- Tables needing/keeping `overflow-x-auto`: WastedStockCard (missing), AssignedLeftoversTable:134
  + `min-w-[1000px]`, RemainingStockTable:91 + `min-w-[1200px]` (already ok).
- `components/shift/ShiftCloseDialog.tsx:824,837` — fixed 8-col ledger grid.

### P2 — cosmetic
- `pages/Dashboard.tsx:22-23` — fixed `CHART_WIDTH=700`/`CHART_HEIGHT=200` SVG.
- `components/ui/date-picker.tsx:48` `w-[180px]`; `Reports.tsx:416,418` `w-[150px]`.
- `components/shared/BackButton.tsx:12` `px-6 py-6`.
- `components/menu/WastedStockCard.tsx` table (also P0 above).

### Already responsive (leave alone)
`Dashboard.tsx:44`, `Menu.tsx:96`, `Manager.tsx:105`, `CustomerDetail.tsx:35`, `Store.tsx:96`,
`Kitchen.tsx:143`, `Cashier.tsx:444`, `Reports.tsx:333`, `RemainingStockDashboard.tsx:169`,
`MenuStockStatusCard.tsx:177`, `ShiftReport.tsx:154,237,294,382,550`,
`ShiftCloseDialog.tsx:353,430,473,584,585,650`, `Login.tsx` (already done).

## Changes (ready to execute, phased)

### Phase 1 — App shells (P0)
1. **New** `desktop/ui/components/ui/sheet.tsx` — shadcn Sheet (Radix Dialog based, same
   `radix-ui` package already in use). Follows existing ui/ primitive conventions (`cn()`,
   `data-slot`, named exports).
2. `components/admin/AdminLayout.tsx`
   - Add a `lg:hidden` mobile header with hamburger (lucide `Menu`) + logo + avatar.
   - Sidebar `<aside>`: hidden below `lg`; inside the Sheet for `<lg`; static `w-60` at `lg:`.
   - Overlay + close-on-navigate (NavLink `onClick` closes the drawer).
   - Desktop `lg:` markup/classes unchanged.
3. `pages/waiterPos/WaiterHeader.tsx:31` — allow wrap; hide `WaiterDateTime` and username on
   `<sm`; keep logo/title/cart/user-button/logout. Add a height guard for landscape phones.
4. `pages/Login.tsx` / `pages/ServerRecovery.tsx` — confirm vertical scroll on short
   viewports (`overflow-y-auto`); Login already compliant.

### Phase 2 — Waiter ordering (P0)
- `pages/waiterPos/WaiterMenuGrid.tsx`
  - `:601` container → `lg:flex lg:gap-4`; single column below `lg`.
  - `:638` detail grid → `grid-cols-1 sm:grid-cols-[2fr_3fr]`.
  - `:884` order panel `w-[400px] shrink-0` → desktop-only; below `lg` render the order
    summary inside a new **sticky bottom bar + slide-up cart Sheet** (item count + total +
    "View Order" / "Place Order").
  - `:839` button `w-[28%]` → responsive width.
- `pages/waiterPos/ServingPeriodBar.tsx:37-43` — scale period buttons on small screens.
- `components/waiterPos/VoidOrdersDialog.tsx:67` — responsive dialog width.

### Phase 3 — Grids & dialogs (P1)
- Add responsive prefixes to every hardcoded multi-column grid listed in Diagnosis P1
  (base = 1 col, then `sm:`/`md:`/`lg:` restore today's column count).
- Normalize every bare `max-w-*` dialog override to `sm:max-w-*` (or add `w-full`) so the
  base `calc(100%-2rem)` guard holds below 640px; ensure long dialogs have
  `max-h-[85vh] overflow-y-auto`.

### Phase 4 — Tables (P1)
- Wrap `components/menu/WastedStockCard.tsx:87` table in `overflow-x-auto` (min-w on inner
  table only if needed).
- Audit all table sites to ensure a scroll wrapper exists; `components/ui/data-table.tsx:45`
  already has `overflow-x-auto` + `min-w-full`.

### Phase 5 — Polish (P2)
- `pages/Dashboard.tsx:22` SVG → `viewBox` + `w-full h-auto` (responsive).
- `components/shift/ShiftCloseDialog.tsx:824,837` fixed 8-col ledger → responsive/scroll.
- `components/ui/date-picker.tsx:48` + `Reports.tsx:416,418` widths → `w-full sm:w-[…]`.
- `components/shared/BackButton.tsx:12` padding → responsive.

## Files to modify (estimated)
- New: `desktop/ui/components/ui/sheet.tsx`
- Shells: `components/admin/AdminLayout.tsx`, `pages/waiterPos/WaiterHeader.tsx`,
  `pages/waiterPos/WaiterLayout.tsx`, `pages/Login.tsx`, `pages/ServerRecovery.tsx`
- Waiter: `pages/waiterPos/WaiterMenuGrid.tsx`, `ServingPeriodBar.tsx`,
  `components/waiterPos/VoidOrdersDialog.tsx`
- Pages: `Dashboard.tsx`, `admin/Cashier.tsx`, `admin/Reports.tsx`, `admin/Menu.tsx`,
  `admin/Users.tsx`, `admin/ShiftManagement.tsx`, `admin/StockSupplyForm.tsx`, `Store.tsx`,
  `admin/StockSupplies.tsx`
- Components: `MenuForm.tsx`, `menu/*Table.tsx` + dialogs, `admin/*Dialog.tsx`,
  `shift/ShiftCloseDialog.tsx`, `reports/ShiftReport.tsx`, `shared/BackButton.tsx`,
  `ui/date-picker.tsx`

## Verification plan
1. `tsc -b` + `npm run lint` — zero new errors.
2. Local dev servers (backend 3001 + `dev:react:local`), Playwright device matrix:
   **360×740, 390×844, 844×390 (landscape), 768×1024, 1024×768, 1366×768, 1920×1080.**
   - Assert no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`) on
     every primary page.
   - Admin: hamburger opens drawer at `<lg`, closes on nav; fixed sidebar returns at `lg`.
   - Waiter: menu grid + bottom cart bar + Sheet work on phone; two-pane returns at `lg`.
   - Dialogs fit inside the viewport at 390px; tables scroll horizontally, not the page.
3. **Desktop parity:** capture 1366×768 and 1920×1080 screenshots before/after and diff —
   must be unchanged at ≥`lg`.
4. `npm run build` then `npm run build:web -- --server same-origin` (per AGENTS.md build:web
   rule); confirm served UI at `http://localhost:3001/` returns 200.

## Workflow & deployment
1. Branch `feature/admin/responsive-multiplatform-ui` off `restaurant-build`.
2. Implement phases in order; run checks after each phase.
3. Merge to `restaurant-build`, push.
4. SSH server: `git pull origin restaurant-build` → `npm run build` →
   `npm run build:web -- --server same-origin`. **Frontend-only — no backend rebuild, no
   `EraevaBackend` restart.**
5. User verifies on phone/tablet browsers at `http://192.168.100.45:3001`.
6. Update `context/current-feature.md` (Platform: frontend, Status, History entry).

---
Status: Ready to Execute
Branch: `feature/admin/responsive-multiplatform-ui`
Plan reference: `context/fix-plan/responsive-multiplatform-ui.md`



