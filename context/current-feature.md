# Current Feature

## Platform

fullstack

## Status

Complete

## Goals

- Define Day/Night shift with correct meal period times
- Track opening/closing plate stock per shift (auto + manual snapshots)
- Generate shift sales reports broken down by meal period (Breakfast/Lunch for Day, Dinner for Night)
- Allow cashier to void orders within current shift only
- Add costPrice to StockSupply for production vs sales analysis
- Auto-close shifts at defined times as backup
- Track drift between auto-close and manual close times

## Notes

- Phase 4 of 12 — Shift Management feature COMPLETE
- All backend APIs and frontend UI implemented
- Meal period times updated: Breakfast 5:30AM-11:59AM, Lunch 12PM-5:29PM, Dinner 5:30PM-5:29AM
- Void functionality: cashier can void orders, waiter sees notification card
- Shift API: open, close, auto-close, reports
- costPrice added to StockSupply
- Full spec: context/features/shift-management.md
- Plan: context/features/shift-management-plan.md



## History

### frontend - 2026-08-11 — Waiter Two-Column Menu + Receipt Footer Branding
- Replaced the waiter 3-column menu screen with a 2-column layout: serving-period bar on top + dynamic first column (listing ↔ detail) + order column (400px, unchanged) on the right
- New `ServingPeriodBar.tsx` lists all periods (BREAKFAST/LUNCH/DINNER/DESSERT/BEVERAGE); closed periods disabled/dimmed, current highlighted; clicking a different period navigates, clicking the active period while in detail returns to listing — the period bar is the single navigation mechanism (no back button in detail view or grid top; BackButton kept only in error/empty states)
- Listing (State A) groups foods for the active period by category — heading + grid of cards (thumbnail, name, price, plates badge), all categories visible + scrollable, sold-out cards dimmed; clicking a card mounts the existing detail view (State B) in the same wide first column
- Receipt footer branding: "Apydy Technologies" bold below "POS Designed and Build By:", city under the address, QTY/ITEM/PRICE/TOTAL item table header, "Buy Goods Till No: 994296", services wording fixed to "Supermarket Systems" and "Mobile Development"; company name removed from the receipt header
- Login PIN slots neutral (no green border/pulse) until the first digit is keyed
- Verified: receipt HTML rendered + screenshot, `tsc -b` + eslint clean
- Branch: `feature/waiter/two-column-menu` (merged to main as `0806b53`)

### frontend - 2026-08-10 — Menu Image Uploads + LUNCH/DINNER Accompaniment Validation
- Menu item images are now uploaded from the Menu create/edit form (`MenuForm`) via `POST /api/menu/upload` (multer → `backend/uploads/menu-items/`), served statically by Express, with the DB `image_path` migrated from old public paths by `backend/db/migrate-menu-images.ts`
- `lib/api.ts` `menuImageUrl()` is the single source of truth for resolving menu image paths (dev server vs built app) — used in the menu list, detail dialog, form preview, and the Login page carousel sample meals
- LUNCH/DINNER menus now require BOTH a starch and a vegetable accompaniment: frontend `superRefine` in `MenuForm` shows inline errors on the two selects (with `[invalid]` state) and conditional red `*` asterisks driven by `useWatch`; backend rejects with 400 on `POST /api/menu` and `PUT /api/menu/:id` (PUT falls back to existing row `starchId`/`vegetableId`/`mealTypes` so partial updates like stock-only from the Plate Assignment dialog still pass)
- Verified end-to-end in browser: image upload renders in form, conditional asterisks appear when LUNCH/DINNER is checked, save without accompaniments shows both inline errors, edit-dialog prefill of starch/vegetable confirmed working on clean page loads; `npm run build` + backend tsc pass, changed files lint-clean
- Branch: feature/admin/menu-image-uploads (merged to main as `d97b3b6`)

### frontend - 2026-08-10 — Waiter Order: Multiple Variant Lines per Food
- Order lines are now keyed by the full combination `menuItem.id|starch.id|vegetable.id` instead of `menuItem.id` alone, so the same dish can appear on multiple lines with different served-with/vegetable combinations (e.g. Beef+Rice, Beef+Chapati, Beef+Ugali) in one order/receipt
- `addToOrder` increments quantity only when the exact same combination is added again; different combos each get their own line; plain items (no accompaniments, incl. beverages) get their own line too
- `updateQuantity`/`removeItem`/`updateAccompaniments` operate by variant key; editing a line in the detail panel re-keys it; `WaiterMenuGrid` order rows use the variant key as React key
- No backend change — order API already accepts multiple same-food lines; localStorage payloads from before are split apart on the next add pass
- Branch: `feature/waiter/multi-variant-order-lines` (merged to main as `9861c16`)

