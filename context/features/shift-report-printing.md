# Shift Report — POS Printer Printing + Preview

## Overview

Add the ability to print and preview the shift report on the same POS thermal printer used for order receipts. Includes a print preview dialog (matching the order receipt preview pattern) and a Print button that sends ESC/POS directly to the connected customer printer.

---

## Foundation Already Built (do NOT rebuild)

| Piece | Where |
|---|---|
| ESC/POS rendering engine (`renderEscPos`, `plainTextLines`, `printToLan`, `printRawUsb`, `printHtml`) | `desktop/electron/receipt.ts` |
| Receipt templates (customer/kitchen/bar HTML) + `ReceiptData` interface | `desktop/electron/receiptTemplate.ts` |
| Printer registry with role-based routing (`findPrinterByRole`, `PosPrinterRole`) | `desktop/electron/printers.ts` |
| IPC registration pattern (`registerReceiptHandlers`) | `desktop/electron/receipt.ts` |
| Preload printer exposure (`window.electron.printer.*`) | `desktop/electron/preload.cts` |
| API helpers (`printReceipt`, `previewReceipt`) | `desktop/ui/lib/api.ts` |
| Shift report API (`GET /api/reports/shift/:id`) returning `ShiftReport` shape | `backend/routes/dailyReport.ts` |
| `ShiftReport`, `ShiftPlateMovementRow`, `ShiftRevenueEntry`, `ShiftProduction`, `ShiftReportMeta` types | `desktop/ui/types/electron.d.ts` |
| `ShiftReportView` component (Reports page) | `desktop/ui/components/reports/ShiftReport.tsx` |
| `ShiftCloseDialog` report view (post-close summary) | `desktop/ui/components/shift/ShiftCloseDialog.tsx` |

---

## Scope

### 1. New data type — `ShiftReportData`

**File:** `desktop/electron/receiptTemplate.ts`

Define the input shape for the shift report renderer (same data the frontend already receives from `GET /api/reports/shift/:id`):

```ts
export interface ShiftReportData {
  restaurant: {
    name: string;
    branch?: string;
    address?: string;
    city?: string;
    poweredBy?: string;
    tel?: string;
    services?: string;
  };
  shift: {
    type: string;          // "DAY" | "NIGHT"
    date: string;          // ISO date
    openingTime: string;   // ISO datetime
    autoCloseTime: string;
    actualCloseTime: string | null;
    openedBy: string;      // name
    closedBy?: string;     // name
  };
  summary: {
    totalOrders: number;
    voidedOrders: number;
  };
  revenue: {
    [mealType: string]: { orders: number; total: number };
    total: number;
  };
  plateMovement: {
    menuName: string;
    openingPlates: number;
    platesCooked: number;
    platesSold: number;
    closingPlates: number | null;
    expectedClosing: number;
    variance: number;
  }[];
  production: {
    totalCost: number;
    totalSales: number;
    variance: number;
    profitMargin: string;
  };
}
```

### 2. ESC/POS line renderer — `shiftReportLines(data)`

**File:** `desktop/electron/receipt.ts`

New function `shiftReportLines(data: ShiftReportData): Line[]` using the same 42-col helpers (`pushCenter`, `pushRow`, `wrapWords`) as `plainTextLines`:

**Layout:**
```
        ERAEVA RESTAURANT          (centered, bold)
        Branch: Airport            (centered, bold)
        Nairobi                    (centered)
------------------------------------------  (dashed line)
Shift           DAY · 25 Aug 2026           (row)
Opened          05:30 AM by Byron           (row)
Scheduled close 05:30 PM                     (row)
Closed          04:12 PM by Byron            (row)
------------------------------------------
  REVENUE BY MEAL PERIOD                     (centered, bold)
------------------------------------------
BREAKFAST (3 orders)          KSH 1,200     (row)
LUNCH (5 orders)              KSH 4,500     (row)
------------------------------------------
Total                         KSH 5,700     (row, bold)
------------------------------------------
  PLATE MOVEMENT                             (centered, bold)
------------------------------------------
ITEM           OPEN  COOKED  SOLD  EXP  ACT (header, bold)
------------------------------------------
Ugali            72      0     1   71    71  (row)
Chapati         114      0     5  109   109  (row)
------------------------------------------
  PRODUCTION vs SALES                        (centered, bold)
------------------------------------------
Production cost           KSH 3,200          (row)
Sales                     KSH 5,700          (row)
Variance                  KSH 2,500          (row, bold)
Profit margin             43.9%               (row)
------------------------------------------
        Thank You. Welcome Again             (centered, bold)
        Buy Goods Till No: 994296            (centered, bold)
------------------------------------------
POS Designed and Build By:                   (centered, bold)
Apydy Technologies                           (centered, bold)
Tel: 0701315250                              (centered)
------------------------------------------
```

