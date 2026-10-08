# Cashier: All-Shift Headings + M-Pesa/Cash Partial Payments

## Overview

Two cashier changes:

1. **All-Shift headings** — when the **All Shifts** entry card is selected, the list headings become **"All Shift Orders"** (Orders section) and **"All Shift Payments"** (Payments section). Today they fall back to the generic `"Orders"` / `"Payment"`.
2. **M-Pesa + Cash (Partial) payment method** — a third payment method available in BOTH payment modes (single-order Pay dialog and batch payment wizard). The cashier keys the **M-Pesa portion** and the **Cash portion**; the two must reconcile exactly with the order total (single mode) or the accumulated batch total (batch mode) before **Confirm Payment** unlocks. The portions are stored on each order and flow into shift close and reports as first-class cash and M-Pesa money with an explicit partial breakdown.

## Agreed Decisions (confirmed with operator)

| Decision | Choice |
|---|---|
| Where the method lives | Existing `Order.paymentMethod` string gains a third value: `"mpesa-cash-partial"` (the operator's "CASHMPESA" concept — same thing, existing naming). `paymentType` keeps its existing meaning `SINGLE` \| `BATCH`; the word "type" was already taken, so the method stays in `paymentMethod`. |
| Where the keyed amounts live | Two new nullable `Order` columns: `mpesaAmount` + `cashAmount` — the two inputs the cashier keys. Only set for partial payments. |
| Reconciliation UX | **Confirm Payment stays disabled** until mpesa + cash === total (2 decimal places). Live feedback next to the inputs: `Remaining: KSh X` (short) / `Over by KSh X` (surplus) / balanced state. |
| Batch entry | Cashier keys **two batch-level totals ONCE** (total paid via M-Pesa, total paid via Cash) — never per order. Must sum to the batch total or Confirm stays disabled with the remaining amount shown. |
| Batch per-order storage | **Sequential fill** internally at confirm time (see below) — invisible to the cashier and to report math (reports only sum). |
| Declaration at shift close | **Unchanged — two inputs only** (Actual Cash Received, Actual M-Pesa Received). No third declared field: partial money is physically mixed into the drawer / M-Pesa account, so it cannot be counted separately. Variance is computed against the **all-in** totals. |
| Report totals semantics | `cashTotal` / `mpesaTotal` in the report API become **all-in** (direct + partial portions) so `cashTotal + mpesaTotal === paid revenue` and the variance math keep working everywhere they're already used. New breakdown fields expose the direct/partial split. |
| Lists | A **Partial** filter tab is added beside M-Pesa / Cash in both lists, plus a distinct purple **"M-Pesa + Cash"** badge. |

## 1. All-Shift Headings

`desktop/ui/pages/admin/Cashier.tsx`:

| Location | Today | Becomes |
|---|---|---|
| `OrdersView` heading (~line 958) | `{shiftType ? `${shiftType} Shift Orders` : "Orders"}` | fallback → `"All Shift Orders"` |
| `PaymentView` heading (~line 1929) | `{shiftType ? `${shiftType} Shift Payments` : "Payment"}` | fallback → `"All Shift Payments"` |

The `{shiftType && ...}` shift-badge logic stays as-is (still hidden for All Shifts). Void view unchanged.

## 2. Database Changes

### Prisma schema (`backend/prisma/schema.prisma`, Order model)

```prisma
mpesaAmount   Decimal?   @db.Decimal(12, 2)   // M-Pesa portion when paymentMethod = "mpesa-cash-partial"
cashAmount    Decimal?   @db.Decimal(12, 2)   // Cash portion when paymentMethod = "mpesa-cash-partial"
```

- Nullable — no backfill; existing orders unaffected. `paymentMethod` is already a free string (no enum change).
- New orders keep starting as `paymentMethod: "unpaid"` (orders.ts:255) — unchanged.

### Migration

Hand-written `backend/prisma/migrations/<timestamp>_mpesa_cash_partial/migration.sql` (adds the two columns), applied via `npm run db:sync` (generate + push) — repo convention; the `prisma migrate dev` chain is broken on pre-existing drift.

## 3. Backend Changes

### `backend/routes/orders.ts` — `PATCH /api/orders/:id/payment` (~lines 352-398)

- Whitelist becomes `["cash", "mpesa", "mpesa-cash-partial"]` (error message updated accordingly).
- **When partial:** `mpesaAmount` and `cashAmount` are required numbers, each `>= 0`, and
  `Math.round((mpesaAmount + cashAmount) * 100) === Math.round(Number(order.totalPrice) * 100)` — else `400` with a clear message ("mpesaAmount + cashAmount must equal the order total").
- **When cash/mpesa:** store `mpesaAmount: null, cashAmount: null` (clears any stale split from a prior partial payment after a mark-unpaid → re-pay cycle).
- Mark-unpaid / unmark routes are NOT touched: reports only aggregate paid orders, and every re-payment overwrites or clears the amounts, so stale values can never leak into math.

### `backend/routes/dailyReport.ts` — `GET /api/reports/shift/:id` (~lines 110-136)

Payment aggregation (the single authoritative computation):

```ts
const cashDirect       = paidOrders.filter(o => o.paymentMethod === "cash").reduce((s, o) => s + Number(o.totalPrice), 0)
const mpesaDirect      = paidOrders.filter(o => o.paymentMethod === "mpesa").reduce((s, o) => s + Number(o.totalPrice), 0)
const partials         = paidOrders.filter(o => o.paymentMethod === "mpesa-cash-partial")
const cashFromPartial  = partials.reduce((s, o) => s + Number(o.cashAmount ?? 0), 0)
const mpesaFromPartial = partials.reduce((s, o) => s + Number(o.mpesaAmount ?? 0), 0)
const payments = {
  cashTotal:  cashDirect + cashFromPartial,    // ALL-IN (keeps cashTotal + mpesaTotal === paid revenue)
  mpesaTotal: mpesaDirect + mpesaFromPartial,   // ALL-IN
  cashDirect, cashFromPartial,
  mpesaDirect, mpesaFromPartial,
  partial: { count: partials.length, total: cashFromPartial + mpesaFromPartial,
             mpesaTotal: mpesaFromPartial, cashTotal: cashFromPartial },
  unpaid:    { count, total },                 // unchanged
  declaredCash, declaredMpesa,                  // unchanged
  cashVariance:  declaredCash  !== null ? declaredCash  - (cashDirect + cashFromPartial)  : null,
  mpesaVariance: declaredMpesa !== null ? declaredMpesa - (mpesaDirect + mpesaFromPartial) : null,
}
```

Variance compares the manager's declaration against the **all-in** totals — exactly the agreed semantics.

## 4. Frontend — API & Types

### `desktop/ui/types/electron.d.ts`
- `Order`: add `mpesaAmount: number | null`, `cashAmount: number | null` (~line 152).
- `updatePayment` (~line 1171): `paymentMethod: "cash" | "mpesa" | "mpesa-cash-partial"`, add optional `mpesaAmount?: number`, `cashAmount?: number`.
- `ShiftReport["payments"]` (~944-952) and `ShiftReportData["payments"]` (~1021-1029): add `cashDirect`, `cashFromPartial`, `mpesaDirect`, `mpesaFromPartial`, `partial: { count, total, mpesaTotal, cashTotal }`.

### `desktop/ui/lib/api.ts` (~line 663)
- `updateOrderPayment(orderId, paymentMethod, paymentType?, batchId?, mpesaAmount?, cashAmount?)` — amounts included in the PATCH body when the method is partial. (Electron preload/IPC proxy the body untouched — no changes needed there.)

### New shared helper `desktop/ui/lib/payment.ts`
Pure, testable helpers used by Cashier, ShiftCloseDialog, and reports UI:

```ts
export const PARTIAL_METHOD = "mpesa-cash-partial"
export type PaymentMethodValue = "cash" | "mpesa" | "mpesa-cash-partial"

// "M-Pesa" | "Cash" | "M-Pesa + Cash" — replaces raw-string display everywhere
export function formatPaymentMethod(m: string | null | undefined): string

// difference = total - (mpesa + cash), in shillings; ok when |difference| < 0.005
export function validateSplit(mpesa: number, cash: number, total: number):
  { ok: boolean; difference: number }

// Sequential fill: pour mpesaTotal across orders one-by-one, remainder is cash.
// Guarantees per-order amounts sum exactly to the keyed totals — no rounding drift.
export function allocateBatchSplit(orders: { id: string; total: number }[], mpesaTotal: number, cashTotal: number):
  Array<{ id: string; mpesaAmount: number; cashAmount: number }>
```

Sequential-fill example (batch 300 + 300 + 200 + 200 = 1,000; keyed "M-Pesa 700, Cash 300"):

| Order | Total | M-Pesa | Cash |
|---|---|---|---|
| #1 | 300 | 300 | 0 |
| #2 | 300 | 300 | 0 |
| #3 | 200 | 100 | 100 |
| #4 | 200 | 0 | 200 |

## 5. Frontend — Cashier UI (`desktop/ui/pages/admin/Cashier.tsx`)

### Method state
Widen both unions (~1594, ~1600): `useState<PaymentMethodValue | null>`; new string states for the keyed amounts (`""`-initialised, numeric, comma-stripped like `formatAmountInput` in ShiftCloseDialog).

### Single-order Pay dialog (~lines 2051-2104)
- Third radio card: **"M-Pesa + Cash (Partial)"** — "Split payment — enter both amounts".
- When selected: two `Input`s (**M-Pesa amount**, **Cash amount**) + live reconciliation line under them — `Remaining: KSh X` (amber) / `Over by KSh X` (red) / `Balanced` (green). Uses `validateSplit` against `Number(payOrder.totalPrice)`.
- Confirm Payment `disabled` unless a method is chosen AND (partial → split reconciles).
- On confirm: `updateOrderPayment(payOrder.id, "mpesa-cash-partial", "SINGLE", undefined, mpesa, cash)`.

### Batch payment wizard (~lines 2108-2282)
- Step 1 (~2139-2166): third radio card, same design.
- Step 2 (~2171-2241): when partial is selected, render the **two batch-level inputs** beside the accumulated total (batch total from `batchTotals`, ~1709-1712) with the same live reconciliation feedback.
- `handleConfirmPayment` (~1730-1748): compute per-order amounts via `allocateBatchSplit` (total = each order's `totalPrice`, in selection order), then one `updateOrderPayment(o.id, "mpesa-cash-partial", "BATCH", batchId, m, c)` per order.
- Confirm `disabled` until an order is selected AND (partial → keyed totals reconcile with the batch total).

### Tabs, filters, badges, details
- `OrderTab` (~112) + `TAB_LABELS` (~114-122) + colors (~129-135): add `"PARTIAL"` / `"Partial"` / purple. Filter `o.isPaid && o.paymentMethod === "mpesa-cash-partial"` + counts (~706-709, ~748-749). Applies to every list surface that shows MPESA/CASH tabs (Orders + Payment views).
- Paid badge (~866-870): partial → purple **"M-Pesa + Cash"** badge (keep the existing Batch badge logic).
- Order details dialog (~1039): `formatPaymentMethod(detailOrder.paymentMethod)` instead of the raw string; when partial, show the split (M-Pesa KSh X · Cash KSh Y).
- Dashboard Payment card subtitle (~392): "Mark an order as paid via M-Pesa, Cash, or a split of both."

## 6. Frontend — Reports

### `desktop/ui/components/shift/ShiftCloseDialog.tsx`
- **stats useMemo (~90-142) must mirror the backend:** `cashDirect`, `cashFromPartial`, `mpesaDirect`, `mpesaFromPartial`, `partialCount`, `partialTotal`; `cashTotal`/`mpesaTotal` become all-in.
- **Step 1 Payment Summary (~332-364):** 3 tiles → 4 (`M-Pesa`, `Cash`, `M-Pesa + Cash`, `Unpaid`). M-Pesa and Cash tiles gain a small breakdown line: `incl. KSh X from M-Pesa + Cash` under the all-in total. New tile: partial count + total (mpesa portion / cash portion). Revenue footer line unchanged (`revenue`).
- **Post-close reconciliation view (~619-699):** same 4-card layout from the backend report — M-Pesa card (direct / from partial / total / declared / variance), Cash card (same structure), new **M-Pesa + Cash** card (count, total, portions), Unpaid card unchanged. `System Revenue (Paid Only)` line (`p.cashTotal + p.mpesaTotal`, ~693) keeps working because the totals are all-in.
- **Step 3 declaration (~443-480): unchanged — two inputs.**

### `desktop/ui/components/reports/ShiftReport.tsx` (~375-449)
Same treatment as the post-close view: breakdown sub-lines inside the M-Pesa and Cash cards (direct / from partial / **total**), fourth **M-Pesa + Cash** card, declared + variance rows unchanged, revenue line (~443 `cashTotal + mpesaTotal`) unchanged.

### `desktop/electron/receiptTemplate.ts` (printed shift report)
- `ShiftReportData.payments` interface (~269-277): add the new fields (must stay in sync with `electron.d.ts`).
- PAYMENT RECONCILIATION block (~351-366): add rows `M-Pesa (from partial)`, `Cash (from partial)` and an `M-Pesa + Cash (partial)` summary line — keeping the existing System/Declared/Variance rows against the all-in totals.

### Target card layout (all three report surfaces)

```
M-PESA CARD                          CASH CARD
├─ M-Pesa (direct: batch+single)     ├─ Cash (direct: batch+single)
├─ from M-Pesa + Cash partials: Y    ├─ from M-Pesa + Cash partials: Y
├─ TOTAL M-PESA: X+Y                 ├─ TOTAL CASH: X+Y
├─ Declared by manager: D            ├─ Declared by manager: D
└─ Variance: D−(X+Y)                 └─ Variance: D−(X+Y)

M-PESA + CASH CARD (informational)   UNPAID CARD (unchanged)
└─ count · total (mpesa portion / cash portion)
```

## 7. Other Display Touch-ups

- `desktop/ui/pages/admin/CustomerDetail.tsx` (~96): `formatPaymentMethod(o.paymentMethod)` instead of raw string.
- Waiter receipt plumbing (`WaiterMenu.tsx:76`) is inert (the template never renders `paymentMethod`) — leave as-is.

## 8. Tests (Vitest)

- **Frontend** `desktop/ui/tests/payment-split.test.ts`: `validateSplit` (balanced / short / over / 2dp tolerance), `allocateBatchSplit` (pot empties exactly, per-order sums equal keyed totals, empty orders, zero mpesa), `formatPaymentMethod`.
- **Backend** `backend/tests/payment-partial.test.ts` (note: `backend/tests/` is gitignored — `git add -f`): PATCH partial missing amounts → 400; mismatch → 400; valid → 200 + amounts persisted; re-payment with pure cash clears amounts; report endpoint returns correct direct/partial/all-in totals + variances for a shift containing all three methods.
- Optional seed fixture: `backend/db/seed-shift-test.ts` gains one partial order for visual verification.

## 9. Files Changed

**Backend:** `schema.prisma` + hand-written migration, `routes/orders.ts`, `routes/dailyReport.ts`, (optional) `db/seed-shift-test.ts`, `tests/payment-partial.test.ts`

**Frontend:** `lib/payment.ts` (new), `lib/api.ts`, `types/electron.d.ts`, `pages/admin/Cashier.tsx`, `components/shift/ShiftCloseDialog.tsx`, `components/reports/ShiftReport.tsx`, `pages/admin/CustomerDetail.tsx`, `tests/payment-split.test.ts`

**Electron:** `receiptTemplate.ts`

## 10. Verification Checklist

- [ ] All Shifts card → Orders heading reads "All Shift Orders"; Payments heading reads "All Shift Payments"; shift-scoped cards still read "<TYPE> Shift Orders/Payments"
- [ ] Single partial: amounts short/over → Confirm disabled + live difference shown; balanced → enabled; payment persists both portions
- [ ] Batch partial: two batch-level inputs; short/over → disabled with remaining shown; balanced → all orders paid with same batchId, per-order portions sum exactly to keyed totals
- [ ] Partial option visible in BOTH dialogs; pure cash/mpesa payments clear any stale amounts
- [ ] Partial tab + purple badge + details-dialog split display work in Orders and Payment lists
- [ ] Shift close Step 1 shows 4 cards with breakdown lines; declaration still 2 inputs; post-close + ShiftReport + printed report show the 4-card reconciliation
- [ ] `cashTotal + mpesaTotal` still equals paid revenue in the report
- [ ] Backend tests + frontend tests green (`npm run test`)
- [ ] `npx tsc -b` + backend `tsc` clean; `npm run lint` no new errors

## 11. Deploy (backend changed — mandatory)

1. `npm run db:sync` (schema changed)
2. `npm run build --prefix backend`
3. `npm run server:restart` → verify `npm run server:status` RUNNING + `curl http://localhost:3001/health`
4. Remote ship: SSH `restaurant-build` flow (git pull → build → `schtasks /run /tn pos-backend-restart` → verify)
5. After any plain `npm run build`, re-run `npm run build:web -- --server same-origin` so the served web UI stays browser-correct

**Branch:** `feature/cashier/mpesa-cash-partial`
