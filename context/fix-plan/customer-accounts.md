# Customer Accounts — Pay-Later Attribution for Unpaid Orders

## Overview
Add a `Customer` model for restaurant customers and link them to unpaid orders, so that orders which are not paid at the till are attributed to a specific person or company and can be followed up later. Cashiers gain an "All Shifts" view so they can see every order from every shift (day, night, or any other), not just the currently open one.

Marking an order as **unpaid always happens before** a customer is assigned to it. The existing unpaid-acknowledgement flow is unchanged and remains the shift-close gate; customer assignment is an additional layer on top of it.

Deliberately deferred: server-side auth / role enforcement. The trusted-LAN model stands (all API routes remain open on the restaurant network).

## Goals
- `Customer` model storing all restaurant customers: `name` (required), `phone` (required, unique, stored with all spaces stripped), `notes` (optional)
- Cashier, manager and admin can create, edit, delete and list customers
- Cashier can view **all orders from all shifts** (not scoped to one shift type)
- Cashier can mark an order paid (already exists — the `Pay` button; unchanged)
- Cashier can mark an order unpaid **and** assign a customer in one action
- A customer can only ever be assigned to an order that is already marked unpaid
- A shift still closes only when every active order is paid or marked unpaid (unchanged)
- Cashier can assign customers to marked-unpaid orders at any time, including after the shift has closed
- Per-customer read-only ledger: outstanding balance, open orders, settled orders, cancelled
- Voided orders never appear in the close flow or in any outstanding total, but remain traceable to the correct replacement order
- When a shift **auto**-closes, every still-pending order is automatically marked unpaid — nobody is there to do it
- Every unpaid order shows how long it has been unpaid, and separately how long since it was marked
- The nav badge counts the **whole** unpaid backlog, whether a customer is attached or not
- An individual shift card shows only its own operational day; the date picker belongs to All Shifts only