### 3. HTML fallback template — `shiftReportHtml(data)`

**File:** `desktop/electron/receiptTemplate.ts`

New function matching the pattern of `customerReceiptHtml` — 80mm monospace, `@page { size: 80mm auto }`, same content rendered as HTML tables/divs. Used as fallback when raw USB printing fails.

### 4. Dispatch logic

**File:** `desktop/electron/receipt.ts`

- Add `"shift"` to `ReceiptData.ticket` union type
- In `roleForTicket()`: `"shift"` → `"customer"`
- In `templateFor()`: `"shift"` → `shiftReportHtml`
- In `printReceipt()`: after the existing flow, if ticket is `"shift"`, use `shiftReportLines(data)` instead of `plainTextLines(data)`

### 5. IPC handlers

**File:** `desktop/electron/receipt.ts` (in `registerReceiptHandlers`)

Two new handlers:

```ts
ipcMain.handle("printer:preview-shift-report", (_event, data: ShiftReportData) => {
  return shiftReportHtml(data);
});

ipcMain.handle("printer:print-shift-report", (_event, data: ShiftReportData) => {
  const printer = findPrinterByRole("customer");
  if (!printer) return { ok: false, error: "No customer printer configured" };
  // ... same LAN/USB/HTML fallback pattern as printReceipt
});
```

### 6. Preload exposure

**File:** `desktop/electron/preload.cts`

Add to the `printer` namespace:

```ts
previewShiftReport: (data) => ipcRenderer.invoke("printer:preview-shift-report", data),
printShiftReport: (data) => ipcRenderer.invoke("printer:print-shift-report", data),
```

### 7. TypeScript types

**File:** `desktop/ui/types/electron.d.ts`

- Add `ShiftReportData` interface (mirrors `receiptTemplate.ts`)
- Extend `ElectronAPI.printer` with `previewShiftReport` and `printShiftReport`

### 8. API helpers

**File:** `desktop/ui/lib/api.ts`

```ts
export async function previewShiftReport(data: ShiftReportData): Promise<string> { ... }
export async function printShiftReport(data: ShiftReportData): Promise<PrintResult> { ... }
```

Same pattern as `previewReceipt`/`printReceipt` with `window.electron` fallback.

### 9. UI — Print + Preview buttons

**File:** `desktop/ui/components/reports/ShiftReport.tsx`

Add a toolbar row above the report with:
- "Preview Report" button → opens dialog with iframe `srcDoc` showing the HTML preview
- "Print Report" button → sends directly to POS printer (with confirmation toast)

Both buttons call `buildShiftReportData(report)` helper that maps the `ShiftReport` → `ShiftReportData` (resolving restaurant info from a config or hardcoding the same values used in receipt templates).

**File:** `desktop/ui/components/shift/ShiftCloseDialog.tsx`

Same two buttons in the report view section (after close completes).

### 10. Restaurant config for report header

Reuse the same restaurant info already hardcoded in `receiptTemplate.ts` for the order receipt header. Either:
- Extract to a shared constant, or
- Pass through from the report data (the `ShiftReportData.restaurant` field)

---

## Files Touched (8 total)

| # | File | Change |
|---|------|--------|
| 1 | `desktop/electron/receiptTemplate.ts` | `ShiftReportData` interface + `shiftReportHtml` function |
| 2 | `desktop/electron/receipt.ts` | `shiftReportLines` function + `"shift"` ticket type + two IPC handlers |
| 3 | `desktop/electron/preload.cts` | Expose `previewShiftReport` + `printShiftReport` |
| 4 | `desktop/ui/types/electron.d.ts` | `ShiftReportData` type + `ElectronAPI.printer` extension |
| 5 | `desktop/ui/lib/api.ts` | `previewShiftReport` + `printShiftReport` helpers |
| 6 | `desktop/ui/components/reports/ShiftReport.tsx` | Preview/Print buttons + preview dialog + data mapper |
| 7 | `desktop/ui/components/shift/ShiftCloseDialog.tsx` | Preview/Print buttons + preview dialog + data mapper |
| 8 | `context/current-feature.md` | Update status |

---

## Verification

1. `tsc --noEmit` (root + backend)
2. `npm run lint`
3. Open a closed shift report → click Preview → verify HTML renders in dialog
4. Click Print → verify ESC/POS sent to customer printer (or fallback to HTML print)
5. Verify the printed output matches the preview content
6. Test with no printer configured → verify graceful error message