### frontend - 2026-08-07 — Single NSIS Installer + Branded Icon + Pre-Login Server IP Recovery
- Phase 1 (Windows packaging): dropped the portable target so `npm run build:win` produces exactly ONE NSIS installer .exe; rebranded to "Eraeva POS System" (productName, shortcutName, `index.html` title); generated `build/icon.ico` (multi-size from `eraeva-logo.png`) with `scripts/icon.mjs` + `npm run icon`; NSIS `runAfterFinish: true` + installer/uninstaller/header icons
- Verified by building the Windows installer on Mac — `release/Eraeva POS System-0.0.0-win-x64.exe`, icon embedded in the exe
- Phase 2 (server IP recovery): new `ConnectionGate` in `App.tsx` probes `/health` before login — reachable → Login, unreachable → new `ServerRecovery` screen (branded, IP input, Reconnect / Try Again); `lib/api.ts` browser-mode `testServerConnection()` now does a real probe and honors saved server config; failed reconnects roll the config back so a temporary outage is never overwritten
- All flows verified in browser: happy path → login, dead IP → recovery screen, correct IP → reconnect → login, bad IP → friendly error + rollback, Try Again → re-probe
- Branch: feature/admin/win-installer-branded-icon (merged to main as `ee4d938`)

### frontend - 2026-08-04 — Settings guide step number badges
- Added step number badges (01, 02, 03…) to the Settings guide cards in `Manager.tsx`, positioned inside the card top-right corner so they aren't clipped
- Badge placement fixed in a follow-up commit (moved inside card bounds) — verified in browser, eslint clean on `Manager.tsx`
- Branch: `feature/admin/guide-numbering` (merged to main as `bd75693`)

### frontend - 2026-08-03 — Pre-Deployment Checklist guide
- New admin-only card "Pre-Deployment Checklist (Before You Travel)" (`PreDeploymentGuide.tsx`, icon Luggage) placed first among the setup guides in `Manager.tsx`
- 6 sections: build & test the Windows installer, test printers on Windows, run one order end-to-end, download everything in advance, gather the hardware, prepare the restaurant data — plus a "Why it matters" and "Ready to travel when…" checklist
- Verified in browser: card renders first among guides with all 6 sections
- Branch: `feature/admin/pre-deploy-checklist` (merged to main as `7535ef7`)

### frontend - 2026-08-03 — PostgreSQL guide fresh-clone patch
- `PostgresGuide.tsx` step 4 now covers a fresh clone: create `backend/.env` if missing (file is not in the repo — exact create steps), add `DATABASE_URL` with the postgres password, then run `npm run db:generate` BEFORE `npm run db:push` (generated Prisma client is not committed either)
- Checklist updated to reference generate + push
- Verified in browser: .env-create text and db:generate code block render
- Branch: `fix/postgres-guide-fresh-clone` (merged to main as `73757b0`)

### frontend - 2026-08-03 — Deployment setup guides + admin-only Settings
- 5 new admin-only guide cards in Settings (`Manager.tsx`), in deployment order: Install Node.js (Server) (`NodeJsGuide.tsx`), Build the Windows Installer (`BuildInstallerGuide.tsx`), Enter Restaurant Data (`DataEntryGuide.tsx`), Install Printer Drivers (`PrinterDriversGuide.tsx`), Final Network Test (`NetworkTestGuide.tsx`) — each follows the existing SectionCard/StepList guide pattern with a "how it works" card + troubleshooting checklist
- Cards restructured with an `adminOnly` flag; manager sees only the 3 config cards (Restaurant Departments, Kitchen Stock Config, POS Printer Config), all 9 server/guide items hidden; `resolvedView` guard prevents manager from opening an admin-only view
- Route guard in `App.tsx`: `/admin/settings` wrapped in `ProtectedRoute role={["admin","manager"]}` — store/kitchen/waiter can no longer reach Settings even by typing the URL (redirect to login)
- Verified in browser: admin sees all 12 cards in order, guides render, manager sees 3, store user direct-nav to /admin/settings is bounced
- Branch: `feature/admin/setup-guides` (merged to main as `7109682`)

