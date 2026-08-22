# Shift Management, Sales Reports & Void Orders — Implementation Plan

## Overview

Introduce Day/Night Shift operations with plate tracking, sales reporting, order voiding, and production cost analysis.

---

## Phase 1: Prisma Schema + Migration

### New Models

**Shift**
- id (UUID)
- type (ShiftType: DAY | NIGHT)
- date (Date)
- openingTime (DateTime)
- autoCloseTime (DateTime)
- actualCloseTime (DateTime?)
- isOpen (Boolean, default true)
- openedById (FK → User)
- closedById (FK → User?)
- createdAt (DateTime)

**ShiftSnapshot**
- id (UUID)
- shiftId (FK → Shift)
- menuId (FK → Menu)
- openingPlates (Int)
- closingPlates (Int?)
- platesSold (Int, default 0)
- platesWasted (Int, default 0)

**Enum ShiftType**
- DAY
- NIGHT

### Modified Models

**Order**
- isVoid (Boolean, default false)
- voidReason (String?)
- voidedAt (DateTime?)
- voidedById (FK → User?)
- shiftId (FK → Shift?)
- voidedOrderId (FK → Order?) — links replacement to original

**StockSupply**
- costPrice (Decimal?)

### Migration

```bash
cd backend
npx prisma migrate dev --name add-shift-management
```

---

## Phase 2: Shift API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/shifts/open | Open new shift |
| POST | /api/shifts/:id/close | Close shift manually |
| GET | /api/shifts/current | Get current open shift |
| GET | /api/shifts/:id | Get shift details |
| POST | /api/shifts/auto-close | Auto-close expired shifts |

### Shift Open Logic

```
1. Check if shift already open for this type+date
2. If yes, return existing shift
3. If no:
   a. Create Shift record
   b. Take opening snapshot (all active menu items plate counts)
   c. Return created shift
```

### Shift Close Logic

```
1. Verify shift is open
2. Take closing snapshot (current plate counts)
3. Calculate variance per item (expected - actual)
4. Set isOpen = false
5. Set actualCloseTime = now()
6. Return shift with snapshots
```

### Auto-Close Logic

```
1. Find all open shifts where autoCloseTime <= now
2. For each shift:
   a. Take closing snapshot
   b. Set isOpen = false
   c. Set actualCloseTime = autoCloseTime (no drift)
3. Return closed shifts
```

---

## Phase 3: Void Order API

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/orders/:id/void | Void entire order |

### Request Body

```json
{
  "reason": "Customer changed order",
  "voidedById": "user-uuid"
}
```

### Void Logic

```
1. Verify order exists and is not already voided
2. Verify order is in current open shift (if shift exists)
3. For each OrderItem:
   a. Restore Menu.stock by item quantity
4. Mark Order:
   - isVoid = true
   - voidReason = reason
   - voidedAt = now()
   - voidedById = userId
5. Update ShiftSnapshot (reduce platesSold by voided qty)
6. Return voided order
```

---

## Phase 4: costPrice on StockSupply

### Update StockSupply API

```
PUT /api/stock-supplies/:id
- Add costPrice field to request body
- Validate: costPrice >= 0
- Update record
```

### Seed Data

Add costPrice to existing stock supplies via migration or script.

---

## Phase 5: Shift Report API

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports/shift/:id | Full shift report |
| GET | /api/reports/daily?date=YYYY-MM-DD | Day + Night summary |

### Report Data Structure

```json
{
  "shift": {
    "id": "shift-uuid",
    "type": "DAY",
    "date": "2026-08-20",
    "openingTime": "2026-08-20T05:30:00Z",
    "autoCloseTime": "2026-08-20T17:30:00Z",
    "actualCloseTime": "2026-08-20T17:35:00Z",
    "driftMinutes": 5
  },
  "plates": [
    {
      "menuId": "menu-uuid",
      "name": "Chapati",
      "openingPlates": 50,
      "platesSold": 42,
      "platesWasted": 0,
      "closingPlates": 8,
      "expectedClosing": 8,
      "variance": 0
    }
  ],
  "revenue": {
    "breakfast": {
      "orders": 15,
      "total": 2550
    },
    "lunch": {
      "orders": 32,
      "total": 8250
    },
    "dayShiftTotal": 10800
  },
  "production": {
    "totalCost": 8200,
    "totalSales": 10800,
    "variance": 2600,
    "profitMargin": "24.1%"
  }
}
```

