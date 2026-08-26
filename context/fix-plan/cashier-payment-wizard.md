# Cashier Payment Wizard + Batch Payment Tracking

## Overview
Replace the simple single-order payment dialog with a 3-step wizard modal that supports both single and batch payments. Add a `paymentType` field to orders so batch-paid orders can be identified with a "Batch" badge in the orders table.

## Goals
- 3-step payment wizard: Payment Type → Payment Method → Select Orders
- Single order: select one order, mark as paid
- Batch order: select multiple orders, accumulate total, mark all as paid at once
- Add `paymentType` field (`SINGLE` | `BATCH`) to Order model
- Display "Batch" badge on orders paid via batch in the Orders table
- Keep existing Void and Orders views unchanged

## Database Changes

### Prisma Schema (`backend/prisma/schema.prisma`)
Add to Order model:
```prisma
paymentType  String?   // "SINGLE" or "BATCH"
```
- Nullable for backward compatibility (existing orders have no paymentType)
- Set to "SINGLE" or "BATCH" when payment is collected

### Migration
```
npx prisma migrate dev --name add-order-payment-type
```

## Backend Changes

### `POST /api/orders/:id/payment` (existing endpoint)
- Accept optional `paymentType` field in request body
- Store `paymentType` on the order alongside `paymentMethod`, `isPaid`, `paidAt`
- No breaking change — existing calls without `paymentType` still work

### `lib/api.ts`
- Update `updateOrderPayment()` to accept and pass `paymentType` parameter

### `electron.d.ts`
- Add `paymentType` to Order type

## Frontend Changes

### `Cashier.tsx` — PaymentView
Replace the simple "Pay → dialog" flow with a 3-step wizard:

#### Step 1: Payment Type
- Radio group: **Single Order** | **Batch Order**
- Visual card-style radio buttons (matching existing radio patterns in the app)
- Next button (disabled until selection made)

#### Step 2: Payment Method
- Radio group: **M-Pesa** | **Cash**
- Same card-style radio design
- Back + Next buttons

#### Step 3: Select Orders
- Search input to find orders by order number
- **Single mode**: click to select ONE order (radio-style selection)
- **Batch mode**: click to select MULTIPLE orders (checkbox-style selection)
- Running total displayed at bottom (accumulated for batch)
- List shows: Order #, Meal, Waiter, Total
- Confirm button (green) — calls payment API for each selected order with the chosen method and paymentType
- Back button

#### Post-Confirm
- Remove paid orders from the unpaid list
- Show success feedback
- Reset wizard

### `OrdersView` — Badge Display
- In the `paymentMethod` column render, check `paymentType`
- If `paymentType === "BATCH"`, show "Batch" badge alongside the payment method badge
- Badge style: `bg-purple-100 text-purple-700 rounded-full text-xs`

## Component Design

### Wizard State
```tsx
type WizardStep = "type" | "method" | "orders"
type PaymentType = "SINGLE" | "BATCH"
type PaymentMethod = "cash" | "mpesa"

const [wizardOpen, setWizardOpen] = useState(false)
const [wizardStep, setWizardStep] = useState<WizardStep>("type")
const [paymentType, setPaymentType] = useState<PaymentType | null>(null)
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
const [selectedOrders, setSelectedOrders] = useState<Order[]>([])
const [orderSearch, setOrderSearch] = useState("")
```

### Wizard Flow
```
[Pay Button] → Open Wizard
  Step 1: Select type (Single/Batch) → Next
  Step 2: Select method (M-Pesa/Cash) → Next
  Step 3: Search & select orders → Confirm
    Single: one order selected → total = order.totalPrice
    Batch: multiple orders selected → total = sum(order.totalPrice)
  Confirm → POST /api/orders/:id/payment for EACH order
    body: { method, paymentType }
  Close wizard → refresh unpaid list
```

### Wizard UI Layout
```
┌─────────────────────────────────────────┐
│           Collect Payment               │
├─────────────────────────────────────────┤
│  Step indicators: ① Type  ② Method  ③ Orders │
├─────────────────────────────────────────┤
│                                         │
│  [Step content here]                    │
│                                         │
├─────────────────────────────────────────┤
│  [Back]                        [Next]   │
└─────────────────────────────────────────┘
```

## Files Modified

### Backend
1. `backend/prisma/schema.prisma` — add `paymentType` field to Order
2. `backend/src/routes/orders.ts` — accept `paymentType` in payment endpoint
3. `desktop/ui/types/electron.d.ts` — add `paymentType` to Order type

### Frontend
4. `desktop/ui/lib/api.ts` — update `updateOrderPayment()` signature
5. `desktop/ui/pages/admin/Cashier.tsx` — PaymentView wizard + OrdersView badge

## Verification
- [ ] Prisma migration applies cleanly
- [ ] Single payment: wizard opens → select Single → select method → select order → confirm → order marked paid
- [ ] Batch payment: wizard opens → select Batch → select method → select multiple orders → confirm → all marked paid
- [ ] Batch badge shows on orders paid via batch in Orders view
- [ ] Single-paid orders do NOT show batch badge
- [ ] Existing orders without paymentType still display correctly
- [ ] Void and Orders views unaffected
- [ ] `tsc --noEmit` clean (root + backend)
- [ ] `npm run lint` clean
