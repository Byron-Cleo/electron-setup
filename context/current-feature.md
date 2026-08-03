# Current Feature — Web Interface over WiFi

## Platform

backend

## Status

In Progress

## Goals

- Backend serves the built React app (`dist-react`) as static files so the same UI as the Electron app is reachable in any browser over the LAN
- Any device on the WiFi network opens `http://<server-ip>:3001`, logs in (PIN), views the menu, and updates stock when running low
- SPA fallback serves `index.html` for browser routes (`/admin`, `/store`, `/waiter`) so refresh/deep-links don't 404
- `build:web -- --server <ip>` produces a web bundle whose API base + image origin point at the server IP
- `/api/*` and `/uploads/*` are never swallowed by the SPA fallback

## Notes

- Backend: ESM Express 4 (`backend/app.ts`), binds `0.0.0.0:3001`, open CORS — already network-ready
- Serve `dist-react` statically in `backend/app.ts` after API routes; resolve path robustly (dev cwd = `backend/`, compiled cwd = root)
- `lib/api.ts` already uses `VITE_API_BASE`/`VITE_API_ORIGIN` — no change
- **Critical**: `stores/auth.ts` hardcodes `API_BASE = "http://localhost:3001/api"` → change to `import.meta.env.VITE_API_BASE ?? "http://localhost:3001/api"` or browser login from other devices hits their own localhost
- Electron-only features (printing, printer discovery, saved server-config) unavailable in browser — already guarded
- Verification: `build:web` → start backend → curl `/` (index.html), `/admin` (SPA fallback), `/api/health`, asset path
- Branch: `feature/backend/web-interface-wifi` — **DO NOT delete this branch**

## History

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