---

## Phase 6: Cashier Void UI

### Files to Modify

- `desktop/ui/pages/admin/Cashier.tsx`

### Changes

1. Add "Void" button to order row (only if order in current shift)
2. Void dialog component:
   - Order details (items, total, waiter name)
   - Reason select (optional presets)
   - Confirm/Cancel buttons
3. On confirm: call void API, refresh order list
4. Voided orders show "VOIDED" badge, row grayed out

---

## Phase 7: Waiter Void Notification Card

### Files to Modify

- `desktop/ui/pages/waiterPos/WaiterPOS.tsx`

### Changes

1. Fetch voided orders for current waiter
2. Add VoidNotificationCard component
3. Card shows count of voided orders
4. Click redirects to meal period selection → new order flow
5. Card only visible if voidedOrders.length > 0

---

## Phase 8: Waiter Replacement Order Flow

### Files to Modify

- `desktop/ui/pages/waiterPos/WaiterMenu.tsx`

### Changes

1. When placing order after void, link to original:
   ```typescript
   const order = await createOrder({
     userId,
     items,
     mealType,
     voidedOrderId: voidedOrder?.id // if replacing
   })
   ```
2. Clear voided order from notification list
3. Print new receipt (same as normal flow)

---

## Phase 9: Shift Close UI

### Files to Create/Modify

- `desktop/ui/components/shift/ShiftCloseDialog.tsx` (new)
- `desktop/ui/pages/admin/Cashier.tsx` or `AdminIndex.tsx`

### Changes

1. "Close Shift" button (manager/cashier only)
2. Confirmation dialog showing:
   - Total orders count
   - Voided count
   - Unvoided count (locked after close)
   - Revenue summary
   - Drift warning (if closing after auto-close time)
3. On confirm: call close API
4. Display shift report

---

## Phase 10: Manager Report UI

### Files to Create

- `desktop/ui/pages/admin/Reports.tsx` (new)
- `desktop/ui/components/reports/ShiftReport.tsx` (new)

### Changes

1. Shift selector (date picker + type dropdown)
2. Report display:
   - Shift metadata (open/close times, drift)
   - Plate movement table
   - Revenue breakdown by meal period
   - Production vs sales comparison
   - Variance analysis
3. Export/print option

---

## Phase 11: Auto-Close Scheduler

### Files to Create

- `backend/src/scheduler.ts` (new)

### Changes

1. Run every minute
2. Check for open shifts past autoCloseTime
3. Auto-close them
4. Log auto-closed shifts

### Integration

- Import in `backend/src/index.ts`
- Start scheduler on server boot

---

## Phase 12: Void Analytics

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports/voids?date=YYYY-MM-DD | Void summary by waiter |

### Data

```json
{
  "waiters": [
    {
      "waiterId": "user-uuid",
      "name": "John",
      "totalOrders": 45,
      "voidedOrders": 3,
      "voidRate": "6.7%",
      "commonReasons": ["Customer changed order", "Wrong item"]
    }
  ]
}
```

---

## File Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── shifts.ts (new)
│   │   ├── reports.ts (new)
│   │   └── orders.ts (modify)
│   ├── scheduler.ts (new)
│   └── index.ts (modify)
└── prisma/
    └── schema.prisma (modify)

desktop/ui/
├── pages/admin/
│   ├── Cashier.tsx (modify)
│   └── Reports.tsx (new)
├── pages/waiterPos/
│   ├── WaiterPOS.tsx (modify)
│   └── WaiterMenu.tsx (modify)
├── components/
│   ├── shift/
│   │   └── ShiftCloseDialog.tsx (new)
│   └── reports/
│       └── ShiftReport.tsx (new)
└── lib/
    └── api.ts (modify)
```

---

## Testing Checklist

- [ ] Shift opens with correct time ranges
- [ ] Opening snapshot captures all active menu plates
- [ ] Orders decrement plates correctly
- [ ] Void restores plates correctly
- [ ] Waiter sees void notification card
- [ ] Replacement order links to original voided order
- [ ] Shift close takes closing snapshot
- [ ] Auto-close triggers at defined time
- [ ] Drift tracked between auto and manual close
- [ ] Shift report shows plate movement per item
- [ ] Revenue breakdown by meal period correct
- [ ] Production cost vs sales calculated
- [ ] Void analytics per waiter working