## Non-Goals
- No server-side authentication or role middleware (trusted LAN, deferred)
- No partial payments, deposits, or customer statement printing
- No waiter-side "charge to customer" at order placement
- No settlement UI — customers still pay through the existing `Pay` button
- `backend/routes/shifts.ts` and `backend/routes/dailyReport.ts` are NOT changed — see [Report Reconciliation](#report-reconciliation-no-code-change) for why late payments already reconcile the original day

## Roles

| Action                              | admin | manager | cashier | waiter |
|-------------------------------------|:-----:|:-------:|:-------:|:------:|
| Void / cancel an order              | yes   | yes     | no (lock) | no    |
| Mark order unpaid                   | yes   | yes     | yes     | no     |
| Customer CRUD                       | yes   | yes     | yes     | no     |
| Assign / unassign customer          | yes   | yes     | yes     | no     |
| Re-place a voided order             | no    | no      | no      | yes    |

The existing manager-only void lock is NOT loosened.

## Order Lifecycle

```
Order created (a shift must be open)
  isPaid=false · paymentMethod="unpaid" · unpaidAcknowledged=false · customerId=null
       |
       |-- [cashier: Pay] ---------------------------> isPaid=true, paymentMethod=cash|mpesa, paidAt
       |
       |-- [cashier: "Can't Pay" + customer] ---------> unpaidAcknowledged=true AND customerId set
       |                                                (combined, so it does NOT surface at close)
       |
       `-- [shift close: manager marks unpaid] -------> unpaidAcknowledged=true
                 |                                      (report shows unpaid count; shift may close)
                 |                                      (manual-close shifts only — the gate
                 |                                       forces the manager to do this)
                 |
                 `-- [cashier, any time later] --------> customerId set

       `-- [shift AUTO-closes: system marks unpaid] -> unpaidAcknowledged=true
                 |                                      (auto-close shifts only — no manager exists,
                 |                                       so the scheduler does it, see I9)
                 |
                 `-- [cashier, any time later] --------> customerId set
```

Both close paths end at the same state: `unpaidAcknowledged=true`, `customerId=null`, order still unpaid. The difference is only **who** performs the acknowledgement.

## Voided Orders
Only **admin and manager** can void (`Cashier.tsx:313` disables the void nav item when `isCashier`; `Cashier.tsx:900` returns early so a cashier's void view never loads orders). The waiter cannot void at all — the waiter only re-places the correction.

```
12:04:10  Waiter places #1042
12:04:35  Waiter spots error, asks manager
12:05:00  MANAGER/ADMIN voids #1042 -> isVoid=true, voidReason, voidedAt, voidedById
12:05:30  Waiter's screen shows #1042 in "cancelled, needs re-placing"
          (own order, today, not yet replaced — WaiterOrderContext.tsx:84-88)
12:06:00  Waiter re-places as #1050 with voidedOrderId -> #1042
          Cart shows "Replaces Order #1042" (WaiterMenuGrid.tsx:661)
          #1050 is the LIVE order -> marked unpaid at close -> assigned to a customer
```

`Order` carries two separate user references — `userId` (who placed it) and `voidedById` (who cancelled it) — precisely because cancelling is an authority reserved for management.

### Void handling rules
- A voided order is a permanent audit record, never a live order
- It never appears in the close flow, the cashier's lists, or any outstanding total
- It **retains** its `unpaidAcknowledged*` and `customerId*` (voiding does not disturb them)
- It is excluded from `outstandingTotal`, from the Marked Unpaid tabs, and from the nav badge via `!isVoid`
- The replacement order is always a **fresh** order — no customer is inherited
- In the ledger it appears only in a collapsed "Cancelled (n)" section, grey-struck

## Shift Auto-Close

### The gap being fixed
`ShiftConfig.manual` defaults to **`false`**, so auto-close is the *default* path, not an edge case. `autoCloseExpiredShifts()` (`backend/scheduler.ts:190-225`) only ever writes to `shift` and `shiftSnapshot` — it never issues a query against `Order`.

For a `manual = false` shift the scheduler finalises immediately (`isOpen: false`, `finalCloseSource: "AUTO"`), no manager ever opens the close dialog, and every pending order is left with `unpaidAcknowledged = false`:

| Field | Value | Consequence |
|---|---|---|
| `isPaid` | `false` | counted as unpaid in the report — correct |
| `unpaidAcknowledged` | `false` | **hidden** from Orders → Marked Unpaid (`o.unpaidAcknowledged && !o.isVoid`) |
| | | **excluded** from the nav badge — it reads 0 |
| | | **permanently** `blockingUnpaid`, on a shift that is already closed |

The money walked out and the report is right, but the cashier has no way to find the order. This is the "indicator says 2 and they are not visible" failure — except the indicator says **zero**.

### The change
Inside the **existing** `$transaction` in `autoCloseExpiredShifts()`, in the `!manualClose` branch:

```ts
await tx.order.updateMany({
  where: {
    shiftId: shift.id,
    isVoid: false,
    isPaid: false,
    unpaidAcknowledged: false,
  },
  data: {
    unpaidAcknowledged: true,
    unpaidAcknowledgedAt: now,
    unpaidAcknowledgedById: null,
  },
})
```

Then emit `order.unpaid-ack` per affected order so open cashier views refresh live.

### Why each detail
- **Inside the transaction** — a shift can never be finalised with stranded orders; both writes commit or neither does
- **`!manualClose` only** — manual-close shifts keep the manager's review meaningful; the gate at `shifts.ts:238-252` still blocks them until a human acts
- **`unpaidAcknowledged: false` in the where** — idempotent, so a re-run cannot re-stamp `unpaidAcknowledgedAt` and corrupt the aging clock
- **`unpaidAcknowledgedById: null`** — the column is `String? @db.Uuid` with **no** relation to `User` and is never rendered in the UI, so `null` cleanly means "system" and needs no UI fallback
- **`isPaid` / `isVoid` excluded** — paid orders stay paid; voided orders are not unpaid orders

### Which path does what
| Shift type | Who acknowledges pending orders | When |
|---|---|---|
| `manual = true` | **Manager**, via `ShiftCloseDialog` | Before manual close — enforced by the gate |
| `manual = false` (default) | **System**, automatically | At `autoCloseTime`, in the scheduler transaction |

## Report Reconciliation (no code change)

Paying a walkout later must update the report for the day the order was **created**. This already works, and the plan is a regression test only.

1. **No report table exists.** The schema has 30 models and none is a report. `ShiftSnapshot` (`schema.prisma:374`) stores stock and plates only — `openingPlates`, `closingStockAtAutoClose`, `driftMinutes`, `platesWasted`. **No money fields.**
2. **The report is derived at read time.** `dailyReport.ts` performs zero `create`/`update`/`upsert` calls:
   ```ts
   // backend/routes/dailyReport.ts:280-283
   const activeOrders = shift.orders.filter((o) => !o.isVoid)
   const paidOrders   = activeOrders.filter((o) => o.isPaid)
   const unpaidOrders = activeOrders.filter((o) => !o.isPaid)
   ```
3. **The order never migrates between shifts.** `PATCH /:id/payment` (`orders.ts:268-275`) writes only `paymentMethod`, `isPaid`, `paidAt`, `paymentType`, `batchId` — it **never writes `shiftId`**.

So reopening last Tuesday's report shows 3 fewer unpaid orders and 3 more paid, with no backfill and no stored snapshot to invalidate. The test guards against a future refactor adding money fields to `ShiftSnapshot`, which would silently freeze stale numbers.

## Unpaid Visibility and Aging

### The badge counts the whole backlog
New `GET /api/orders/unpaid-count` in `backend/routes/orders.ts`, placed after the existing `/count` route (line 34). No `GET /:id` exists in that file — the only `/:id/...` routes are POST/PATCH — so there is no route-shadowing risk.

```ts
const count = await prisma.order.count({
  where: { unpaidAcknowledged: true, isPaid: false, isVoid: false },
})
```

| Filter | Purpose |
|---|---|
| `unpaidAcknowledged: true` | only the "customer walked out" flag — excludes work-in-progress on the running shift, so the badge reads 0 during quiet service |
| **no** `customerId` filter | assigned and unassigned both count. The priority is "is it paid or not"; *whose* it belongs to is a table column, not a count filter |
| **no** `shift.isOpen` join | a cashier hitting "Can't Pay" at 2pm on a shift closing at 11pm is a real walkout — it counts now, not in nine hours |

### Badge relocation
The badge currently renders on the **Customers** nav item (`AdminLayout.tsx:192`), but walking into a CRUD screen to see a payment backlog is the wrong destination. It moves to the **Cashier** item (`/admin/cashier`, `Receipt` icon, roles `admin|manager|cashier`), which is the payments entry point and where the All Shifts card lives.

- `needsCustomerCount` → `unpaidBacklogCount`
- `getOrdersNeedingCustomer()` → `getUnpaidOrderCount()`
- `item.label === "Customers"` → `item.label === "Cashier"`
- tooltip → `${n} unpaid order(s)`
- the existing 5s `setInterval` poll is unchanged

### Removing the dead needs-customer path
With the badge resemanticised, the old worklist has no consumer. Per the no-dead-code rule it is deleted:

| Reference | Action |
|---|---|
| `backend/routes/customers.ts:51-69` | delete |
| `desktop/electron/ipc-handlers.ts:285` | delete |
| `desktop/electron/preload.cts:112` | delete |
| `desktop/ui/types/electron.d.ts` — `getNeedsCustomer` | delete |
| `desktop/ui/lib/api.ts:936-941` — `getOrdersNeedingCustomer()` | delete |
| `backend/tests/customer-assignment.test.ts:70-78` | repoint at `/orders/unpaid-count` |

The unassigned chase is not lost — it is delivered by the amber "Not assigned" cells plus the new badge.

## Shift Card Scoping

### The bug
`OrdersView` (`Cashier.tsx:442`) and `PaymentView` (`Cashier.tsx:1370`) are **both handed `operationDay` and both discard it** — the prop is in the type but absent from the destructuring:

```tsx
function PaymentView({ shiftType }: { shiftType?: string; operationDay?: string }) {
```

The parent does pass it (`Cashier.tsx:203,205`, from `onSelectShift(c.type, opDays[c.type])`). The consequence is in `refreshPayment` (`Cashier.tsx:1420-1422`), which filters by shift **type** only, so the DAY card returns every DAY-shift order since the database began. The DatePicker exists purely as a manual workaround for the dropped prop.

### The fix
**1 — scope by `(type, operationDay)`.** Exact, because of the schema:

```prisma
model Shift {
  type         String
  operationDay DateTime @db.Date
  @@unique([type, operationDay])
}
```

Type + operation day identifies exactly one shift. The card's own label already promises this date (`Date: ${opDayLabel(opDays[c.type])}`, `Cashier.tsx:1345`); today the label says one date and the data says another.

**2 — date picker only in All Shifts.** One conditional at the two render sites (`Cashier.tsx:820`, `:1667`):

```tsx
{!shiftType && <DatePicker value={selectedDate} onChange={setSelectedDate} placeholder="Filter by date" />}
```

`shiftType` is `undefined` only for All Shifts — that card calls `onSelectShift(undefined, undefined)` at `Cashier.tsx:1355`.

| Card | Scope | Date picker |
|---|---|---|
| DAY / NIGHT | That shift, its current operational day | Hidden |
| All Shifts | Every shift ever | Available |

**3 — prefer the open shift's operation day.** The entry view builds its map at `Cashier.tsx:1304` with "latest wins" (`if (!existing || s.operationDay > existing)`). If today's shift has not been created yet but yesterday's exists, the card would present yesterday as current. Prefer `s.isOpen` (the field exists on the model), falling back to latest.

**4 — remove the now-dead `selectedDate` filter branch** from the filter memo when a shift card is active.

## Aging Columns

### Helper — `desktop/ui/lib/utils.ts`, beside `formatDate`
```ts
export function formatElapsed(from: string | Date, to: Date = new Date()): string {
  const start = typeof from === "string" ? new Date(from) : from
  const ms = Math.max(0, to.getTime() - start.getTime())
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const mins = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}
```
Three tiers because a 15-minute-old order should not read "0d 0h". `elapsedSeverity()` → neutral `< 12h`, amber `12h – 2d`, red `> 2d`.

### Columns
- **Waiting** — `formatElapsed(order.createdAt)`. Keeps counting after a customer is attached, so it always answers "how long has this money been owed"
- **Marked** — `formatElapsed(order.unpaidAcknowledgedAt)`, or `—` if never marked. Free — the column already exists and `GET /orders` returns it (no restrictive `select`, `orders.ts:47-56`)
- **Customer** — keeps the amber "Not assigned" (`Cashier.tsx:705`)

A row then reads at a glance: *unpaid 6d, marked 3d ago, Not assigned*.

- **Paid At** — added to the OrdersView MPESA / CASH tabs. `paidAt` is rendered in exactly one place in the whole UI today (`CustomerDetail.tsx:95`), so there is currently no way to see *when* something was eventually paid. Placed beside the creation date it makes the eaten-vs-paid gap explicit.

### Protecting the aging clock
"Can't Pay" always calls `markOrderUnpaidWithCustomer()` (`api.ts:981`), which **re-stamps** `unpaidAcknowledgedAt = now`. Clicking it on an order already marked unpaid three days ago would reset the Marked column from `3d 4h` to `2m`, silently, every time.

Fix — branch on current state:
- **not marked** → "Can't Pay" → `markOrderUnpaidWithCustomer()` (existing, correct)
- **already marked** → button relabels to **"Assign Customer"** → `assignOrderCustomer()` (`orders.ts:382`), a pure assignment that touches neither `unpaidAcknowledged` nor its timestamp

## Invariants

| # | Rule                                                              | Enforced at              |
|---|-------------------------------------------------------------------|--------------------------|
| I1 | An order is never deleted                                         | no DELETE route exists   |
| I2 | An unpaid order is never shown paid                               | `PATCH /:id/payment`     |
| I3 | A shift closes only if every active order is paid or marked unpaid| `shifts.ts:240` (unchanged) |
| I4 | Assigning a customer requires `unpaidAcknowledged === true`       | `assign-customer` 400    |
| I5 | Assignment allowed any time; shift/day always displayed           | picker + ledger display  |
| I6 | Unassign clears the customer only, never the mark-unpaid          | `unassign-customer`      |
| I7 | Voided orders never enter the close flow or outstanding totals     | `!isVoid` filters        |
| I8 | Undoing the mark-unpaid also detaches any assigned customer    | `unassign` inside `unpaid-ack-undo` |
| I9 | An auto-closing shift never finalises with an unacknowledged pending order | `updateMany` inside the scheduler's existing transaction |
| I10 | Auto-close marking is idempotent and never resets an existing mark | `unpaidAcknowledged: false` in the `where` |
| I11 | Assigning a customer never re-stamps `unpaidAcknowledgedAt` | already-marked orders use `assign-customer`, not `unpaid-ack` |
| I12 | A payment never changes the order's shift or creation day | `PATCH /:id/payment` omits `shiftId` |
| I13 | A shift card shows only its own operational day | `(type, operationDay)` scope, `@@unique` in schema |

## Database Changes

### Prisma Schema (`backend/prisma/schema.prisma`)

New model (matches `Department` style: `updatedAt @updatedAt @db.Timestamptz(3)`; `createdAt @db.Timestamptz(3)`):
```prisma
model Customer {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  phone     String   @unique          // stored with all spaces stripped
  notes     String?
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  orders    Order[]
  @@index([name])
}
```

Added to the Order model (all nullable, purely additive):
```prisma
customerId           String?   @db.Uuid
customerAssignedById String?   @db.Uuid
customerAssignedAt   DateTime? @db.Timestamptz(3)
Customer             Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
```

- No `isActive` field — a customer is identified by name + phone
- `onDelete: SetNull` guarantees a deleted customer can never orphan an order
- `notes` is optional; `name` and `phone` are required
- `phone` is unique so no two customers can share a number
- `createdAt` / `updatedAt` match the `Department` convention (`Timestamptz(3)`)

### Migration
```
npx prisma migrate dev --name customer-accounts
```
Purely additive, so the live machine's `npm run db:sync` (`db:generate` + `db:push`) cannot destroy existing orders.

## Backend Changes

### `backend/routes/customers.ts` (new)

Modelled on `backend/routes/departments.ts`.

| Route | Behaviour |
|---|---|
| `GET /` | All customers with computed `openOrderCount` and `outstandingTotal` (unpaid, non-void). `?q=` matches name **or** phone |
| `GET /:id` | The ledger: customer + open, settled and cancelled order groups, each with shift type and operation day |
| `POST /` | 400 if `name` or `phone` blank · **409 if the stripped phone already exists** |
| `PUT /:id` | Same validation · 409 if the new phone collides with a different customer |
| `DELETE /:id` | **409 if any order is linked** |

`GET /needs-customer` is **removed** — see [Removing the dead needs-customer path](#removing-the-dead-needs-customer-path).

Phone normalisation:
```ts
const phone = String(rawPhone ?? "").replace(/\s+/g, "")
```

### `backend/routes/orders.ts`

| Route | Change |
|---|---|
| `GET /` | Add `Customer: { select: { id: true, name: true, phone: true } }` to the existing `include` (full scalar row already returned) |
| `POST /:id/unpaid-ack` | **Extended** — accepts optional `customerId`; when present, marks unpaid **and** assigns in the same `update({ data: { unpaidAcknowledged: true, ..., customerId, customerAssignedById, customerAssignedAt } })` (atomic, no transaction needed). Serves the in-shift "Can't Pay" action with no new endpoint |
| `POST /:id/unpaid-ack-undo` | **Changed** — also clears `customerId`, `customerAssignedById`, `customerAssignedAt` in the same update (I8). The UI already asks for confirmation on destructive actions |
| `POST /:id/assign-customer` | **New** — body `{ customerId, assignedById }`. 400 unless `unpaidAcknowledged` (I4) · 400 if `isVoid` or `isPaid` · 404 if the customer does not exist. Sets the three columns, emits `order.customer-assigned` |
| `POST /:id/unassign-customer` | **New** — 400 if `isPaid`. Clears the three columns only (I6), emits `order.customer-unassigned` |
| `GET /unpaid-count` | **New** — `{ count }` for `unpaidAcknowledged: true, isPaid: false, isVoid: false`. Feeds the nav badge. Placed after the existing `/count` route (line 34); there is no `GET /:id` in this file, so no shadowing |

The existing `unpaid-ack` rejects both `isPaid` and `isVoid`; the extended version keeps both checks.

### `backend/scheduler.ts`
`autoCloseExpiredShifts()` gains the bulk `updateMany` inside its existing `$transaction`, in the `!manualClose` branch, plus an `order.unpaid-ack` emit per affected order. Full detail in [Shift Auto-Close](#shift-auto-close). `prisma` and `emitLiveEvent` are already imported, so no new imports.

### `backend/app.ts`
Register `/api/customers` alongside the other mounts (near line 78).

### `backend/events.ts`
`LiveEvent.type` is a plain `string`, so no union needs extending. Emit `order.customer-assigned`, `order.customer-unassigned`, and `order.unpaid-ack` from the scheduler.

### Unchanged on purpose
- `backend/routes/shifts.ts:240` — close gate stays `!o.isVoid && !o.isPaid && !o.unpaidAcknowledged`
- `backend/routes/dailyReport.ts` — derives everything live from `shift.orders`; late payments reconcile the original day with no code (see [Report Reconciliation](#report-reconciliation-no-code-change))
- `backend/routes/orders.ts` `POST /:id/void` — keeps preserving payment state
- `ShiftSnapshot` — stock and plates only. No money fields are added, so reports never freeze
- No auth middleware anywhere (trusted LAN, deferred)

## Frontend Changes

### API layer — `desktop/ui/lib/api.ts`
New functions, each following the existing `window.electron?.x ? ... : apiFetch(...)` pattern:
`getCustomers`, `getCustomerById`, `createCustomer`, `updateCustomer`, `deleteCustomer`, `getUnpaidOrderCount`, `assignOrderCustomer`, `unassignOrderCustomer`, `markOrderUnpaidWithCustomer`, `searchCustomers(q?)` (used by `CustomerPickerDialog`).

`getOrdersNeedingCustomer()` is **removed** — the badge is the only consumer and it now reads `/orders/unpaid-count`.

### `desktop/ui/lib/utils.ts`
Add `formatElapsed(from, to?)` and `elapsedSeverity(from, to?)` beside the existing `formatDate`. Detail in [Aging Columns](#aging-columns).

### `desktop/electron/ipc-handlers.ts` + `preload.cts`
Mirror as `window.electron.customer.*` and `order.assignCustomer` / `order.unassignCustomer` / `order.markUnpaidWithCustomer`.

### `desktop/ui/types/electron.d.ts`
- Global `Customer` interface (like `Department` at line ~192)
- Extend `Order` (line 106): `customerId?: string`, `customerAssignedById?: string`, `customerAssignedAt?: string`, `Customer?: { id, name, phone }`
- Add the new `window.electron.customer.*` and `order.*` methods in the `ElectronAPI` interface

### `desktop/ui/components/admin/CustomerPickerDialog.tsx` (new)
- Search by name **or** phone
- Each row shows `Name · 0722 000 000` plus that customer's `outstandingTotal`
- **Inline create** — add a customer without leaving the dialog (all three roles may CRUD, no permission branch needed)
- Only selectable when the order is already marked unpaid (checked against the `unpaidAcknowledged` prop passed in); if not, show a greyed reason label

### `desktop/ui/pages/admin/Customers.tsx` (new)
Customer list: name, phone, open orders, outstanding total, search, and create / edit / delete dialogs. Modelled on `DepartmentManager.tsx` (`DataTable` + `usePagination` + `Dialog`).

### `desktop/ui/pages/admin/CustomerDetail.tsx` (new)
The read-only ledger:
- Running **OUTSTANDING** total at the top (sum of that customer's unpaid, non-void orders)
- **OPEN** table — unpaid orders with order #, date, meal period, shift type, operation day
- **SETTLED** table — paid orders with date, meal period, method, date paid
- Collapsed **"Cancelled (n)"** section — grey-struck, excluded from totals, each showing *"Replaced by #1050"* via `voidedOrderId` reverse lookup (same pattern as `WaiterOrderContext.tsx:79`)

### `desktop/ui/App.tsx` + `AdminLayout.tsx`
Routes under the existing admin protected section:
- `/admin/customers` — `<ProtectedRoute role={["admin","manager","cashier"]}>`
- `/admin/customers/:id` — same

Nav item `{ label: "Customers", path: "/admin/customers", icon: Contact, roles: ["admin","manager","cashier"] }` plus the unpaid badge on the **Cashier** item, fed by `getUnpaidOrderCount()` on the existing 5s poll. Full detail in [Badge relocation](#badge-relocation).

### `desktop/ui/pages/admin/Cashier.tsx`
**"All Shifts" option** — add an "All Shifts" card to `OrdersEntryView` and `PaymentEntryView` that passes `undefined` as `shiftType`. The existing filter logic (`Cashier.tsx:440-441`) already treats a missing `shiftType` as "no filter at all":
```ts
const filteredOrders = shiftType
  ? allOrders.filter((o) => o.shiftId && shiftTypeById.get(o.shiftId) === shiftType)
  : allOrders
```
This shows **every order from every shift** (not combined into one shift). It also bypasses the `isDisabled` lock (`Cashier.tsx:369`) that currently boxes a cashier into the currently open shift.

Note the volume is unbounded (`GET /orders` has no `take`). The existing `usePagination` and search inputs are the mitigation, plus the All Shifts date picker. If it is slow on the restaurant machine, a server-side `?since=` filter is the follow-up.

**Shift card scoping** — `OrdersView` (`:442`) and `PaymentView` (`:1370`) consume the `operationDay` prop they currently discard and scope by `(type, operationDay)`; the `<DatePicker>` renders only when `!shiftType`. Full detail in [Shift Card Scoping](#shift-card-scoping).

**"Can't Pay — Assign Customer"** in `PaymentView` — calls `unpaid-ack` + `customerId` in one call. On an **already-marked** order the button relabels to **"Assign Customer"** and calls `assign-customer` instead, so `unpaidAcknowledgedAt` is never re-stamped (I11).

**Marked Unpaid tab** (`Cashier.tsx:513`):
- Add `&& !o.isVoid` — voided orders never surface here (I7)
- Add a "Customer" column (amber "Not assigned" when `customerId` is null)
- Add Assign / Change / Remove actions that open `CustomerPickerDialog`
- Refresh events: add `order.customer-assigned` and `order.customer-unassigned` to all four `useLiveRefresh` arrays (lines ~250, ~481, ~927, ~1301). **Verify all four** — the earlier pass showed edits on only three, so the `PaymentView` array needs confirming

**Aging columns** on both tables — Waiting, Marked, and Paid At. See [Aging Columns](#aging-columns).

**Entry view** — `opDays` prefers the currently open shift's `operationDay` over "latest wins" (`Cashier.tsx:1304`).

> **Correction (implemented):** `OrdersView`, `PaymentView` and `VoidView` are not separate
> files — all three are defined inside `desktop/ui/pages/admin/Cashier.tsx`. The edits below
> were applied there; no `OrdersView.tsx` was created.

### `desktop/ui/pages/admin/Cashier.tsx` → `OrdersView`
- Consume the discarded `operationDay` prop and scope by `(type, operationDay)`; `<DatePicker>` only when `!shiftType`
- Aging columns on the Marked Unpaid tab, matching the payment table
- **Paid At** column on the MPESA / CASH tabs, beside the creation date
- Same `useLiveRefresh` event additions as `Cashier.tsx`

### `desktop/ui/components/shift/ShiftCloseDialog.tsx`
**No change. This flow stays entirely customer-free.** Step 2 lists `blockingUnpaid` = orders where `!isPaid && !isVoid && !unpaidAcknowledged`. Because `assign-customer` rejects any order that is not `unpaidAcknowledged`, an order can never carry a customer at the moment it is shown in this dialog — so a customer column here is dead code by construction. The "Mark Unpaid" button and the close gate stay unchanged.

This dialog serves **manual-close shifts only**. Auto-close shifts never open it — the scheduler does the acknowledgement itself (see [Shift Auto-Close](#shift-auto-close)).

## The Cashier's Loop

```
Cashier -> Orders / Payment -> [All Shifts]
   -> Pay                for orders settling now        (existing Pay button, unchanged)
   -> Can't Pay + Customer  for orders walking out      (marks unpaid + assigns, one click)

At shift close:
   manual-close shift -> manager marks remaining orders unpaid in the dialog, report
                         prints the unpaid count, shift closes
   auto-close shift   -> the scheduler marks every pending order unpaid at autoCloseTime;
                         the orders appear in All Shifts -> Marked Unpaid, fully trackable

Side bar badge shows the total unpaid backlog at all times, assigned or not.
Every unpaid row shows Waiting (since createdAt) and Marked (since the acknowledgement),
so the oldest money is visible without opening anything.

After close: Cashier -> All Shifts -> Marked Unpaid -> assign / change / remove
   Pay any of them whenever the money arrives. The report for the day the order was
   CREATED reconciles itself — no backfill, no frozen snapshot.
```

## Files Modified

### Backend
1. `backend/prisma/schema.prisma` — add `Customer` model + 3 Order columns
2. `backend/prisma/migrations/<ts>_customer_accounts/migration.sql` — new migration
3. `backend/routes/customers.ts` — new router
4. `backend/routes/orders.ts` — include Customer, extend `unpaid-ack`, change `unpaid-ack-undo`, add assign/unassign, add `GET /unpaid-count`
5. `backend/scheduler.ts` — auto-close marks pending orders unpaid inside the existing transaction + emits `order.unpaid-ack`
6. `backend/app.ts` — register `/api/customers`

### Frontend
7. `desktop/ui/lib/api.ts` — new API functions; remove `getOrdersNeedingCustomer()`
8. `desktop/ui/lib/utils.ts` — `formatElapsed()` + `elapsedSeverity()`
9. `desktop/electron/ipc-handlers.ts` — new IPC handlers (`order:assign-customer`, `order:unassign-customer`, `customer:*`); remove `customer:get-needs-customer`
10. `desktop/electron/preload.cts` — expose new IPC surface; remove `getNeedsCustomer`
11. `desktop/ui/types/electron.d.ts` — `Customer` interface, extend `Order` and `ElectronAPI`; drop `getNeedsCustomer`
12. `desktop/ui/components/admin/CustomerPickerDialog.tsx` — new
13. `desktop/ui/pages/admin/Customers.tsx` — new
14. `desktop/ui/pages/admin/CustomerDetail.tsx` — new
15. `desktop/ui/App.tsx` — routes (`/admin/customers`, `/admin/customers/:id` under existing admin protected block)
16. `desktop/ui/components/admin/AdminLayout.tsx` — Customers nav item; badge moves to Cashier and counts the whole unpaid backlog
17. `desktop/ui/pages/admin/Cashier.tsx` — All Shifts, shift-card scoping, date picker, aging columns, Can't Pay / Assign Customer, Marked Unpaid tab
18. `desktop/ui/pages/admin/Cashier.tsx` (`OrdersView`) — shift-card scoping, date picker, aging columns, Paid At on paid tabs

### Docs
19. `context/fix-plan/customer-accounts.md` — this file
20. `context/current-feature.md` — History entry on completion

## Tests — `backend/tests/customer-assignment.test.ts`

Modelled on `shift-enforcement.test.ts` and `void-restore.test.ts`:
- assign to a **non**-marked-unpaid order returns 400 (I4 — the key guard)
- `unpaid-ack` with `customerId` sets both atomically in the same update
- `unpaid-ack-undo` also clears the customer link (I8)
- assign to a paid order returns 400 · assign to a voided order returns 400
- unassign on a paid order returns 400
- unassign clears `customerId` but **preserves** `unpaidAcknowledged` (I6)
- shift still closes when all unpaid are marked unpaid, with or without customers (I3)
- voided orders excluded from `outstandingTotal`, the Marked Unpaid tabs and the badge; they keep their link (I7)
- `outstandingTotal` equals sum of that customer's unpaid, non-void orders
- duplicate stripped phone returns 409; spaces stripped before comparison
- deleting a customer with linked orders returns 409

New for this phase:

| Test | Guards against |
|---|---|
| Auto-closing a `manual = false` shift marks every pending order `unpaidAcknowledged = true` | I9 — the silent-invisibility bug returning |
| The same marking is idempotent: a second run does not change `unpaidAcknowledgedAt` | I10 |
| A `manual = true` shift is **not** auto-marked — the manager gate still blocks it | the two close paths staying distinct |
| `GET /orders/unpaid-count` counts assigned **and** unassigned marked-unpaid orders | someone re-adding a `customerId: null` filter |
| `/orders/unpaid-count` excludes paid, voided and unmarked (open-shift) orders | the badge meaning drifting |
| `POST /:id/assign-customer` leaves `unpaidAcknowledgedAt` unchanged | I11 — the aging clock reset |
| Paying an order created on an earlier shift increases **that shift's** revenue and reduces its unpaid count, with `paidAt` as the real payment time | I12 / [Report Reconciliation](#report-reconciliation-no-code-change) — someone adding money fields to `ShiftSnapshot` and freezing stale numbers |
| A shift card scoped to `(type, operationDay)` returns no orders from another operational day | I13 |

### Frontend unit tests — `formatElapsed` / `elapsedSeverity`
Boundary values: `0m`, `59m`, `60m`, `23h 59m`, `24h`, `48h`, and the severity thresholds at exactly 12h and 2d.

`.gitignore:35` ignores the whole `backend/tests/` directory, so these files need `git add -f` to be tracked.

## Verification

Gates that must pass:
- [ ] `npx tsc -p tsconfig.app.json --noEmit` clean
- [ ] `cd backend && npx tsc --noEmit` clean
- [ ] `npx tsc -p desktop/electron/tsconfig.json --noEmit` clean
- [ ] ESLint clean on every touched file
- [ ] Backend tests pass (new + existing)

Known **pre-existing** failures, unrelated to this work and not to be fixed here:
- `npx prisma migrate dev` fails with PostgreSQL `42P01` — `relation "Category" does not exist` (migration-history drift). The additive migration was applied via `db push` instead.
- Full `npm run build` / `npm run lint` are red: `desktop/ui/tests/utils.tsx` has a `TS1484` error, and `desktop/ui/tests/waiter-menu-grid.test.tsx` has unused imports and a missing `screen`.

Behaviour to confirm:
- [ ] A `manual = false` shift auto-closes and every pending order appears in All Shifts → Marked Unpaid, badge incremented
- [ ] A `manual = true` shift still requires the manager to acknowledge in the dialog before closing
- [ ] Auto-close marking is idempotent — re-running does not change `unpaidAcknowledgedAt`
- [ ] The DAY / NIGHT card shows only its own operational day, with no date picker
- [ ] The All Shifts card shows every shift, and its date picker narrows across all of them
- [ ] Badge sits on Cashier and counts assigned **and** unassigned unpaid orders
- [ ] Badge reads 0 during quiet service when only open-shift orders are pending
- [ ] Waiting and Marked columns show sensible values; "Not assigned" is amber
- [ ] Clicking "Assign Customer" on an already-marked order does **not** reset the Marked timer
- [ ] "Can't Pay" on an unmarked order marks unpaid and assigns in one action
- [ ] Pay button still marks an order paid (existing behaviour unchanged)
- [ ] Assigning to an unmarked-unpaid order blocked by API and UI
- [ ] `unpaid-ack-undo` also detaches the customer (I8)
- [ ] Marked Unpaid tab excludes voided orders and shows the Customer column
- [ ] Paid At appears on the MPESA / CASH tabs with the real payment time
- [ ] Paying a walkout days later updates the **creation day's** report — unpaid count drops, revenue rises
- [ ] Customer list shows correct outstanding totals; detail ledger shows open + settled + collapsed cancelled
- [ ] Voided orders stay out of close flow and all outstanding totals
- [ ] Manager-only void lock still intact for cashiers
- [ ] `npm run db:sync` on the restaurant machine applies cleanly (additive only)

## Merge & Deploy

Three premature commits exist on this branch (`f28f45a`, `93b23a3`, `619b914`). `619b914` contains the ShiftCloseDialog customer UI that was rejected, so the **committed** state is currently wrong even though the working tree is right. The agreed approach is to squash the branch into a single clean commit that overrides all three:

```
git reset --soft restaurant-build    # uncommit all three, keep every file staged
git diff --cached                     # review the complete final state
git commit -m "feat(cashier): customer attribution, unpaid backlog and shift-scoped payment views"
```

Safe because **nothing has been pushed** — no remote holds these commits. `--soft` preserves all file contents, and the old commits remain recoverable from the reflog until garbage collection.

Then:
```
git merge --no-ff -> restaurant-build
        -> git push origin restaurant-build
   restaurant machine: git pull && npm run db:sync && npm run build
```
`db:sync` = `npm run db:generate --prefix backend && npm run db:push --prefix backend`.
Update `context/current-feature.md` (Platform `fullstack`, History entry with this title) on completion.

## Accepted Tradeoffs
- `GET /orders` returns every order (`createdAt desc`, no server-side `take`). "All Shifts" loads them all. Client-side pagination (`usePagination`), search inputs, and the All Shifts date picker are the controls. A server-side `?since=` can be added only if performance demands it.
- Server-side auth / role middleware is deferred (trusted LAN on the restaurant network).
- **Reports are not snapshotted.** A payment to an old order retroactively changes a long-closed shift's revenue and its cash variance. This is deliberate — the report always reflects reality, and the order stays attributed to the day the food was actually eaten. The cost is that a reconciled shift's printed numbers can change after the fact.
- **The badge counts all unpaid backlog, not just unassigned.** Assigned-but-unpaid orders no longer produce a badge of their own; they are surfaced by the dashboard's total-unpaid card and by the aging columns in All Shifts. The priority is deliberately "is it paid or not", with ownership shown as a column rather than a separate count.
- **Shift cards no longer show history.** Scoping each card to its own operational day means previous days' unpaid orders are reachable only through All Shifts. The badge is the prompt that sends the cashier there.
- **Auto-close acknowledgement has no actor.** `unpaidAcknowledgedById` is `null` for system marks. The column has no `User` relation and is never rendered, so nothing needs a fallback — but a future audit screen would have to label it.
- `VoidView` (`Cashier.tsx:999`) has the identical discarded-`operationDay` bug and is **left untouched** — out of scope for this plan.
