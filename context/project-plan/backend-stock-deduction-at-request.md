# Backend — Stock Deduction at Request Creation

## Overview
Move stock deduction from fulfillment time to request creation time. When kitchen (or any department) makes a stock request, the requested quantity is immediately deducted from `StockSupply.currentStock`. This reserves the stock and prevents over-requesting.

## Problem
Currently stock is only deducted when the store fulfills a request. This means:
- Stock appears available even when it's been allocated to a pending request
- Multiple departments could request the same stock, leading to over-allocation
- Kitchen's Current Stock table shows incorrect available quantities

## Goal
- Deduct `quantityRequested` from `StockSupply.currentStock` when request is created
- Validate that requested quantity doesn't exceed available stock
- Remove stock deduction from fulfillment (already deducted at request time)
- Fulfillment trail still captured via `StockFulfillment` + `StockFulfillmentItem`

---

## Current Behavior

### POST `/api/stock-requests` (Request Creation)
- Creates `StockRequest` with status `PENDING`
- Creates `StockRequestItem` entries
- **Does NOT touch `StockSupply.currentStock`**

### PUT `/api/stock-requests/:id/fulfill` (Fulfillment)
- Updates `StockRequestItem.quantityDelivered`
- **Deducts from `StockSupply.currentStock`** ← lines 175-178
- Creates `StockFulfillment` + `StockFulfillmentItem` trail
- Auto-calculates status (PENDING → PARTIAL → COMPLETED)

---

## New Behavior

### POST `/api/stock-requests` (Request Creation)
- Creates `StockRequest` with status `PENDING`
- Creates `StockRequestItem` entries
- **Deducts `quantityRequested` from `StockSupply.currentStock`** ← NEW
- **Validates stock availability before deduction** ← NEW

### PUT `/api/stock-requests/:id/fulfill` (Fulfillment)
- Updates `StockRequestItem.quantityDelivered`
- **Does NOT deduct from `StockSupply.currentStock`** ← CHANGED
- Creates `StockFulfillment` + `StockFulfillmentItem` trail
- Auto-calculates status (PENDING → PARTIAL → COMPLETED)

---

## Example Flow

```
Store has 60kg beef

1. Kitchen requests 20kg
   → Stock: 60kg → 40kg (deducted at request)
   → Status: PENDING

2. Store fulfills 8kg
   → Stock stays at 40kg (no deduction at fulfillment)
   → Status: PENDING → PARTIAL
   → Delivered: 8kg / 20kg

3. Store fulfills 4kg
   → Stock stays at 40kg
   → Status: PARTIAL (still)
   → Delivered: 12kg / 20kg

4. Store fulfills remaining 8kg
   → Stock stays at 40kg
   → Status: PARTIAL → COMPLETED
   → Delivered: 20kg / 20kg

Fulfillment trail captured:
  - Fulfillment 1: 8kg (15 Jul)
  - Fulfillment 2: 4kg (16 Jul)
  - Fulfillment 3: 8kg (17 Jul)
```

---

## Implementation Steps

### Step 1: Add stock deduction to POST `/api/stock-requests`
**File:** `backend/routes/stockRequests.ts`

After validating supplies exist and quantities are valid, add:

```ts
// Validate stock availability and collect deductions
const deductions: { id: string; quantity: number }[] = []

for (const item of items) {
  const supply = supplies.find((s) => s.id === item.stockSupplyId)!
  const available = Number(supply.currentStock)
  const requested = Number(item.quantityRequested)

  if (requested > available) {
    return res.status(400).json({
      error: `Insufficient stock for "${supply.name}". Available: ${available}, Requested: ${requested}`,
    })
  }

  deductions.push({ id: supply.id, quantity: requested })
}
```

Then wrap the create in a transaction to deduct stock:

```ts
const request = await prisma.$transaction(async (tx) => {
  // Deduct stock for each item
  for (const d of deductions) {
    await tx.stockSupply.update({
      where: { id: d.id },
      data: { currentStock: { decrement: d.quantity } },
    })
  }

  // Create the request
  return tx.stockRequest.create({
    data: {
      requestedById,
      department,
      notes,
      status: "PENDING",
      items: {
        create: items.map((item: { stockSupplyId: string; quantityRequested: number }) => ({
          stockSupplyId: item.stockSupplyId,
          quantityRequested: item.quantityRequested,
        })),
      },
    },
    include: {
      requestedBy: { select: { id: true, name: true } },
      items: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true } },
        },
      },
    },
  })
})
```

### Step 2: Remove stock deduction from PUT `/api/stock-requests/:id/fulfill`
**File:** `backend/routes/stockRequests.ts`

Remove lines 175-178 (the `stockSupply.update` decrement):

```ts
// BEFORE (deducting stock at fulfillment)
for (const fi of fulfillmentItems) {
  const requestItem = existing.items.find((i) => i.id === fi.stockRequestItemId)!;

  // Deduct from store stock
  await tx.stockSupply.update({                          // ← REMOVE
    where: { id: requestItem.stockSupplyId },            // ← REMOVE
    data: { currentStock: { decrement: fi.quantityDelivered } }, // ← REMOVE
  });                                                     // ← REMOVE

  // Update quantityDelivered on the request item
  await tx.stockRequestItem.update({
    where: { id: fi.stockRequestItemId },
    data: { quantityDelivered: { increment: fi.quantityDelivered } },
  });
}

// AFTER (no stock deduction at fulfillment)
for (const fi of fulfillmentItems) {
  // Update quantityDelivered on the request item
  await tx.stockRequestItem.update({
    where: { id: fi.stockRequestItemId },
    data: { quantityDelivered: { increment: fi.quantityDelivered } },
  });
}
```

### Step 3: Remove stock validation at fulfillment
**File:** `backend/routes/stockRequests.ts`

Remove lines 152-157 (the "Cannot deliver more than available store stock" check), since stock was already deducted at request time:

```ts
// REMOVE this block:
// Cannot deliver more than available store stock
const availableStock = Number(requestItem.stockSupply.currentStock);
if (qty > availableStock) {
  return res.status(400).json({
    error: `Insufficient store stock for "${requestItem.stockSupply.name}". Available: ${availableStock}, Requested to deliver: ${qty}`,
  });
}
```

The only validation needed at fulfillment is that `quantityDelivered` doesn't exceed `quantityRequested` (which is already there).

---

## Files to Modify

| File | Action |
|---|---|
| `backend/routes/stockRequests.ts` | Modify POST (add stock deduction + validation), Modify PUT (remove stock deduction + stock validation) |

**Total: 1 file modified**

---

## No Schema Changes Needed

- `StockSupply.currentStock` already exists
- `StockFulfillment` + `StockFulfillmentItem` already capture fulfillment trail
- `StockRequestItem.quantityDelivered` tracks delivered amounts

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Request more than available stock | Reject with 400 error: "Insufficient stock" |
| Multiple concurrent requests for same stock | Prisma transaction ensures atomicity — second request will see updated stock |
| Cancel a pending request | Future feature — would need to add stock back |
| Request 0 or negative quantity | Already validated (quantityRequested > 0) |

---

## Verification

1. Run `npm run lint` — no errors
2. Run `npm run build` — type-check passes
3. Test flow:
   - Create request for 20kg from 60kg stock → stock becomes 40kg
   - Try to request 50kg from 40kg stock → rejected (insufficient)
   - Fulfill 8kg → stock stays at 40kg, status = PARTIAL
   - Fulfill remaining 12kg → stock stays at 40kg, status = COMPLETED
4. Check fulfillment trail: `StockFulfillment` records created with items