### backend - 2026-08-03 — Manager role with restricted Settings cards
- New role `manager` added across the stack: `backend/routes/users.ts` `ALLOWED_ROLES`, `User`/`AdminUserRole` types in `electron.d.ts`, `Login.tsx` redirect, `/admin` + kitchen `ProtectedRoute` in `App.tsx`, `AdminLayout` nav items, `Users.tsx` role badge/label (teal "Manager"), and `db:create-admin` demo account (manager@eraeva.com, PIN 5555)
- Manager has full admin access everywhere EXCEPT Settings: the four server-related cards (Server Connection, Server & Installation Guide, Web Interface Setup (WiFi), PostgreSQL Setup Guide) are hidden via `MANAGER_HIDDEN_VIEWS` filter in `Manager.tsx` (with `resolvedView` guard) — managers can still use Restaurant Departments, Kitchen Stock Config, POS Printer Config, and all other admin pages (Users, Menu, Cashier, Dashboard, Store, Kitchen)
- Verified in browser: admin sees all 7 Settings cards; manager sees 3 and still accesses Users; backend tsc + eslint clean
- Branch: `feature/admin/postgres-guide` (merged to main as `940c535`)

### frontend - 2026-08-03 — PostgreSQL Setup Guide in Settings
- New Settings card `PostgresGuide.tsx` ("PostgreSQL Setup Guide", icon Database) registered in `Manager.tsx` — 5 read-and-do sections matching the Server Installation Guide style: 1) install PostgreSQL 13+ (17 recommended) from postgresql.org, keep port 5432, note the postgres password, 2) keep it running (services.msc → service Running, Startup type Automatic), 3) create `eraevadb` via pgAdmin or `psql -U postgres` + `CREATE DATABASE eraevadb`, 4) connect backend by setting `DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/eraevadb"` in `backend/.env` + `npm run db:push --prefix backend`, 5) verify with `npm run dev:backend` (connects, port 3001)
- Includes "Why this matters" card (database stores all data, runs as background service, backup via pgAdmin) and troubleshooting checklist (service running, correct password/port/name, firewall TCP 5432, db:push run)
- Verified in served web app: all 5 sections + code blocks render
- Branch: `feature/admin/postgres-guide` (merged to main as `940c535`)

### backend - 2026-08-03 — User Management (CRUD)
- `backend/routes/users.ts` mounted at `/api/users`: GET list (serialized without PIN hash; `hasPin` flag), POST create (name/email required, PIN ≥ 4 chars hashed with bcrypt, role whitelist, email uniqueness → 409), PUT update (optional PIN reset only re-hashes on change, role/name/email/isActive edits, last-active-admin guard), DELETE (409 guard on Order/StockRequest/StockFulfillment/CookingRecord history + last-admin guard)
- `backend/package.json` `db:create-admin` script (was a bare script) — one-time bootstrap of the first admin + demo staff on a brand-new database
- `lib/api.ts` `getUsers/createUser/updateUser/deleteUser`; `AdminUser`/`AdminUserCreateData`/`AdminUserUpdateData` types in `electron.d.ts`
- `pages/admin/Users.tsx` full management page (was "Coming soon"): DataTable with search + pagination, role/status badges, PIN set indicator, Add/Edit dialog (role select, PIN reset, active checkbox), Delete confirm, Deactivate/Activate toggle, "(you)" self-marker with self-protection
- Server & Installation Guide: new step 2 "Create the first admin" (`npm run db:create-admin --prefix backend`), steps renumbered
- Verified end-to-end in browser: create → duplicate email blocked → edit (role + PIN reset) → login with new PIN ✓ / old PIN rejected ✓ → deactivate blocks login → delete; last-admin + delete guards via curl; eslint clean on new files, backend tsc + vite build pass
- Branch: feature/admin/user-management

### frontend - 2026-08-03 — Web Interface Setup Guide in Settings
- Settings → "Web Interface Setup (WiFi)" card (`WebInterfaceGuide.tsx`): read-and-do flow matching ServerInstallationGuide — 1) `npm run build:web -- --server http://<ip>:3001`, 2) start backend (`npm run dev:backend`), 3) find IP (`ipconfig`), 4) open `http://<ip>:3001` from any device + login, 5) what works in browser vs desktop-only (printing). Includes "How it all fits together" card + troubleshooting checklist (Windows firewall port 3001 inbound rule, backend running, exact URL with port)
- Registered card in `Manager.tsx` (view `web-interface-guide`); verified in served web app — card renders on Settings and the full guide opens cleanly
- Merged to main: `feature/admin/web-interface-guide` — **DO NOT DELETE this branch**

