---
plan: cashier-receipt-reprint
platform: frontend + electron (no backend changes)
status: Ready to Execute
---

## Goal
Two coupled updates to the customer receipt:

1. **Reprint from the cashier's orders table** — every order row in the **All Shifts orders table only** (the view opened by clicking the "All Shifts" card in Orders, i.e. `OrdersView` with `shiftType === undefined` — all its tabs) gets a **Print** button beside **Details**, so the cashier can re-issue any receipt (paid, unpaid, or voided) on demand, giving the customer one copy and keeping one for the restaurant. **Per-shift scoped order tables get no Print button.** Reprints are stamped **REPRINT COPY**; the original waiter print stays unmarked.
2. **Bigger customer-receipt fonts** — raise every font size on the *customer* receipt so normal text sits at the prominence today's Total has, and bold text steps up again (the "+5" concept, expressed in each renderer's own unit). No printer settings are touched — only the font sizes inside the existing receipt.

## Current behavior (verified in code)
- Receipts print **once, by the waiter at order placement**: `desktop/ui/pages/waiterPos/WaiterMenu.tsx:146-159` (`printBestEffort`) → `printReceipt()` (`desktop/ui/lib/api.ts:796-808`) → IPC `printer:print-receipt` → `desktop/electron/receipt.ts:513-527`.
- Cashier pay confirms (`Cashier.tsx:1900-1937` batch, `:2303-2322` single) never print; **no reprint exists anywhere** (grep `reprint` → 0 hits).
- Orders table: `Cashier.tsx` `OrdersView` (730-1256); columns defined at `:245-310`; row cell rendering `renderCell` `:930-1071`; the Details button at `:1062-1067`.
- Receipt data source for reprint: `GET /orders` already returns everything needed — `OrderItem {price, Starch, Vegetable}`, `User {name}`, `mealType`, `createdAt`, `voidedOrderId`, totals. **No backend endpoint or include change required.**
- Two render paths for one `ReceiptData`:
  - **HTML** (`receiptTemplate.ts`) — preview + USB driver fallback. Sizes are px in the template; customer base is 12px (`documentHtml` L83), Total is 15px bold, name 17px bold.
  - **ESC/POS thermal** (`receipt.ts` `plainTextLines` L209 + `renderEscPos` L83) — LAN/raw-USB. **Px are ignored**; today the only emphasis is bold (ESC E). Size must be carried with `GS ! n` bytes.

