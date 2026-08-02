# POS Order Printing — Sequential Order Number, USB Receipt, LAN Tickets

## Goal

When a waiter clicks **Place Order** in the POS, the system will: persist the order (with a sequential `orderNumber` and the serving time) to the database, print a **customer receipt** on the USB terminal printer attached to that machine, fan out **kitchen/bar tickets** to the configured LAN printers, then clear the cart, log the waiter out, and return to the login screen — a fresh start for the next customer.

The printer registry (`printers.json`, per-terminal) and the `POST /api/orders` route already exist. This plan adds the missing pieces in three phases.

---

## Current Behavior

- `WaiterMenu.tsx:44` `placeOrder()` only decrements local stock and clears the cart — it never calls `POST /api/orders`
- No `createOrder()` in `@/lib/api.ts`; no `window.electron.order.*` IPC
- `Order` model has no human-friendly sequential number (UUID only)
- `PrinterConfig` (committed) can store USB/LAN printers but cannot yet detect LAN printers, and nothing prints

---

## Phase 1 — Backend: sequential `orderNumber`

### Schema (`backend/prisma/schema.prisma`)

```prisma
model Order {
  id          String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderNumber Int    @unique @default(autoincrement())
  ...
}
```

- Run `npm run db:migrate` (backend) → migration adds `orderNumber` as an auto-incrementing unique column; existing rows get values automatically
- `npm run db:generate`

### Route (`backend/routes/orders.ts`)

- The `POST /` handler already returns the created order with `OrderItem`; `orderNumber` is included automatically via the model
- No other backend change required for Phase 1

### Frontend

- Add `orderNumber` to the `Order` shape in `types/electron.d.ts` (receipt data source)

---

## Phase 2 — USB terminal receipt (customer copy)

### 2a. Frontend: place order → save → print → clear → logout

- `lib/api.ts`: add `createOrder({ userId, items, mealType })` → `POST /api/orders` (electron fallback via new `window.electron.order.create`)
- `WaiterMenu.tsx` `placeOrder()`:
  1. build `items` from `orderItems` (`menuId`, `qty`, `price`, `name`, `slug`, `image`, `starchId`, `vegetableId`, plus starch/vegetable name+price for the receipt)
  2. `await createOrder(...)` with `mealType` = current `mealPeriod`
  3. on success → call print (below) → `clearOrder()` → `logout()`
  4. on error → show error, keep cart
- Preload/IPC: `window.electron.order.create` proxies to backend; `window.electron.print.receipt` (below)

### 2b. Electron main: receipt printer (`receipt.ts`)

- `ReceiptData` shape (single canonical template input):

```ts
interface ReceiptItem {
  name: string
  accompaniments: { name: string; charged: boolean; price: number }[]
  qty: number
  unitPrice: number
  lineTotal: number
}
interface ReceiptData {
  ticket: "customer" | "kitchen" | "bar"
  order: { id: string; number: number; mealType: string; createdAt: string; paymentMethod: string }
  restaurant: { name: string; address?: string; phone?: string }   // hardcoded in template
  waiter: { name: string }
  items: ReceiptItem[]
  totals: { itemsPrice: number; shippingPrice: number; taxPrice: number; totalPrice: number }
  barcode: string
}
```

- **Template** (`receiptTemplate.ts`): pure layout — restaurant header (hardcoded), order # / waiter / date / serving time, item lines (`name`, accomp sub-lines, `qty`, `lineTotal`), totals, thank-you. One template function per ticket kind sharing the layout.
- **Renderer**: turn `ReceiptData` → HTML receipt (80mm, ~72mm printable width, monospace-friendly). Built into the print handler.
- **Print handler** (`printer:print-receipt`): create a hidden `BrowserWindow`, load the receipt HTML, `webContents.print({ silent: true, deviceName })` where `deviceName` comes from the USB printer in `printers.json` (role `customer`). Close the window after print.

### 2c. Config lookup

- `printers.ts` gains `findPrinterByRole("customer")` → returns the USB `deviceName`; `print.receipt` reads `printers.json` at print time (no stale cache).

---

## Phase 3 — LAN scanner + kitchen/bar templates

### 3a. LAN printer detection (Electron main)

- `lanScanner.ts`: read local subnet from `os.networkInterfaces()`; concurrently TCP-probe every address for **port 9100** open (the ESC/POS signature); return `{ host, port, reachable }[]` with a short timeout
- IPC `printer:scan-lan` → returns detected hosts
- `PrinterConfig` dialog: **"Scan for LAN Printers"** button under LAN — lists detected hosts, picking one fills IP Address + Port

### 3b. ESC/POS builder + LAN printing

- `escpos.ts`: minimal pure-JS ESC/POS builder — `ESC @` init, `ESC a 1` center, `GS !` double size, `ESC E` bold, `GS V 66` cut, text wrap at 32 cols (Font A)
- LAN send: `net.connect(port, host)` → write bytes → drain → close
- `printer:print-receipt` dispatches by printer `transport`: USB → Chromium print path; LAN → ESC/POS over TCP 9100

### 3c. Kitchen / bar templates

- **Kitchen ticket**: no prices, double-size item names, prominent serving time + order number (cooks read from distance)
- **Bar ticket**: filtered to beverage lines only; same layout as kitchen
- `placeOrder()` fans out: customer receipt → USB printer, kitchen ticket → all LAN printers with role `kitchen`, bar ticket → LAN printers role `bar`

---

## Files Changed

| File | Action | Phase |
|------|--------|-------|
| `backend/prisma/schema.prisma` | Update — add `orderNumber` | 1 |
| `backend/prisma/migrations/*` | New migration | 1 |
| `backend/routes/orders.ts` | Verify `orderNumber` returned | 1 |
| `desktop/ui/types/electron.d.ts` | Update — `Order` shape, `ElectronAPI.order.create`, `ElectronAPI.print.receipt`/`scanLan` | 1–3 |
| `desktop/ui/lib/api.ts` | Update — `createOrder()` | 2 |
| `desktop/electron/preload.cts` | Update — `order.create`, `print.receipt`, `printer.scanLan` | 2–3 |
| `desktop/electron/ipc-handlers.ts` | Update — `order:create` proxy | 2 |
| `desktop/electron/receipt.ts` | **Create** — `ReceiptData`, template, HTML renderer, print handler | 2 |
| `desktop/electron/receiptTemplate.ts` | **Create** — hardcoded restaurant header + ticket layouts | 2–3 |
| `desktop/electron/escpos.ts` | **Create** — ESC/POS byte builder + TCP send | 3 |
| `desktop/electron/lanScanner.ts` | **Create** — port 9100 subnet scan | 3 |
| `desktop/electron/printers.ts` | Update — `findPrinterByRole()`, `printer:scan-lan` | 2–3 |
| `desktop/electron/main.ts` | Update — register handlers | 2–3 |
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | Update — real `placeOrder()` flow | 2 |
| `desktop/ui/components/admin/PrinterConfig.tsx` | Update — LAN scan button + results | 3 |

---

## Migration

**Phase 1 only:** add `orderNumber Int @unique @default(autoincrement())` to `Order` → `prisma migrate dev`. Phases 2–3 are application-side, no schema changes.