### backend - 2026-08-03 — Web Interface over WiFi (serve built frontend from backend)
- `backend/app.ts` serves `dist-react` statically + SPA fallback (GET, excluding `/api/*` and `/uploads/*`) so the same UI as Electron runs in any browser at `http://<server-ip>:3001`
- Robust `dist-react` path resolution across run contexts (dev cwd = `backend/`, compiled cwd = root)
- `scripts/build-web.mjs` + `build:web` npm script: `vite build --base=/` with `VITE_API_BASE`/`VITE_API_ORIGIN` baked to the server IP (absolute base so deep links resolve `/assets/*` from the server root)
- Fixed `desktop/ui/stores/auth.ts` hardcoded `API_BASE` → `import.meta.env.VITE_API_BASE ?? "http://localhost:3001/api"` (browser login on other devices was hitting their own localhost)
- Verified end-to-end via browser on `http://localhost:3001`: served app loads, PIN 1234 login → admin dashboard renders, deep link `/admin/menu` serves the app (no MIME/404), `/api/*` + `/health` + uploads untouched, `/admin` deep link via SPA fallback returns 200 text/html
- Branch: `feature/backend/web-interface-wifi` — **DO NOT DELETE this branch**

### frontend - 2026-08-03 — Server Config for Network Terminals
- Electron main `server-config.ts`: reads/writes `server-config.json` in `app.getPath("userData")` (per-terminal, mirrors `printers.ts` pattern); `getApiBase()` precedence = config file → `API_BASE` env → baked default; `testServerConnection()` pings `/health` (5s timeout)
- IPC handlers `server-config:get/save/test/get-api-base` registered in `main.ts`; preload exposes `window.electron.serverConfig.*`; `ServerConfig`/`ServerStatus` types added to `electron.d.ts`
- `ipc-handlers.ts` apiFetch now resolves the base at runtime via `getApiBase()` instead of a module-level constant, so a saved config takes effect without rebuild
- `lib/api.ts`: `getServerConfig`/`saveServerConfig`/`getServerApiBase`/`testServerConnection` with localStorage fallback (`eraeva.server-config.v1`) for browser dev mode
- Settings → "Server Connection" card (`ServerConfig.tsx`): IP/URL input (accepts bare IP, IP:port, or full URL → normalized), live resolved API endpoint display, Test Connection with Connected/Unreachable status badge, Save
- Settings → "Server & Installation Guide" card (`ServerInstallationGuide.tsx`): linear read-and-do flow — 1) start server (`npm run dev:backend`), 2) find IP (`ipconfig`), 3) build Windows installer the easy way (`npm run build:win:network -- --server http://IP:3001` → `release/`), 4) install on terminals, 5) connect via Settings → Server Connection, 6) set up printers (USB auto-detect / LAN by IP). Includes code blocks, "How it all works", and a can't-connect checklist (firewall port 3001, backend running, IP correct)
- `scripts/build-network.mjs` now bakes the server URL into `dist-electron/server-config.js` (DEFAULT_API_BASE) instead of `ipc-handlers.js`; verified end-to-end (patch applied, artifacts restored to localhost)
- Verified: `transpile:electron` + `vite build` pass, eslint clean on all touched files (pre-existing `main.ts:22` empty-catch warning left untouched)
- Branch: feature/cashier/order-list (uncommitted)