## Confirmed decisions (from operator)
1. **Row-level Print only, All Shifts only** — beside the Details button in the All Shifts orders table; nothing added to per-shift order tables, the Details dialog, or the Payments tab.
2. **All orders printable** — paid, unpaid, and voided alike.
3. **Reprints stamped COPY** — `** REPRINT COPY **`; the waiter's original print is unmarked.
4. **Concept ladder** — normal text grows to the size the Total uses today (not bold); every bold text grows one step above that (+5 units concept); the currently-larger elements (Total, restaurant name) stay proportionally larger.
5. **Customer receipt only** — kitchen/bar tickets, shift report, and printer TEST page are byte-identical to today.
6. **No printer settings touched** — same printer, transport, page size, margins, selection. Font size is part of the receipt content (template px for HTML, `GS ! n` height steps for thermal — printer units per the operator's "use the unit the printer prints with").
7. Manual implementation — **no ollama models**.

## Changes

### 1. Shared reprint builder — new `desktop/ui/lib/receipt.ts`
- `receiptFromOrder(order: Order, opts: { isReprint?: boolean; replacesOrderNumber?: number }): ReceiptData`:
  - items from `order.OrderItem`: `unitPrice = Number(item.price)` (already portion-resolved by the backend — same math as the Details dialog `Cashier.tsx:1200-1203`), starch/vegetable from the joins, `lineTotal = (unit + starch + veg) × qty`.
  - `waiter: order.User?.name`, `mealType`, `createdAt`, `paymentMethod`, totals straight off the order; `barcode = String(order.orderNumber)`.
  - `** Known accepted gaps (payload has no `Portion` include)**: portion note line omitted — the portion is already embedded in `item.name` (e.g. `"Fried Eggs (2pc)"`); "No starch"/"No vegetables" notes omitted (need menu flags not in the payload). Content otherwise matches the original.
  - `replacesOrderNumber`: resolved by the caller from `order.voidedOrderId` by looking the id up in the already-loaded orders list (no extra request); omitted if not found.
- Export `RESTAURANT_INFO` (the ERAEVA block, `WaiterMenu.tsx:79-88`) so the builder and `WaiterMenu` share one copy; `WaiterMenu.tsx` swaps its two inline literals for the import (no behavior change).

### 2. Row Print button — `desktop/ui/pages/admin/Cashier.tsx`
- `renderCell` `details` case (`:1062-1067` and the MARKED_UNPAID variant `:1024-…`): add `<Button variant="outline" size="sm"><Printer/> Print</Button>` beside Details — **only when `shiftType === undefined`** (the All Shifts scope; `OrdersView` already receives `shiftType` as a prop, so the gate is `!shiftType`). Every All Shifts tab (all column sets funnel through this case) shows it; per-shift tables render the Details button exactly as today.
- Rename the column header label `Details` → `Actions` **in the All Shifts scope only** (per-shift header stays "Details").
- Handler: per-row busy state (`printingOrderId`), builds `receiptFromOrder(order, { isReprint: true, replacesOrderNumber })` → `printReceipt()`; failures surface via the toast pattern already used in `Cashier.tsx`; skipped printers (`{ok, skipped}`) warn to console, never block (mirrors `printBestEffort`). Browser dev mode stays the existing no-op success.
- No changes to Payment view, Details dialog, entry cards, or per-shift order tables.

### 3. Reprint stamp + font sizes — `desktop/electron/receiptTemplate.ts`
- `ReceiptData` gains `isReprint?: boolean` (also mirrored in `desktop/ui/types/electron.d.ts`).
- `customerBody`: after the Order# row, when `isReprint` → centered `** REPRINT COPY **` (bold, new bold-base size).
- **Size ladder (customer receipt only):**

| Element | Today | New |
|---|---|---|
| Body base / Waiter / Date / Meal / item name / unit price / Shipping / Tax / accompaniments / address lines / tel / services | 12px & 11px normal | **15px normal** |
| Order #, QTY header, qty, line total, Sub-Total, REPLACES, REPRINT stamp, Thank-you | 12px bold | **17px bold** |
| Branch label, "POS Designed and Build By" | 11px bold | **16px bold** |
| Till No, poweredBy | 13px bold | **18px bold** |
| Total | 15px bold | **20px bold** |
| Restaurant name | 17px bold | **22px bold** |

- Base size applied via a parameter on `documentHtml(body, basePx)` defaulting to 12 (shift report keeps 12px); `customerReceiptHtml` passes 15.
- `stationBody` (kitchen/bar), `shiftReportBody`, `testHtml` untouched.

### 4. Thermal size steps — `desktop/electron/receipt.ts` (customer ticket only)
- `Seg` gains `s?: 1|2|3` (height step); `renderEscPos` emits `GS ! n` when the step changes and restores normal at the end of the payload (before feed/cut). **Height-only scaling — width untouched, so the 42-column padding never breaks.**
- Ladder mapping the HTML hierarchy into printer height steps: normal ×2, bold ×3, Total row + restaurant name + REPLACES/REPRINT stamps ×4 (n per `((h-1)<<2)` with width bits 0). Exact bytes validated on the physical test print; tunable in one place.
- `plainTextLines(data)`: tags applied **only when `data.ticket === "customer"`** — kitchen/bar output byte-identical to today; `shiftReportLines` untouched.
- `plainTextLines` also renders the `** REPRINT COPY **` centered bold stamp (after Order #) when `data.isReprint`.

## Files to modify / create
- New: `desktop/ui/lib/receipt.ts`
- Edit: `desktop/ui/pages/admin/Cashier.tsx`, `desktop/ui/pages/waiterPos/WaiterMenu.tsx` (RESTAURANT_INFO import only), `desktop/ui/types/electron.d.ts`, `desktop/electron/receiptTemplate.ts`, `desktop/electron/receipt.ts`
- Docs: `context/fix-plan/cashier-receipt-reprint.md`, `context/current-feature.md`
- **No backend, no schema, no IPC/preload changes** (`printer:*` channels already exist).

## Verification plan
1. `tsc -b`, Electron transpile, `npm run lint` zero new, `npm run build` + `npm run build:web -- --server same-origin`.
2. Live E2E: Cashier → Orders → **All Shifts card** → Print on a paid row → `printer:preview` HTML shows new sizes + `** REPRINT COPY **`; content matches the Details dialog (items, starch/veg, totals, meal, waiter); Print on an unpaid and a voided row works; a **per-shift** orders table shows **no** Print button; original waiter print has **no** stamp; kitchen ticket preview byte-identical to pre-change.
3. Physical test print (operator): verify normal/bold hierarchy on the restaurant printer, stamp placement, no column misalignment, receipt not excessively long; tune height steps once if needed. Confirm a reprint vs an original.

## Workflow & deployment
1. Branch `feature/cashier/receipt-reprint` off `restaurant-build`.
2. Implement (manual — no ollama), verify, ask before committing.
3. Merge `--no-ff`, push.
4. **Deploy is Electron-side**: browser bundle (`npm run build` + `build:web -- --server same-origin`) gives the phone/web UI the Print button; **the font-size + stamp changes live in the Electron main process** — installed terminals only receive them via a rebuilt installer (`npm run build:win` → new .exe). No backend rebuild, no EraevaBackend restart.

---
Status: Ready to Execute
Branch: `feature/cashier/receipt-reprint`
Plan reference: `context/fix-plan/cashier-receipt-reprint.md`