### frontend - 2026-08-02 — POS Order Printing (Phase 3: Receipt Preview)
- "Preview Receipt" button below "Place Order" in the waiter POS order summary; dialog renders the exact customer receipt HTML via iframe `srcDoc`
- IPC `printer:preview` in `receipt.ts` returns the same `templateFor(data)(data)` HTML as `printer:print-receipt` — single source of truth, print == preview
- `GET /api/orders/count` returns the next order number used by the preview; previews persist nothing (DB count verified unchanged)
- Code 128 barcode (start 104 / checksum mod 103 / stop 106) as inline SVG encoding the order number; width computed from module count so bars are never clipped
- Receipt header now shows "Branch: Airport" below the restaurant name; centered footer below the barcode: "POS Designed and Build: Apydy Technologies", "Tel: 0701315250", "Hotel Systems, Suparket Systems, Web Design, Mobile"
- `ReceiptData.restaurant` extended with optional `branch`/`tel`/`poweredBy`/`services`; electron template and renderer (`electron.d.ts`) types kept in sync
- Verified: Code 128 round-trip decode for 1/7/42/123456; live preview renders centered header/footer; electron `tsc -b` + eslint pass
- Branch: feature/waiter/receipt-preview (merged to main, 2026-08-02)

### frontend - 2026-08-02 — POS Order Printing (Phase 2: USB customer receipt + printer status)
- `placeOrder()` in `WaiterMenu` creates the order via `POST /api/orders`, prints a customer receipt, clears the cart, and logs out
- Receipt templates (customer/kitchen/bar, 80mm) in `desktop/electron/receiptTemplate.ts`; print handler in `receipt.ts` via hidden BrowserWindow silent `webContents.print`
- Printer registry with USB/LAN transport + `printer:check-status` IPC: USB matched against OS printer list (`getPrintersAsync`), LAN probed with a TCP connect (default port 9100)
- `PrinterConfig` table now has a live Status column: green Online / red Offline with reason; statuses refresh on load/add/delete
- `createOrder`/`printReceipt`/`checkPrinterStatus` API helpers + ElectronAPI typing in `electron.d.ts`
- Verified: LAN probe reachable/unreachable/timeout behavior; status column renders green/red via computed styles; E2E order #1 persisted and cleaned up
- Branch: feature/waiter/printer-template (merged to main, 2026-08-02)

### backend - 2026-08-02 — POS Order Printing (Phase 1: orderNumber)
- Added `orderNumber Int @unique @default(autoincrement())` to `Order` model; created + applied migration `20260802120000_add-order-number` (SERIAL column + unique index)
- Repaired corrupted `20260729154800_initial_schema/migration.sql` (regenerated valid SQL via `prisma migrate diff --from-empty`), re-synced `_prisma_migrations` checksum, fixed pre-existing `Menu.isAvailable` default drift (DB → `true`) to unblock shadow-DB migration runs without reset
- Regenerated Prisma client; verified `POST /api/orders` returns `orderNumber` (tested via curl + tsx script)
- Branch: feature/waiter/pos-order-printing

### frontend - 2026-08-02 — Admin POS Printer Config
- Added "POS Printer Config" third card to Settings (`AdminManager`) opening a new `PrinterConfig` component
- `PrinterConfig`: DataTable of configured printers + Add/Edit dialog with Name, Connection Type (USB/LAN radio), USB → detected-printers dropdown + Device Name, LAN → IP + Port (default 9100), Role (Customer/Kitchen/Bar); Delete with confirm
- Electron main `printers.ts`: reads/writes `printers.json` in `app.getPath("userData")` (per-terminal config); IPC handlers `printer:get-config`, `printer:save-config`, `printer:list-devices` (via `webContents.getPrintersAsync()`)
- Preload exposes `window.electron.printer.*`; `PosPrinter`/`PosPrinterConfig` types added to `electron.d.ts`
- `lib/api.ts`: `getPrinterConfig`/`savePrinterConfig`/`listPrinterDevices` with localStorage fallback (`eraeva.printers.v1`) for browser dev mode
- Branch: feature/admin/pos-printer-config

### frontend - 2026-08-01 — Waiter Order Cart Persistence
- Dynamic 3-column `WaiterMenuGrid`: category list → detail panel (image gallery + served-with/vegetable radio cards) → current order column
- Image↔accompaniment matching by filename; gallery thumbnails drive selection and selection re-syncs the active gallery image
- Starch/vegetable persisted per order line in localStorage (`eraeva.waiterOrder.v1`, keyed by waiter); order lines intact across menu switches and app restarts
- Clicking an order line loads its stored config; editing an ordered item's accompaniments updates the stored line live via `updateAccompaniments`
- Vegetable options split Free/Charged in one radio group; paid vegetable added to line total; live total in footer
- shadcn `RadioGroup` primitive added with red checked indicator; selected accompaniment cards get red border/highlight
- Add to Order button moved below the details as a centered red section (20% width); menu detail layout `2fr_3fr`; order column 400px
- Meal period shown in nav bar near login time; removed content-area heading; trimmed layout padding
- Branch: feature/waiter/order-cart-persistence (merged to main, 2026-08-01)

### frontend - 2026-07-31 — Waiter Order Cart Persistence
- `WaiterOrderContext` (`WaiterOrderProvider` + `useWaiterOrder`) wraps the waiter outlet; cart survives navigation across periods and app restarts (localStorage `eraeva.waiterOrder.v1` keyed by `user.id`, invalid payload ignored)
- Extracted reusable 3-column `WaiterMenuGrid` (category list with plates badges → item detail + STARCH/VEGETABLE accompaniment chips → order summary with per-line accomp sub-rows and Free/+KSH labels)
- Order lines capture free + paid accompaniments; paid accompaniment adds to line price (Decimal prices from API are strings — coerced with `Number()` in `linePrice`)
- Quantity capped at remaining plates; Sold Out at 0 (badge, detail text, disabled button); backend already filters `stock > 0`
- `placeOrder()` decrements local stock per line (Phase 1) and clears the cart
- Header cart-count badge shown when cart non-empty
- `getMenuByMealType()` added to `@/lib/api.ts`; `MenuItem.availablePlates?` + `OrderAccompaniment`/`OrderLineItem` added to `electron.d.ts`
- Bugs fixed during verification: Decimal-as-string price concatenation in `linePrice`; accompaniment clobbering when re-adding an existing line
- Branch: feature/waiter/order-cart-persistence

### frontend - 2026-07-31 — Menu Create/Edit — Meal Type + Accompaniment
- Updated `MenuCreateData` type with `mealTypes[]`, `starchId`, `vegetableId`
- Added checkbox group for meal periods (BREAKFAST/LUNCH/DINNER/DESSERT/BEVERAGE) sorted by sortOrder
- Added starch accompaniment dropdown (filtered STARCH) and vegetable accompaniment dropdown (filtered VEGETABLE), each with "None" option
- Updated Zod schema to require at least one meal type
- Meal types and accompaniments fetched on mount via `getMealTypes()` and `getAccompaniments()`
- Edit mode pre-populates meal types and accompaniment selections from fetched item
- Added `getMealTypes()` API function with Electron IPC fallback
- Branch: feature/frontend/menu-create-mealtype-accompaniments

### backend - 2026-07-31 — Menu Create/Edit — Meal Type + Accompaniment
- Added `serializeMenu()` helper for consistent menu response shape
- Updated `POST /api/menu` to accept `mealTypes[]`, `starchId`, `vegetableId` with `$transaction` (create menu → createMany MenuMealType → return with includes)
- Updated `PUT /api/menu/:id` to accept same fields with `$transaction` (update menu → deleteMany + createMany MenuMealType → return with includes)
- Validated mealTypes against `ServiceTime` enum on both POST and PUT
- Refactored `GET /:id` to use `serializeMenu()` helper
- Branch: feature/backend/menu-create-mealtype-accompaniments

### backend - 2026-07-31 — Menu Meal Period Time-Based Filter (frontend-only)
- Created shared `lib/mealPeriod.ts` utility with time-slot logic + dev toggle
- Refactored `WaiterPOS.tsx` to use the shared utility
- Added meal period filter bar (Now Serving / Closed) to `AllMenuTable.tsx`
- Filter menu items by selected period's `mealTypes`
- Live clock updates every 60s
- Dev toggle (`TIME_FILTER_ENABLED`) to bypass time restrictions during development
- Branch: feature/admin/meal-period-time-filter

### frontend - 2026-07-30 — Menu Status Badges + Filter Tabs
- Added computed status column (Unavailable / Selling Now / Sold Out) in AllMenuTable
- Added 4 filter tabs (All / Unavailable / Selling Now / Sold Out) with count badges
- Changed Unavailable color to amber/brown; all active backgrounds at /60 opacity

### backend - 2026-07-30 — Menu Status Auto-Availability Fix
- Removed `data.isAvailable = Number(stock) > 0` from menu.ts PUT route
- isAvailable now purely manual toggle

### frontend - 2026-07-29 — Menu Tab Redesign
- Replaced tab-based Menu page with dashboard layout featuring two clickable cards
- Created `AllMenuTable`, `MenuDetailDialog`, `CreateMenuDialog`, `BackButton`
